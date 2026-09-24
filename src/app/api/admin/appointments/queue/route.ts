import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Fila de atendimento por ordem de chegada.
 *
 * GET  /api/admin/appointments/queue?doctorId=xxx&date=YYYY-MM-DD
 *   → lista as consultas desse médico nesse dia, ordenadas pela fila
 *     (queue_position; quem ainda não tem posição aparece no fim).
 *
 * PATCH /api/admin/appointments/queue
 *   body: { doctorId, date, orderedIds: string[] }
 *   → redefine a ordem da fila desse médico nesse dia (1, 2, 3, ...),
 *     na ordem dos IDs enviados.
 */

function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get("doctorId");
  const date = req.nextUrl.searchParams.get("date");

  if (!doctorId || !date) {
    return NextResponse.json({ error: "doctorId e date são obrigatórios" }, { status: 400 });
  }

  const { start, end } = dayRange(date);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, access_token, queue_position, called_at, patients(id, full_name), doctors(id, name), specialties(id, name)"
    )
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .neq("status", "cancelado")
    .order("queue_position", { ascending: true, nullsFirst: false })
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar fila:", error);
    return NextResponse.json({ error: "Falha ao buscar fila" }, { status: 500 });
  }

  // Coloca quem não tem posição de fila ainda por último, preservando
  // a ordem relativa entre eles.
  const withPosition = (data ?? []).filter((a) => a.queue_position != null);
  const withoutPosition = (data ?? []).filter((a) => a.queue_position == null);

  return NextResponse.json({ appointments: [...withPosition, ...withoutPosition] });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { doctorId, date, orderedIds } = body ?? {};

  if (
    typeof doctorId !== "string" ||
    !doctorId ||
    typeof date !== "string" ||
    !date ||
    !Array.isArray(orderedIds) ||
    orderedIds.some((id) => typeof id !== "string")
  ) {
    return NextResponse.json(
      { error: "doctorId, date e orderedIds (lista de IDs) são obrigatórios" },
      { status: 400 }
    );
  }

  const { start, end } = dayRange(date);
  const supabase = getSupabaseAdmin();

  // Confere que todos os IDs pertencem mesmo a esse médico/dia antes de
  // reordenar, pra evitar que um ID de outro dia bagunce a fila.
  const { data: existing, error: fetchErr } = await supabase
    .from("appointments")
    .select("id")
    .eq("doctor_id", doctorId)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end);

  if (fetchErr) {
    return NextResponse.json({ error: "Falha ao validar fila" }, { status: 500 });
  }

  const validIds = new Set((existing ?? []).map((a) => a.id));
  const filteredIds = orderedIds.filter((id: string) => validIds.has(id));

  const results = await Promise.all(
    filteredIds.map((id: string, index: number) =>
      supabase
        .from("appointments")
        .update({ queue_position: index + 1 })
        .eq("id", id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed) {
    return NextResponse.json({ error: "Falha ao salvar a nova ordem da fila" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
