import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStaffSession } from "@/lib/auth";
import { assertUploaded, MANUAL_MAX_BYTES } from "@/lib/manuals";

/** GET /api/admin/manuals — categorias + manuais (com a versão atual e quantas versões existem). */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const [cats, mans, vers] = await Promise.all([
    supabase.from("manual_categories").select("id, name, sort_order").order("sort_order").order("name"),
    supabase.from("manuals").select("id, title, description, category_id, sort_order, created_at, updated_at").order("sort_order").order("created_at"),
    supabase.from("manual_versions").select("id, manual_id, version_label, notes, file_name, mime_type, size_bytes, uploaded_by, uploaded_at").order("uploaded_at", { ascending: false }),
  ]);
  if (cats.error || mans.error || vers.error) {
    return NextResponse.json({ error: "Falha ao carregar os manuais" }, { status: 500 });
  }
  const byManual = new Map<string, NonNullable<typeof vers.data>>();
  for (const v of vers.data ?? []) {
    const list = byManual.get(v.manual_id) ?? [];
    list.push(v);
    byManual.set(v.manual_id, list);
  }
  const manuals = (mans.data ?? []).map((m) => {
    const list = byManual.get(m.id) ?? [];
    return { ...m, current: list[0] ?? null, versionsCount: list.length };
  });
  return NextResponse.json({ categories: cats.data ?? [], manuals });
}

/** POST /api/admin/manuals — registra um manual novo (arquivo já enviado ao Storage pela URL assinada). */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Informe o título do manual" }, { status: 400 });
  if (typeof b.path !== "string" || !(await assertUploaded(b.path))) {
    return NextResponse.json({ error: "Arquivo não encontrado. Envie de novo." }, { status: 400 });
  }
  const size = Number(b.size) || null;
  if (size && size > MANUAL_MAX_BYTES) return NextResponse.json({ error: "Arquivo acima de 25 MB" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: last } = await supabase.from("manuals").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const staff = await getStaffSession().catch(() => null);

  const { data: manual, error } = await supabase
    .from("manuals")
    .insert({
      title,
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 500) : null,
      category_id: typeof b.categoryId === "string" && b.categoryId ? b.categoryId : null,
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !manual) return NextResponse.json({ error: "Falha ao salvar o manual" }, { status: 500 });

  const { error: vErr } = await supabase.from("manual_versions").insert({
    manual_id: manual.id,
    version_label: typeof b.versionLabel === "string" && b.versionLabel.trim() ? b.versionLabel.trim().slice(0, 20) : "v1.0",
    storage_path: b.path,
    file_name: String(b.fileName ?? "manual").slice(0, 200),
    mime_type: typeof b.mime === "string" ? b.mime.slice(0, 100) : null,
    size_bytes: size,
    uploaded_by: staff?.name ?? null,
  });
  if (vErr) {
    await supabase.from("manuals").delete().eq("id", manual.id);
    return NextResponse.json({ error: "Falha ao registrar o arquivo" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: manual.id });
}
