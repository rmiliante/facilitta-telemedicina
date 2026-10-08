import { NextRequest, NextResponse } from "next/server";
import { currentMonthSaoPaulo, isMonthKey } from "@/lib/finance";
import { monthlyReport } from "@/lib/reports";
import { currentStaffRole } from "@/lib/auth";
import { canSeePatients } from "@/lib/permissions";

/**
 * GET /api/admin/relatorios?month=YYYY-MM — relatório mensal (cota por
 * especialidade, comparecimento, faltas, produção por médico, faltas
 * recorrentes). Liberado para Master, Gestor, Financeiro e Prefeitura
 * (lib/permissions.ts). A lista de pacientes faltosos só sai para quem
 * pode ver pacientes.
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? currentMonthSaoPaulo();
  if (!isMonthKey(month)) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  try {
    const report = await monthlyReport(month);
    if (!canSeePatients(await currentStaffRole())) {
      return NextResponse.json({ ...report, faltososRecorrentes: null, detalhe: null });
    }
    return NextResponse.json(report);
  } catch (err) {
    console.error("Erro ao montar relatório:", err);
    return NextResponse.json({ error: "Falha ao montar o relatório" }, { status: 500 });
  }
}
