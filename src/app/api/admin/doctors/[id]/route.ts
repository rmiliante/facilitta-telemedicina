import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";

/** PATCH /api/admin/doctors/:id — ativar/desativar ou redefinir senha. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.active === "boolean") update.active = body.active;
  if (typeof body.password === "string" && body.password.length >= 6) {
    update.password_hash = await bcrypt.hash(body.password, 10);
  }
  if (typeof body.specialtyId === "string") update.specialty_id = body.specialtyId || null;
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.email === "string" && body.email.trim()) update.email = body.email.trim();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("doctors").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Falha ao atualizar médico" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
