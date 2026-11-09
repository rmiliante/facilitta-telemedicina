import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  conectarCertificado,
  encerrarSessao,
  otpRequest,
  otpVerify,
  PrescricoesError,
  prescricoesAtivo,
  saldoSncr,
  sncrLoginUrl,
  statusCertificado,
  vidaasAguardar,
  vidaasIniciar,
} from "@/lib/prescrevePrescricoes";

/**
 * Conta do médico na Prescreve (API de Prescrições) para receitas controladas:
 * vincular (código por e-mail), abrir sessão do certificado (8h) e numeração SNCR.
 * Tudo atrás da flag PRESCREVE_PRESCRICOES_ATIVO. Não guarda senha nenhuma.
 */

const digits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

async function loadDoctor(id: string) {
  const { data } = await getSupabaseAdmin()
    .from("doctors")
    .select("id, name, email, cpf, crm, crm_uf, prescreve_uuid")
    .eq("id", id)
    .maybeSingle();
  return data as {
    id: string; name: string; email: string | null; cpf: string | null;
    crm: string | null; crm_uf: string | null; prescreve_uuid: string | null;
  } | null;
}

function fail(err: unknown) {
  if (err instanceof PrescricoesError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
  }
  console.error("Prescreve (conta do médico):", err);
  return NextResponse.json({ error: "Falha ao falar com a Prescreve" }, { status: 500 });
}

export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!prescricoesAtivo()) return NextResponse.json({ ativo: false });
  const doctor = await loadDoctor(session.doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
  const base = {
    ativo: true,
    cpfOk: digits(doctor.cpf).length === 11,
    vinculado: !!doctor.prescreve_uuid,
    emailPadrao: doctor.email,
    conectado: false,
    provider: null as string | null,
  };
  if (!doctor.prescreve_uuid) return NextResponse.json(base);
  try {
    const st = await statusCertificado(doctor.prescreve_uuid);
    const conectado = st.connected === true || st.status === "connected" || st.status === "active";
    return NextResponse.json({ ...base, conectado, provider: st.provider ?? null, expiresIn: st.expires_in ?? null });
  } catch (err) {
    if (err instanceof PrescricoesError && err.status < 500) return NextResponse.json(base);
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!prescricoesAtivo()) return NextResponse.json({ error: "Recurso desativado" }, { status: 404 });
  const doctor = await loadDoctor(session.doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, string | boolean | undefined>;
  const action = String(body.action || "");
  const cpf = digits(doctor.cpf);

  try {
    if (action === "otp_pedir") {
      const email = String(body.email || doctor.email || "").trim();
      if (!email) return NextResponse.json({ error: "Informe o e-mail do cadastro na Prescreve" }, { status: 400 });
      await otpRequest(email);
      return NextResponse.json({ ok: true, email });
    }

    if (action === "otp_validar") {
      const email = String(body.email || "").trim();
      const codigo = String(body.codigo || "").trim();
      if (!email || !codigo) return NextResponse.json({ error: "Informe e-mail e código" }, { status: 400 });
      const login = await otpVerify(email, codigo);
      // Segurança: o CPF do cadastro na Prescreve precisa ser o do médico logado.
      if (cpf.length !== 11 || digits(login.profile.cpf) !== cpf) {
        return NextResponse.json(
          { error: "O CPF desse cadastro na Prescreve não confere com o seu CPF na Facilitta." },
          { status: 403 }
        );
      }
      await getSupabaseAdmin()
        .from("doctors")
        .update({ prescreve_uuid: login.profile.uuid, prescreve_validado_em: new Date().toISOString() })
        .eq("id", doctor.id);
      let saldo: Record<string, number> | null = null;
      let sncrUrl: string | null = null;
      try { saldo = (await saldoSncr(login.access_token)).saldo; } catch { /* opcional */ }
      if (body.pedirLink) {
        try { sncrUrl = (await sncrLoginUrl(login.access_token)).login_url; } catch { /* opcional */ }
      }
      return NextResponse.json({ ok: true, saldo, sncrUrl });
    }

    if (!doctor.prescreve_uuid) {
      return NextResponse.json({ error: "Vincule sua conta da Prescreve primeiro" }, { status: 409 });
    }
    const ref = { uuid: doctor.prescreve_uuid, cpf };

    if (action === "certificado") {
      const provider = body.provider === "birdid" ? "birdid" : "local";
      const senha = String(body.senha || "");
      if (!senha) return NextResponse.json({ error: "Informe a senha/código" }, { status: 400 });
      const st = await conectarCertificado(ref, provider, senha);
      return NextResponse.json({ ok: true, ...st });
    }
    if (action === "vidaas_iniciar") {
      const r = await vidaasIniciar(ref);
      return NextResponse.json({ ok: true, code: r.code ?? null });
    }
    if (action === "vidaas_aguardar") {
      const code = String(body.code || "");
      if (!code) return NextResponse.json({ error: "Falta o código" }, { status: 400 });
      const st = await vidaasAguardar(code);
      const conectado = st.connected === true || st.status === "connected" || st.status === "active";
      return NextResponse.json({ ok: true, conectado, status: st.status ?? null });
    }
    if (action === "encerrar") {
      await encerrarSessao(doctor.prescreve_uuid);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err) {
    return fail(err);
  }
}
