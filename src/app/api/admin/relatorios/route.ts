import { NextRequest, NextResponse } from "next/server";
import { currentMonthSaoPaulo, isMonthKey } from "@/lib/finance";
import { monthlyReport } from "@/lib/reports";

/**
 * GET /api/admin/relatorios?month=YYYY-MM — relatório mensal (cota por
 * especialidade, comparecimento, faltas, produção por médico, faltas
 * recorrentes). Só o admin acessa (o proxy não libera para a atendente).
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? currentMonthSaoPaulo();
  if (!isMonthKey(month)) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  try {
    return NextResponse.json(await monthlyReport(month));
  } catch (err) {
    console.error("Erro ao montar relatório:", err);
    return NextResponse.json({ error: "Falha ao montar o relatório" }, { status: 500 });
  }
}
