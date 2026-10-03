import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { doctorCanAccessPatient } from "@/lib/appointments";
import { cleanAppointmentId, finalizePatientDocument, signPatientDocuments } from "@/lib/patientDocuments";
import { audit, patientName } from "@/lib/audit";

/**
 * POST /api/doctor/patients/:id/documents/finalize
 * Segundo passo do envio direto pro Storage: chamado depois que o
 * navegador já subiu o arquivo pra URL assinada de /upload-url. Só
 * registra o arquivo na ficha do paciente.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  if (!(await doctorCanAccessPatient(session.doctorId, id))) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const { path, name } = body ?? {};

  if (typeof path !== "string" || !path || typeof name !== "string" || !name) {
    return NextResponse.json({ error: "path e name são obrigatórios" }, { status: 400 });
  }

  try {
    const updated = await finalizePatientDocument(id, path, name, {
      source: "medico",
      appointment_id: cleanAppointmentId(body?.appointmentId),
    });
    const signed = await signPatientDocuments(updated);
    await audit("doctor", { action: "anexar_documento", entity: "documento", entityId: path, patientId: id, patientName: await patientName(id), details: { arquivo: name } });
    return NextResponse.json({ files: signed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao registrar o arquivo" },
      { status: 500 }
    );
  }
}
