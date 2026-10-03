import { NextRequest, NextResponse } from "next/server";
import { currentMonthSaoPaulo, isMonthKey, monthOverview } from "@/lib/finance";
import { financeErrorResponse } from "@/lib/financeApi";

/**
 * GET /api/admin/financeiro?month=YYYY-MM — repasse dos médicos no mês:
 * consultas em aberto (ainda sem fechamento) e fechamentos.
 * Só o admin acessa (o proxy não libera /api/admin/financeiro para a atendente).
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? currentMonthSaoPaulo();
  if (!isMonthKey(month)) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  try {
    return NextResponse.json(await monthOverview(month));
  } catch (err) {
    return financeErrorResponse(err, "Falha ao carregar o financeiro");
  }
}
