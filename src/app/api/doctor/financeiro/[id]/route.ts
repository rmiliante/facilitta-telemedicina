import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getPayout, payoutAppointments, withFileUrls } from "@/lib/finance";
import { financeErrorResponse } from "@/lib/financeApi";

/** GET /api/doctor/financeiro/:id — consultas de um fechamento do próprio médico. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  try {
    const payout = await getPayout(id);
    // Fechamento de outro médico responde como inexistente.
    if (!payout || payout.doctor_id !== session.doctorId) {
      return NextResponse.json({ error: "Fechamento não encontrado" }, { status: 404 });
    }
    const [appointments, withUrls] = await Promise.all([payoutAppointments(id), withFileUrls(payout)]);
    return NextResponse.json({ payout: withUrls, appointments });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao carregar o fechamento");
  }
}
