import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** PATCH /api/admin/appointments/:id — reagendar, trocar médico, cancelar. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.scheduledAt === "string" && body.scheduledAt) {
    update.scheduled_at = body.scheduledAt;
  }
  if ("doctorId" in body) {
    update.doctor_id = typeof body.doctorId === "string" && body.doctorId ? body.doctorId : null;
  }
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
    return NextResponse.json({ error: "Falha ao atualizar consulta" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
