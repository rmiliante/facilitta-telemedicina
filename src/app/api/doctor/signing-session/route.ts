import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json({ ...(await refreshSigningState(doctor)), accountEmail: session.email });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/doctor/signing-session — envia o pedido de aprovação pro app
 * VIDaaS do médico. Body opcional { email, password } da conta de
 * assinatura: com ele, o CRM vai gravado na assinatura (a senha não é guardada).
 */
export async function POST(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const account =
    typeof body?.email === "string" && body.email.trim() && typeof body?.password === "string" && body.password
      ? { email: body.email as string, password: body.password as string }
      : undefined;
  try {
    const doctor = await getSigningDoctor(session.doctorId);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
    let state;
    try {
      state = await startSigningSession(doctor, account);
    } catch (err) {
      if (account && err instanceof PrescreveError && (err.status === 401 || err.status === 400)) {
        return NextResponse.json(
          { error: `Não foi possível entrar na conta de assinatura: ${err.message}. Confira o e-mail e a senha (e se o e-mail de confirmação já foi aberto).` },
          { status: 401 }
        );
      }
      throw err;
    }
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
