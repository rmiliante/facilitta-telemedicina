import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ensureDailyRoom, dailyRoomUrl, createMeetingToken } from "@/lib/daily";

/**
 * POST /api/doctor/appointments/:id/room
 * Cria (se preciso) e devolve o acesso à sala de vídeo da consulta,
 * pro médico logado — só se a consulta for dele.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, doctor_id, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !appointment) {
    return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });
  }
  if (appointment.doctor_id !== session.doctorId) {
    return NextResponse.json({ error: "Essa consulta não é sua" }, { status: 403 });
  }

  try {
    const roomName = await ensureDailyRoom(appointment.id);
    const token = await createMeetingToken(roomName, session.name, true);

    if (appointment.status === "agendado") {
      await supabase
        .from("appointments")
        .update({ status: "em_andamento" })
        .eq("id", appointment.id);
    }

    return NextResponse.json({ roomUrl: dailyRoomUrl(roomName), token });
  } catch (err) {
    console.error("Erro ao preparar sala de vídeo:", err);
    return NextResponse.json(
      { error: "Falha ao preparar a sala de videochamada" },
      { status: 502 }
    );
  }
}
