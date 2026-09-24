import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/doctor/queue
 * Fila de atendimento do médico logado para o dia de hoje, ordenada
 * pela posição definida pela atendente (por ordem de chegada).
 */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayKey = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const dayStart = new Date(`${dayKey}T00:00:00.000Z`).toISOString();
  const dayEnd = new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, queue_position, called_at, finished_at, patient_joined_at, patients(id, full_name), specialties(name)"
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
