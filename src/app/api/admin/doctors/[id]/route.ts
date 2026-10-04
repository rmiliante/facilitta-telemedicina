import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseConsultFee, professionalFields, migrationWarning, RQE_MIGRATION_WARNING, stripMissingColumn } from "@/lib/doctorFields";
import { audit } from "@/lib/audit";

/** PATCH /api/admin/doctors/:id — ativar/desativar ou redefinir senha. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.active === "boolean") update.active = body.active;
  if (typeof body.password === "string" && body.password.length >= 6) {
    update.password_hash = await bcrypt.hash(body.password, 10);
  }
  if (typeof body.specialtyId === "string") update.specialty_id = body.specialtyId || null;
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.email === "string" && body.email.trim()) update.email = body.email.trim().toLowerCase(); // o login compara em minúsculas
  if (typeof body.memedEmail === "string") update.memed_email = body.memedEmail.trim().toLowerCase() || null;
  Object.assign(update, professionalFields(body));
  if ("consultFee" in body) {
    const fee = parseConsultFee(body.consultFee);
    if (fee === undefined) {
      return NextResponse.json({ error: "Valor por consulta inválido (ex: 70,00)" }, { status: 400 });
    }
    update.consult_fee = fee;
  }
  // Valor que a Facilitta recebe da prefeitura por consulta deste médico.
  if ("contractFee" in body) {
    const received = parseConsultFee(body.contractFee);
    if (received === undefined) {
      return NextResponse.json({ error: "Valor que recebemos por consulta inválido (ex: 120,00)" }, { status: 400 });
    }
    update.contract_fee = received;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let { error } = await supabase.from("doctors").update(update).eq("id", id);
  const notSaved: Parameters<typeof migrationWarning>[0] = [];
  let stripped;
  while ((stripped = stripMissingColumn(update, error))) {
    if (stripped.hadValue) notSaved.push(stripped.column);
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: RQE_MIGRATION_WARNING }, { status: 500 });
    }
    ({ error } = await supabase.from("doctors").update(update).eq("id", id));
  }

  if (error) {
    return NextResponse.json({ error: "Falha ao atualizar médico" }, { status: 500 });
  }
  // Consultas já concluídas que ficaram sem valor (cadastro em branco na
  // época) passam a usar o valor informado agora. As que já tinham valor
  // continuam com o valor combinado na data.
  if (typeof update.contract_fee === "number") {
    await supabase
      .from("appointments")
      .update({ contract_fee: update.contract_fee })
      .eq("doctor_id", id)
      .eq("status", "concluido")
      .is("contract_fee", null);
  }
  await audit("staff", {
    action: "alterar_medico",
    entity: "medico",
    entityId: id,
    details: { campos: Object.keys(update).map((c) => (c === "password_hash" ? "senha" : c)) },
  });
  return NextResponse.json({ ok: true, warning: migrationWarning(notSaved) });
}

/** DELETE /api/admin/doctors/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("doctors").delete().eq("id", id);
  if (!error) await audit("staff", { action: "excluir_medico", entity: "medico", entityId: id });

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível excluir: esse médico já tem consultas vinculadas. Desative-o em vez de excluir." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
