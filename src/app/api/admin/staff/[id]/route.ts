import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStaffSession } from "@/lib/auth";

/** PATCH /api/admin/staff/:id — editar dados, papel, senha ou ativo/inativo. */
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
  if (body.role === "admin" || body.role === "atendente") update.role = body.role;
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.email === "string" && body.email.trim()) update.email = body.email.trim().toLowerCase();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("staff").update(update).eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Falha ao atualizar membro da equipe (e-mail já pode estar em uso)" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/staff/:id — não permite se for o próprio usuário logado. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getStaffSession();
  if (session?.staffId === id) {
    return NextResponse.json(
      { error: "Você não pode excluir sua própria conta enquanto está logado com ela." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("staff").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Não foi possível excluir esse membro da equipe." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
