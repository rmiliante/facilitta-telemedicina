import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseReceiptInput } from "@/lib/cashflow";
import { financeErrorResponse } from "@/lib/financeApi";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };
const ID_RE = /^[0-9a-f-]{36}$/i;

/** PATCH — altera valor, datas ou observação; { receivedAt } marca como recebido. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Recebimento inválido" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  try {
    const patch = parseReceiptInput(body, true);
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada para alterar" }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("cash_receipts").update(patch).eq("id", id);
    if (error) throw error;
    await audit("staff", { action: "alterar_recebimento", entity: "recebimento", entityId: id, details: patch });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao alterar o recebimento");
  }
}

/** DELETE — exclui um lançamento de recebimento. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Recebimento inválido" }, { status: 400 });
  try {
    const { error } = await getSupabaseAdmin().from("cash_receipts").delete().eq("id", id);
    if (error) throw error;
    await audit("staff", { action: "excluir_recebimento", entity: "recebimento", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao excluir o recebimento");
  }
}
