import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { doctorStatement } from "@/lib/finance";
import { financeErrorResponse } from "@/lib/financeApi";

/** GET /api/doctor/financeiro — extrato do médico logado (o id vem da sessão). */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    return NextResponse.json(await doctorStatement(session.doctorId));
  } catch (err) {
    return financeErrorResponse(err, "Falha ao carregar o financeiro");
  }
}
