import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MANUALS_BUCKET } from "@/lib/manuals";

/** PATCH /api/admin/manuals/:id — título, descrição e categoria. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Informe o título" }, { status: 400 });
  const { error } = await getSupabaseAdmin()
    .from("manuals")
    .update({
      title,
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 500) : null,
      category_id: typeof b.categoryId === "string" && b.categoryId ? b.categoryId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Falha ao salvar as alterações" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/manuals/:id — apaga o manual e todas as versões (inclui os arquivos). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: versions } = await supabase.from("manual_versions").select("storage_path").eq("manual_id", id);
  const { error } = await supabase.from("manuals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Falha ao excluir o manual" }, { status: 500 });
  const paths = (versions ?? []).map((v) => v.storage_path);
  if (paths.length > 0) await supabase.storage.from(MANUALS_BUCKET).remove(paths);
  return NextResponse.json({ ok: true });
}
