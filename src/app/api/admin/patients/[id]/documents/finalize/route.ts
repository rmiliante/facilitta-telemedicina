import { NextRequest, NextResponse } from "next/server";
import { cleanAppointmentId, finalizePatientDocument, signPatientDocuments } from "@/lib/patientDocuments";
import { audit, patientName } from "@/lib/audit";

/**
 * POST /api/admin/patients/:id/documents/finalize
 * Segundo passo do envio direto pro Storage: registra na ficha do
 * paciente o arquivo que o navegador já subiu direto pra URL assinada.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { path, name } = body ?? {};

  if (typeof path !== "string" || !path || typeof name !== "string" || !name) {
    return NextResponse.json({ error: "path e name são obrigatórios" }, { status: 400 });
  }

  try {
    const updated = await finalizePatientDocument(id, path, name, {
      source: "paciente",
      appointment_id: cleanAppointmentId(body?.appointmentId),
    });
    const signed = await signPatientDocuments(updated);
    await audit("staff", { action: "anexar_documento", entity: "documento", entityId: path, patientId: id, patientName: await patientName(id), details: { arquivo: name } });
    return NextResponse.json({ files: signed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao registrar o arquivo" },
      { status: 500 }
    );
  }
}
