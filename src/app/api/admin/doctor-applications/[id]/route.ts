import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { APPLICATION_STATUSES, BRAZIL_STATES, DOCTOR_APPLICATIONS_BUCKET } from "@/lib/doctorApplications";

/** PATCH /api/admin/doctor-applications/:id — muda o status (novo/em_avaliacao/aprovado/recusado). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Edição dos dados cadastrais (sem mudar o status).
  if (body.fields && typeof body.fields === "object") {
    const f = body.fields as Record<string, unknown>;
    const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const name = txt(f.name, 200);
    const email = txt(f.email, 200).toLowerCase();
    if (!name) return NextResponse.json({ error: "Informe o nome" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    const upper = (v: unknown) => txt(v, 4).toUpperCase();
    const state = upper(f.state);
    const crmUf = upper(f.crm_uf);
    const ufs = BRAZIL_STATES as readonly string[];
    if ((state && !ufs.includes(state)) || (crmUf && !ufs.includes(crmUf))) {
      return NextResponse.json({ error: "UF inválida" }, { status: 400 });
    }
    const { error: upErr } = await getSupabaseAdmin()
      .from("doctor_applications")
      .update({
        name,
        email,
        whatsapp: txt(f.whatsapp, 40) || null,
        city: txt(f.city, 120) || null,
        state: state || null,
        profession: txt(f.profession, 80) || "Médico(a)",
        specialty: txt(f.specialty, 120) || null,
        crm: txt(f.crm, 40) || null,
        crm_uf: crmUf || null,
      })
      .eq("id", id);
    if (upErr) return NextResponse.json({ error: "Falha ao salvar alterações" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

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
