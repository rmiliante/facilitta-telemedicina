import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getOwnedAppointment } from "@/lib/appointments";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addGeneratedPatientDocument, signPatientDocuments } from "@/lib/patientDocuments";
import {
  emitir,
  NUMERACAO_POR_CONTROLE,
  PrescricoesError,
  prescricoesAtivo,
  type MedicamentoItem,
  type TipoControle,
} from "@/lib/prescrevePrescricoes";

export const maxDuration = 60;

/**
 * Emite RECEITA CONTROLADA (azul, amarela, controle especial) pela API de Prescrições
 * da Prescreve, com numeração SNCR do próprio médico. Atrás da flag
 * PRESCREVE_PRESCRICOES_ATIVO. Com dryRun=true só valida (não emite, não gasta numeração).
 */

const digits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

function dataBR(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : undefined;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!prescricoesAtivo()) return NextResponse.json({ error: "Recurso desativado" }, { status: 404 });

  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment || !appointment.patients) {
    return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });
  }
  const patient = appointment.patients;

  const body = (await req.json().catch(() => ({}))) as {
    tipoControle?: TipoControle;
    medicamentos?: { name?: string; quantidade?: string; concentracao?: string; forma?: string }[];
    informacoes?: string;
    dryRun?: boolean;
  };
  const tipo = body.tipoControle;
  if (!tipo || !(tipo in NUMERACAO_POR_CONTROLE)) {
    return NextResponse.json({ error: "Escolha o tipo da receita controlada" }, { status: 400 });
  }
  const meds: MedicamentoItem[] = (body.medicamentos || [])
    .filter((m) => (m.name || "").trim())
    .map((m) => ({
      nome_medicamento: String(m.name).trim(),
      quantidade: digits(m.quantidade) || "1",
      concentracao: m.concentracao?.trim() || undefined,
      forma_farmaceutica: m.forma?.trim() || undefined,
      controlado: true,
    }));
  if (meds.length === 0) return NextResponse.json({ error: "Informe o medicamento" }, { status: 400 });

  const { data: doctor } = await getSupabaseAdmin()
    .from("doctors")
    .select("id, name, cpf, crm, crm_uf, prescreve_uuid, endereco_profissional")
    .eq("id", session.doctorId)
    .maybeSingle();
  if (!doctor?.prescreve_uuid || digits(doctor.cpf).length !== 11) {
    return NextResponse.json({ error: "Vincule sua conta da Prescreve antes de emitir receita controlada." }, { status: 409 });
  }
  const address = doctor.endereco_profissional || process.env.RECEITA_ENDERECO || "";
  const telefone = digits(patient.phone);
  if (!address) return NextResponse.json({ error: "Falta o endereço profissional no seu cadastro." }, { status: 400 });
  if (!patient.cpf || telefone.length < 10) {
    return NextResponse.json({ error: "O paciente precisa ter CPF e telefone cadastrados." }, { status: 400 });
  }

  try {
    const result = await emitir({
      profissional: { uuid: doctor.prescreve_uuid, cpf: digits(doctor.cpf) },
      profissional_endereco: address,
      paciente_nome: patient.full_name,
      paciente_cpf: digits(patient.cpf),
      paciente_telefone: telefone,
      paciente_data_nascimento: dataBR(patient.birth_date),
      documentos: [{ tipo: "receita", medicamentos: meds, informacoes: body.informacoes?.trim() || undefined, tipo_controle: tipo }],
      dry_run: body.dryRun === true,
    });

    if (body.dryRun === true) return NextResponse.json({ ok: true, dryRun: true });

    const stamp = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date()).replace(/\//g, "-").replace(",", "");

    const docs = [];
    for (const d of result.documentos) {
      // O PDF fica disponível só por pouco tempo: baixa e guarda no nosso Storage.
      let withUrl = null;
      if (d.s3_url) {
        const pdfRes = await fetch(d.s3_url);
        if (pdfRes.ok) {
          const buf = Buffer.from(await pdfRes.arrayBuffer());
          const fileName = "Receita controlada - " + patient.full_name + " - " + stamp + ".pdf";
          const saved = await addGeneratedPatientDocument(patient.id, buf, fileName, {
            kind: "receita",
            signed: true,
            author: doctor.name,
            appointment_id: appointment.id,
            needs_print: true,
          });
          [withUrl] = await signPatientDocuments([saved]);
        }
      }
      await getSupabaseAdmin().from("prescreve_documentos").insert({
        doctor_id: doctor.id,
        consulta_ref: appointment.id,
        paciente_nome: patient.full_name,
        tipo_controle: tipo,
        numero_sncr: d.numero_sncr ?? null,
        token: d.token,
        documento_id: d.documento_id,
        status: withUrl ? "emitido" : "emitido_sem_pdf",
      });
      docs.push({ numeroSncr: d.numero_sncr ?? null, document: withUrl });
    }
    return NextResponse.json({ ok: true, documentos: docs });
  } catch (err) {
    if (err instanceof PrescricoesError) {
      const msg =
        err.code === "SNCR_SEM_NUMERACAO"
          ? "Você está sem numeração SNCR para esse tipo de receita. Peça mais numeração e tente de novo."
          : err.status === 402
            ? "Sem créditos na Prescreve. Avise a administração."
            : err.message;
      return NextResponse.json({ error: msg, code: err.code }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
    }
    console.error("Erro ao emitir receita controlada:", err);
    return NextResponse.json({ error: "Falha ao emitir a receita controlada" }, { status: 500 });
  }
}
