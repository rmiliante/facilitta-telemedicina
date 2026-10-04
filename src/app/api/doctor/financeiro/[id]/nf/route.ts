import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getPayout } from "@/lib/finance";
import { financeErrorResponse, handlePayoutUpload } from "@/lib/financeApi";

/** POST multipart { file } — o médico anexa (ou troca) a nota fiscal do próprio fechamento. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  try {
    const payout = await getPayout(id);
    // Fechamento de outro médico responde como inexistente.
    if (!payout || payout.doctor_id !== session.doctorId) {
      return NextResponse.json({ error: "Fechamento não encontrado" }, { status: 404 });
    }
  } catch (err) {
    return financeErrorResponse(err, "Falha ao enviar a nota fiscal");
  }
  return handlePayoutUpload(req, id, "nf", session.name, "doctor");
}
