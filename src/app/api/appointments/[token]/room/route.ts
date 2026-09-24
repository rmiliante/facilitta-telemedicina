import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ensureDailyRoom, dailyRoomUrl, createMeetingToken } from "@/lib/daily";

/**
 * POST /api/appointments/:token/room
 * Entrada do paciente na videochamada — validado só pelo token do
 * link (sem login/senha).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, status, patients(full_name)")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !appointment) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  }

  // Sinaliza pro médico, na fila, que esse paciente já está esperando
  // na sala de vídeo.
  await supabase
    .from("appointments")
    .update({ patient_joined_at: new Date().toISOString() })
    .eq("id", appointment.id);

  if (appointment.status === "cancelado") {
    return NextResponse.json({ error: "Essa consulta foi cancelada" }, { status: 410 });
  }
  if (appointment.status === "concluido") {
    return NextResponse.json({ error: "Essa consulta já foi encerrada" }, { status: 410 });
  }

  const patientName =
    (appointment.patients as unknown as { full_name: string } | null)?.full_name ??
    "Paciente";

  try {
    const roomName = await ensureDailyRoom(appointment.id);
    const meetingToken = await createMeetingToken(roomName, patientName, false);

    return NextResponse.json({ roomUrl: dailyRoomUrl(roomName), token: meetingToken });
  } catch (err) {
    console.error("Erro ao preparar sala de vídeo (paciente):", err);
    return NextResponse.json(
      { error: "Falha ao preparar a sala de videochamada" },
      { status: 502 }
    );
  }
}
