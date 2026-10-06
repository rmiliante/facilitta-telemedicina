import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** POST /api/admin/manuals/categories — { name } */
export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({}));
  const n = typeof name === "string" ? name.trim().slice(0, 60) : "";
  if (!n) return NextResponse.json({ error: "Informe o nome da categoria" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data: last } = await supabase.from("manual_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("manual_categories").insert({ name: n, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Já existe uma categoria com esse nome" : "Falha ao criar a categoria" }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ ok: true });
}
