import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseReceiptInput } from "@/lib/cashflow";
import { financeErrorResponse } from "@/lib/financeApi";
import { audit } from "@/lib/audit";

/** POST — lança um recebimento (recebido ou previsto) de um mês de consultas. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const row = parseReceiptInput(body, false);
    const staff = await getStaffSession();
    const { data, error } = await getSupabaseAdmin()
      .from("cash_receipts")
      .insert({ ...row, created_by: staff?.name ?? "Administração" })
      .select("id")
      .single();
    if (error) throw error;
    await audit("staff", { action: "criar_recebimento", entity: "recebimento", entityId: data.id, details: { mes: body.month, valor: row.amount } });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao lançar o recebimento");
  }
}
