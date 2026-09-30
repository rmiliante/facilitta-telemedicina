import { NextRequest } from "next/server";
import { buildAttendanceHistory } from "@/lib/attendanceHistory";

/**
 * GET /api/admin/historico — histórico de atendimentos com filtros e
 * totais do período (from, to, doctorId, specialtyId, tipo, status, q).
 * Só o admin acessa (o proxy não libera esta rota para a atendente).
 */
export async function GET(req: NextRequest) {
  return buildAttendanceHistory(req.nextUrl.searchParams);
}
