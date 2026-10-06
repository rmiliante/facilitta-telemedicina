import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** POST /api/admin/manuals/reorder — { ids: [...] } na nova ordem. */
export async function POST(req: NextRequest) {
  const { ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== "string")) {
    return NextResponse.json({ error: "Lista inválida" }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from("manuals").update({ sort_order: i + 1 }).eq("id", ids[i]);
    if (error) return NextResponse.json({ error: "Falha ao salvar a ordem" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
