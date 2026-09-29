import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { todayKeySaoPaulo, utcDayRange } from "@/lib/format";

/**
 * GET /api/doctor/queue
 * Fila de atendimento do médico logado para o dia de hoje, ordenada
 * pela posição definida pela atendente (por ordem de chegada).
 */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // "Hoje" no fuso de São Paulo (antes era o dia UTC, que virava às 21h).
  const { start: dayStart, end: dayEnd } = utcDayRange(todayKeySaoPaulo());

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, queue_position, called_at, finished_at, patient_joined_at, patients(id, full_name, documents), specialties(name)"
    )
    .eq("doctor_id", session.doctorId)
    .gte("scheduled_at", dayStart)
    .lt("scheduled_at", dayEnd)
    .neq("status", "cancelado")
    .order("queue_position", { ascending: true, nullsFirst: false })
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar fila do médico:", error);
    return NextResponse.json({ error: "Falha ao buscar fila" }, { status: 500 });
  }

  const withPosition = (data ?? []).filter((a) => a.queue_position != null);
  const withoutPosition = (data ?? []).filter((a) => a.queue_position == null);

  return NextResponse.json({ queue: [...withPosition, ...withoutPosition] });
}
