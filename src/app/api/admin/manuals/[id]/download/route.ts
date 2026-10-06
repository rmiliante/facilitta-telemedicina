import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MANUALS_BUCKET } from "@/lib/manuals";

/** GET /api/admin/manuals/:id/download?version=<id> — baixa a versão atual (ou a indicada). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versionId = new URL(req.url).searchParams.get("version");
  const supabase = getSupabaseAdmin();
  let q = supabase.from("manual_versions").select("storage_path, file_name").eq("manual_id", id);
  q = versionId ? q.eq("id", versionId) : q.order("uploaded_at", { ascending: false }).limit(1);
  const { data } = await q;
  const v = data?.[0];
  if (!v) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(MANUALS_BUCKET).createSignedUrl(v.storage_path, 60, { download: v.file_name });
  if (error || !signed) return NextResponse.json({ error: "Falha ao gerar o link de download" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
