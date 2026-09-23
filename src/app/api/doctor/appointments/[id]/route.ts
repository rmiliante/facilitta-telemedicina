import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getOwnedAppointment, getPatientHistory } from "@/lib/appointments";

/** GET /api/doctor/appointments/:id — detalhes da consulta + dados do paciente. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment) {
    return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });
  }

  const history = await getPatientHistory(appointment.patient_id, id);

  return NextResponse.json({ appointment, history });
}

/**
 * PATCH /api/doctor/appointments/:id
 * Salva as anotações da consulta e/ou muda o status (ex: concluído).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment) {
    return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.doctorNotes === "string") update.doctor_notes = body.doctorNotes;
  if (
    typeof body.status === "string" &&
    ["agendado", "em_andamento", "concluido", "cancelado", "faltou"].includes(body.status)
  ) {
    update.status = body.status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("appointments").update(update).eq("id", id);

  if (error) {
    console.error("Erro ao atualizar consulta:", error);
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
