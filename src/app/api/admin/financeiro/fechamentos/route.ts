import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { closeMonth, isMonthKey } from "@/lib/finance";
import { financeErrorResponse } from "@/lib/financeApi";

/** POST /api/admin/financeiro/fechamentos { doctorId, month } — fecha o mês do médico. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const doctorId = typeof body?.doctorId === "string" ? body.doctorId : "";
  if (!/^[0-9a-f-]{36}$/i.test(doctorId) || !isMonthKey(body?.month)) {
    return NextResponse.json({ error: "Informe o médico e o mês" }, { status: 400 });
  }
  const staff = await getStaffSession();
  try {
    const payout = await closeMonth(doctorId, body.month, staff?.name ?? "Administração");
    return NextResponse.json({ payout });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao fechar o mês");
  }
}
