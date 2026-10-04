import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseConsultFee } from "@/lib/doctorFields";
import { CONTRACT_FEE_WARNING } from "@/lib/contract";

/** PATCH /api/admin/specialties/:id — editar nome, cota mensal e/ou valor por consulta (contrato). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }
  if (typeof body.monthlyQuota === "number" && body.monthlyQuota > 0) {
    update.monthly_quota = body.monthlyQuota;
  }
  if ("contractFee" in body) {
    const fee = parseConsultFee(body.contractFee);
    if (fee === undefined) {
      return NextResponse.json({ error: "Valor por consulta inválido (ex: 120,00)" }, { status: 400 });
    }
    update.contract_fee = fee;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let { error } = await supabase.from("specialties").update(update).eq("id", id);
  // Sem a migração do valor: salva o resto e avisa que o valor não foi gravado.
  let warning: string | undefined;
  if (error && /contract_fee/.test(error.message ?? "")) {
    if (update.contract_fee !== null) warning = CONTRACT_FEE_WARNING;
    delete update.contract_fee;
    ({ error } = Object.keys(update).length
      ? await supabase.from("specialties").update(update).eq("id", id)
      : { error: null });
  }

  if (error) {
    return NextResponse.json(
      { error: "Falha ao atualizar especialidade (talvez o nome já exista)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, warning });
}

/** DELETE /api/admin/specialties/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("specialties").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      {
        error:
          "Não foi possível excluir: essa especialidade tem médicos ou consultas vinculados.",
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
