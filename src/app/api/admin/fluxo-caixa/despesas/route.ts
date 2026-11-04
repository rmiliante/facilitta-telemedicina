import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseExpenseInput } from "@/lib/cashflowProjection";
import { financeErrorResponse } from "@/lib/financeApi";
import { audit } from "@/lib/audit";

/** POST — lança uma despesa operacional (única, mensal ou anual). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const row = parseExpenseInput(body, false);
    const staff = await getStaffSession();
    const { data, error } = await getSupabaseAdmin()
      .from("cash_expenses")
      .insert({ ...row, created_by: staff?.name ?? "Administração" })
      .select("id")
      .single();
    if (error) throw error;
    await audit("staff", { action: "criar_despesa", entity: "despesa", entityId: data.id, details: { descricao: row.description, valor: row.amount, repete: row.recurrence } });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao lançar a despesa");
  }
}
