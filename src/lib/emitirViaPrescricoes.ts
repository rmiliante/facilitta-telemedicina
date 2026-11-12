import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { addGeneratedPatientDocument, signPatientDocuments } from "@/lib/patientDocuments";
import { emitir, PrescricoesError, type DocumentoEmissao, type MedicamentoItem } from "@/lib/prescrevePrescricoes";
import { KIND_TITLES } from "@/lib/prescriptionPdf";
import { saveCustomExams } from "@/lib/customExams";
import { audit } from "@/lib/audit";

/**
 * Exame, atestado e receita simples emitidos pela API de Prescrições da Prescreve
 * (usa a franquia de documentos do contrato — não gasta crédito da Assinatura Digital
 * White Label). A Prescreve monta o documento e já assina com o certificado da médica
 * (sessão aberta no app do VIDaaS).
 *
 * Devolve null quando a médica ainda não tem conta vinculada na Prescreve: quem chama
 * segue pelo fluxo antigo.
 */

type Kind = "receita" | "exame" | "atestado";

interface Item {
  name: string;
  quantity: string;
  instructions: string;
}

interface PacienteLike {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
}

const FILE_PREFIX: Record<Kind, string> = {
  receita: "Receita",
  exame: "Pedido de exame",
  atestado: "Atestado",
};

const digits = (s: string | null | undefined) => (s || "").replace(/[^0-9]/g, "");

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function dataBR(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : undefined;
}

function montarDocumento(kind: Kind, items: Item[], notes: string): DocumentoEmissao {
  if (kind === "exame") {
    return {
      tipo: "pedido_exame",
      exames: items.map((it) => ({
        nome_exame: it.name,
        observacoes: it.instructions.trim() || undefined,
      })),
      informacoes: notes.trim() || undefined,
    };
  }
  if (kind === "atestado") {
    const paragrafos = notes
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => "<p>" + esc(l) + "</p>")
      .join("");
    return { tipo: "documento", tipo_documento: "Atestado Médico", informacoes: paragrafos };
  }
  const medicamentos: MedicamentoItem[] = items.map((it) => {
    const qtd = it.quantity.trim();
    // A API só aceita dígitos na quantidade; o texto original ("1 caixa") vai junto da posologia.
    const textoQtd = qtd && !/^[0-9]+$/.test(qtd) ? "Quantidade: " + qtd : "";
    return {
      nome_medicamento: it.name,
      quantidade: digits(qtd) || "1",
      observacoes: [textoQtd, it.instructions.trim()].filter(Boolean).join(" — ") || undefined,
    };
  });
  return { tipo: "receita", medicamentos, informacoes: notes.trim() || undefined };
}

export async function emitirViaPrescricoes(input: {
  kind: Kind;
  items: Item[];
  notes: string;
  doctorId: string;
  patient: PacienteLike;
  appointmentId: string;
}): Promise<NextResponse | null> {
  const { kind, items, notes, patient } = input;
  const supabase = getSupabaseAdmin();

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, name, cpf, prescreve_uuid, endereco_profissional")
    .eq("id", input.doctorId)
    .maybeSingle();
  if (!doctor?.prescreve_uuid || digits(doctor.cpf).length !== 11) return null;

  const address = doctor.endereco_profissional || process.env.RECEITA_ENDERECO || "";
  const telefone = digits(patient.phone);
  if (!address) {
    return NextResponse.json({ error: "Falta o endereço profissional no seu cadastro (Meu cadastro)." }, { status: 400 });
  }
  if (digits(patient.cpf).length !== 11 || telefone.length < 10) {
    return NextResponse.json(
      { error: "O paciente precisa ter CPF e telefone cadastrados para emitir o documento." },
      { status: 400 }
    );
  }

  try {
    const result = await emitir({
      profissional: { uuid: doctor.prescreve_uuid, cpf: digits(doctor.cpf) },
      profissional_endereco: address,
      paciente_nome: patient.full_name,
      paciente_cpf: digits(patient.cpf),
      paciente_telefone: telefone,
      paciente_data_nascimento: dataBR(patient.birth_date),
      documentos: [montarDocumento(kind, items, notes)],
    });

    const emitido = result.documentos[0];
    const stamp = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
      .format(new Date())
      .replace(/\//g, "-");
    const fileName = FILE_PREFIX[kind] + " - " + patient.full_name + " - " + stamp + ".pdf";

    // O PDF assinado fica disponível só por pouco tempo na Prescreve: baixa e guarda no nosso Storage.
    let saved = null;
    if (emitido?.s3_url) {
      const pdfRes = await fetch(emitido.s3_url);
      if (pdfRes.ok) {
        const buf = Buffer.from(await pdfRes.arrayBuffer());
        saved = await addGeneratedPatientDocument(patient.id, buf, fileName, {
          kind,
          signed: true,
          author: doctor.name,
          appointment_id: input.appointmentId,
          needs_print: true,
        });
      }
    }

    await supabase.from("prescreve_documentos").insert({
      doctor_id: doctor.id,
      consulta_ref: input.appointmentId,
      paciente_nome: patient.full_name,
      tipo_controle: kind,
      token: emitido?.token ?? null,
      documento_id: emitido?.documento_id ?? null,
      pdf_path: saved?.path ?? null,
      status: saved ? "emitido" : "emitido_sem_pdf",
    });

    if (!saved) {
      return NextResponse.json(
        { error: "O documento foi emitido na Prescreve, mas não foi possível guardar o PDF. Avise a administração." },
        { status: 502 }
      );
    }

    const [withUrl] = await signPatientDocuments([saved]);
    if (kind === "exame") await saveCustomExams(items.map((it) => it.name), doctor.id);
    await audit("doctor", {
      action: "emitir_documento",
      entity: "documento",
      entityId: saved.path,
      patientId: patient.id,
      patientName: patient.full_name,
      details: { tipo: kind, itens: items.length, via: "prescricoes" },
    });

    return NextResponse.json({ document: withUrl, title: KIND_TITLES[kind], creditsRemaining: null });
  } catch (err) {
    if (err instanceof PrescricoesError) {
      if (err.code === "CERT_NOT_CONNECTED" || err.status === 401) {
        return NextResponse.json(
          { error: "Aprove a assinatura no app do seu certificado antes de emitir.", needsSession: true, via: "prescricoes" },
          { status: 409 }
        );
      }
      if (err.status === 402) {
        return NextResponse.json({ error: "Sem franquia de documentos na Prescreve. Avise a administração." }, { status: 402 });
      }
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
    }
    console.error("Erro ao emitir pela API de Prescrições:", err);
    return NextResponse.json({ error: "Falha ao emitir o documento" }, { status: 500 });
  }
}
