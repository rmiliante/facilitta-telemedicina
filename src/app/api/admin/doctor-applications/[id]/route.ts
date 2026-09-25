import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { APPLICATION_STATUSES, DOCTOR_APPLICATIONS_BUCKET } from "@/lib/doctorApplications";

/** PATCH /api/admin/doctor-applications/:id — muda o status (novo/em_avaliacao/aprovado/recusado). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (
    typeof body.status !== "string" ||
    !(APPLICATION_STATUSES as readonly string[]).includes(body.status)
  ) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("doctor_applications")
    .update({
      status: body.status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: typeof body.reviewedBy === "string" ? body.reviewedBy : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Falha ao atualizar candidatura" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/doctor-applications/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("doctor_applications")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("doctor_applications").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Falha ao excluir candidatura" }, { status: 500 });
  }

  if (existing?.photo_path) {
    await supabase.storage.from(DOCTOR_APPLICATIONS_BUCKET).remove([existing.photo_path]);
  }

  return NextResponse.json({ ok: true });
}
