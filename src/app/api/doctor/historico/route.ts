import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { buildAttendanceHistory } from "@/lib/attendanceHistory";

/**
 * GET /api/doctor/historico — o mesmo relatório do admin, mas travado no
 * médico logado: o doctorId vem da sessão, nunca da URL, então ele não
 * consegue ver consultas de outro médico.
 */
export async function GET(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return buildAttendanceHistory(req.nextUrl.searchParams, session.doctorId);
}
