import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * PATCH /api/admin/appointments/:id — reagendar (por data), trocar
 * médico, mudar status, ajustar a posição na fila, ou marcar como
 * "chamado" (called_at) quando o médico entra na consulta.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.scheduledDate === "string" && body.scheduledDate) {
    update.scheduled_at = `${body.scheduledDate}T12:00:00.000Z`;
  } else if (typeof body.scheduledAt === "string" && body.scheduledAt) {
    // Compatibilidade com o formato antigo (datetime completo).
    update.scheduled_at = body.scheduledAt;
  }

  let doctorChanged = false;
  if ("doctorId" in body) {
    const newDoctorId = typeof body.doctorId === "string" && body.doctorId ? body.doctorId : null;
    update.doctor_id = newDoctorId;
    doctorChanged = true;
  }
  if (
    typeof body.status === "string" &&
    ["agendado", "em_andamento", "concluido", "cancelado", "faltou"].includes(body.status)
  ) {
    update.status = body.status;
    if (body.status === "concluido") {
      update.finished_at = new Date().toISOString();
    }
  }
  if (typeof body.queuePosition === "number" || body.queuePosition === null) {
    update.queue_position = body.queuePosition;
  }
  if (body.markCalled === true) {
    update.called_at = new Date().toISOString();
  }

  const supabase = getSupabaseAdmin();

  // Se o médico for definido/trocado e nenhuma posição de fila foi
  // enviada explicitamente, entra no final da fila do novo médico
  // naquele dia (em vez de ficar sem posição).
  if (doctorChanged && update.doctor_id && !("queuePosition" in body)) {
    const { data: current } = await supabase
      .from("appointments")
      .select("scheduled_at")
      .eq("id", id)
      .maybeSingle();

    const referenceDate = typeof update.scheduled_at === "string" ? update.scheduled_at : current?.scheduled_at;

    if (referenceDate) {
      const dayKey = new Date(referenceDate).toISOString().slice(0, 10);
      const dayStart = new Date(`${dayKey}T00:00:00.000Z`).toISOString();
      const dayEnd = new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data: lastInQueue } = await supabase
        .from("appointments")
        .select("queue_position")
        .eq("doctor_id", update.doctor_id as string)
        .neq("id", id)
        .gte("scheduled_at", dayStart)
        .lt("scheduled_at", dayEnd)
        .neq("status", "cancelado")
        .order("queue_position", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      update.queue_position = (lastInQueue?.queue_position ?? 0) + 1;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { error } = await supabase.from("appointments").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Falha ao atualizar consulta" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/appointments/:id — remove o registro (não conta mais na cota mensal). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("appointments").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Falha ao excluir consulta" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
