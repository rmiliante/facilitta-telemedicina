import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** PATCH /api/admin/manuals/categories/:id — renomeia. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await req.json().catch(() => ({}));
  const n = typeof name === "string" ? name.trim().slice(0, 60) : "";
  if (!n) return NextResponse.json({ error: "Informe o nome da categoria" }, { status: 400 });
  const { error } = await getSupabaseAdmin().from("manual_categories").update({ name: n }).eq("id", id);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Já existe uma categoria com esse nome" : "Falha ao renomear" }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/manuals/categories/:id — só se estiver vazia. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { count } = await supabase.from("manuals").select("id", { count: "exact", head: true }).eq("category_id", id);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "A categoria tem manuais. Mova-os antes de excluir." }, { status: 409 });
  const { error } = await supabase.from("manual_categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Falha ao excluir a categoria" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
