import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MANUALS_BUCKET } from "@/lib/manuals";

/** GET /api/doctor/manuals/:id/download — só manuais da categoria "Médicos" (sessão de médico exigida pelo proxy). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: manual } = await supabase
    .from("manuals")
    .select("id, manual_categories!inner(name)")
    .eq("id", id)
    .eq("manual_categories.name", "Médicos")
    .maybeSingle();
  if (!manual) return NextResponse.json({ error: "Manual não encontrado" }, { status: 404 });
  const { data } = await supabase
    .from("manual_versions")
    .select("storage_path, file_name")
    .eq("manual_id", id)
    .order("uploaded_at", { ascending: false })
    .limit(1);
  const v = data?.[0];
  if (!v) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(MANUALS_BUCKET).createSignedUrl(v.storage_path, 60, { download: v.file_name });
  if (error || !signed) return NextResponse.json({ error: "Falha ao gerar o link de download" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
