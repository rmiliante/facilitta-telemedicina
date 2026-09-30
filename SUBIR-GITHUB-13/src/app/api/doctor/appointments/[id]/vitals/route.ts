import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getOwnedAppointment } from "@/lib/appointments";
import { cleanVitalValues, insertVitalSign, listVitalSigns, parseMeasuredAt } from "@/lib/vitalSigns";
import { VITALS_MIGRATION_WARNING } from "@/lib/vitals";

/**
 * Aferições do paciente desta consulta, na tela do médico.
 * GET  → histórico completo (a tela mostra a atual e a anterior)
 * POST → nova aferição feita pelo médico, vinculada a esta consulta
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment) return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });

  try {
    const { items, migrated } = await listVitalSigns(appointment.patient_id);
    return NextResponse.json({ items, migrated, warning: migrated ? null : VITALS_MIGRATION_WARNING });
  } catch {
    return NextResponse.json({ error: "Falha ao buscar aferições" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment) return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const values = cleanVitalValues(body);
  if (!values) return NextResponse.json({ error: "Preencha pelo menos um sinal vital." }, { status: 400 });

  const result = await insertVitalSign({
    patientId: appointment.patient_id,
    appointmentId: id,
    measuredAt: parseMeasuredAt(body.measuredAt),
    values,
    recordedByName: session.name,
    recordedByRole: "medico",
  });
  if (result.missingTable) return NextResponse.json({ error: VITALS_MIGRATION_WARNING }, { status: 503 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ item: result.item });
}
