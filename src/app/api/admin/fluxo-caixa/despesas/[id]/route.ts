import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseExpenseInput } from "@/lib/cashflowProjection";
import { financeErrorResponse } from "@/lib/financeApi";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };
const ID_RE = /^[0-9a-f-]{36}$/i;

/** PATCH — altera a despesa; { paidAt } marca uma despesa única como paga. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Despesa inválida" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  try {
    const patch = parseExpenseInput(body, true);
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada para alterar" }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("cash_expenses").update(patch).eq("id", id);
    if (error) throw error;
    await audit("staff", { action: "alterar_despesa", entity: "despesa", entityId: id, details: patch });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao alterar a despesa");
  }
}

/** DELETE — exclui a despesa (e todas as suas repetições). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Despesa inválida" }, { status: 400 });
  try {
    const { error } = await getSupabaseAdmin().from("cash_expenses").delete().eq("id", id);
    if (error) throw error;
    await audit("staff", { action: "excluir_despesa", entity: "despesa", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao excluir a despesa");
  }
}
