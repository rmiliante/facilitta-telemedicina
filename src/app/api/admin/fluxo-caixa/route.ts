import { NextResponse } from "next/server";
import { cashflowOverview } from "@/lib/cashflow";
import { financeErrorResponse } from "@/lib/financeApi";

/** GET /api/admin/fluxo-caixa — entradas, saídas, saldo acumulado e fechamento por mês. */
export async function GET() {
  try {
    return NextResponse.json(await cashflowOverview());
  } catch (err) {
    return financeErrorResponse(err, "Falha ao carregar o fluxo de caixa");
  }
}
