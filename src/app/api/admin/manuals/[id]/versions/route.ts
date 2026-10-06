import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getStaffSession } from "@/lib/auth";
import { assertUploaded, MANUAL_MAX_BYTES, nextVersionLabel } from "@/lib/manuals";

/** GET /api/admin/manuals/:id/versions — histórico (mais recente primeiro) + rótulo sugerido da próxima. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await getSupabaseAdmin()
    .from("manual_versions")
    .select("id, version_label, notes, file_name, size_bytes, uploaded_by, uploaded_at")
    .eq("manual_id", id)
    .order("uploaded_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Falha ao carregar as versões" }, { status: 500 });
  return NextResponse.json({ versions: data ?? [], suggested: nextVersionLabel(data?.[0]?.version_label, data?.length ?? 0) });
}

/** POST /api/admin/manuals/:id/versions — nova versão (arquivo já no Storage). A anterior fica no histórico. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (typeof b.path !== "string" || !(await assertUploaded(b.path))) {
    return NextResponse.json({ error: "Arquivo não encontrado. Envie de novo." }, { status: 400 });
  }
  const size = Number(b.size) || null;
  if (size && size > MANUAL_MAX_BYTES) return NextResponse.json({ error: "Arquivo acima de 25 MB" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: prev } = await supabase.from("manual_versions").select("version_label").eq("manual_id", id).order("uploaded_at", { ascending: false });
  const label =
    typeof b.versionLabel === "string" && b.versionLabel.trim()
      ? b.versionLabel.trim().slice(0, 20)
      : nextVersionLabel(prev?.[0]?.version_label, prev?.length ?? 0);
  const staff = await getStaffSession().catch(() => null);

  const { error } = await supabase.from("manual_versions").insert({
    manual_id: id,
    version_label: label,
    notes: typeof b.notes === "string" && b.notes.trim() ? b.notes.trim().slice(0, 500) : null,
    storage_path: b.path,
    file_name: String(b.fileName ?? "manual").slice(0, 200),
    mime_type: typeof b.mime === "string" ? b.mime.slice(0, 100) : null,
    size_bytes: size,
    uploaded_by: staff?.name ?? null,
  });
  if (error) return NextResponse.json({ error: "Falha ao registrar a nova versão" }, { status: 500 });
  await supabase.from("manuals").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true });
}
