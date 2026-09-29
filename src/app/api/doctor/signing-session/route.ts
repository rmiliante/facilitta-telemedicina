import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSigningDoctor, refreshSigningState, startSigningSession } from "@/lib/doctorSigning";
import { PrescreveError } from "@/lib/prescreve";

function errorResponse(err: unknown) {
  if (err instanceof PrescreveError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("Erro na sessão de assinatura:", err);
  return NextResponse.json({ error: "Falha na sessão de assinatura" }, { status: 500 });
}

/**
 * GET /api/doctor/signing-session
 * Estado da assinatura digital do médico logado (pronto? sessão ativa?
 * aguardando aprovação no app VIDaaS?). Chamado em polling pela tela
 * enquanto o médico aprova no celular.
 */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const doctor = await getSigningDoctor(session.doctorId);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
    return NextResponse.json(await refreshSigningState(doctor));
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/doctor/signing-session — envia o pedido de aprovação pro app VIDaaS do médico. */
export async function POST() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const doctor = await getSigningDoctor(session.doctorId);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
    const state = await startSigningSession(doctor);
    if (!state.ready) {
      return NextResponse.json(
        { ...state, error: `Falta no cadastro do médico: ${state.missing.join(", ")}. Peça pra Admin completar.` },
        { status: 400 }
      );
    }
    return NextResponse.json(state);
  } catch (err) {
    return errorResponse(err);
  }
}
