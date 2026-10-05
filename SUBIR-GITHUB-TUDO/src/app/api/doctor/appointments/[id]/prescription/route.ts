import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getOwnedAppointment } from "@/lib/appointments";
import { clearSigningSession, getSigningDoctor, refreshSigningState } from "@/lib/doctorSigning";
import { addGeneratedPatientDocument, signPatientDocuments } from "@/lib/patientDocuments";
import { buildPrescriptionPdf, KIND_TITLES, type PrescriptionItem, type PrescriptionKind } from "@/lib/prescriptionPdf";
import { downloadSigned, PrescreveError, signPdf } from "@/lib/prescreve";

// Assinar + baixar o PDF pode levar alguns segundos.
export const maxDuration = 60;

const KINDS: PrescriptionKind[] = ["receita", "exame", "atestado"];
const FILE_PREFIX: Record<PrescriptionKind, string> = {
  receita: "Receita",
  exame: "Pedido de exame",
  atestado: "Atestado",
};

function cleanItems(raw: unknown): PrescriptionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => ({
      name: typeof it?.name === "string" ? it.name.trim().slice(0, 300) : "",
      quantity: typeof it?.quantity === "string" ? it.quantity.trim().slice(0, 80) : "",
      instructions: typeof it?.instructions === "string" ? it.instructions.trim().slice(0, 1000) : "",
    }))
    .filter((it) => it.name)
    .slice(0, 30);
}

/**
 * POST /api/doctor/appointments/:id/prescription
 * Gera o PDF (receita, pedido de exame ou atestado), assina com o
 * certificado do médico (sessão VIDaaS/BirdID aberta via Prescreve),
 * salva no cadastro do paciente e marca pra atendente imprimir.
 * Nada é enviado ao paciente.
 * Body: { kind, items: [{ name, quantity, instructions }], notes }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment || !appointment.patients) {
    return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind as PrescriptionKind;
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }
  const items = cleanItems(body?.items);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 5000) : "";

  if (kind === "atestado" && !notes) {
    return NextResponse.json({ error: "Escreva o texto do atestado" }, { status: 400 });
  }
  if (kind !== "atestado" && items.length === 0) {
    return NextResponse.json(
      { error: kind === "receita" ? "Inclua pelo menos um medicamento" : "Inclua pelo menos um exame" },
      { status: 400 }
    );
  }

  try {
    const doctor = await getSigningDoctor(session.doctorId);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });

    const state = await refreshSigningState(doctor);
    if (!state.ready) {
      return NextResponse.json(
        { error: `Falta no cadastro do médico: ${state.missing.join(", ")}. Complete em Meu cadastro (endereço/RQE) ou peça para a administração (CPF/CRM).` },
        { status: 400 }
      );
    }
    if (state.status !== "active" || !doctor.prescreve_session_id) {
      return NextResponse.json(
        { error: "Ative a assinatura (aprovação no app do seu certificado) antes de emitir.", needsSession: true },
        { status: 409 }
      );
    }

    const patient = appointment.patients;
    const pdf = await buildPrescriptionPdf({
      kind,
      doctor: { name: doctor.name, crm: doctor.crm!, crmUf: doctor.crm_uf!, rqe: doctor.rqe,
        specialty: doctor.specialty,
        address: doctor.endereco_profissional || process.env.RECEITA_ENDERECO || null,
      },
      patient: {
        name: patient.full_name,
        cpf: patient.cpf,
        birthDate: patient.birth_date,
        city: patient.city,
        state: patient.state,
      },
      items,
      notes,
      issuedAt: new Date(),
    });

    let signed;
    try {
      signed = await signPdf(doctor.prescreve_session_id, pdf);
    } catch (err) {
      // Sessão recusada/expirada do lado da Prescreve: pede nova aprovação.
      if (err instanceof PrescreveError && /sess/i.test(err.message)) {
        await clearSigningSession(doctor.id);
        return NextResponse.json(
          { error: "A autorização do certificado expirou. Aprove de novo no app.", needsSession: true },
          { status: 409 }
        );
      }
      throw err;
    }

    const signedPdf = await downloadSigned(signed.download_url);
    const stamp = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
      .format(new Date())
      .replace(/\//g, "-");
    const fileName = `${FILE_PREFIX[kind]} - ${patient.full_name} - ${stamp}.pdf`;

    const doc = await addGeneratedPatientDocument(patient.id, signedPdf, fileName, {
      kind,
      signed: true,
      author: doctor.name,
      appointment_id: appointment.id,
      needs_print: true,
    });
    const [withUrl] = await signPatientDocuments([doc]);

    return NextResponse.json({
      document: withUrl,
      title: KIND_TITLES[kind],
      creditsRemaining: signed.credits_remaining ?? null,
    });
  } catch (err) {
    if (err instanceof PrescreveError) {
      const msg =
        err.status === 402 ? "Sem créditos de assinatura digital. Avise a administração." : err.message;
      return NextResponse.json({ error: msg }, { status: err.status });
    }
    console.error("Erro ao emitir documento assinado:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao emitir o documento" },
      { status: 500 }
    );
  }
}
