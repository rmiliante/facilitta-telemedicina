import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSigningDoctor } from "@/lib/doctorSigning";
import { listCertificates } from "@/lib/certificateProviders";
import { discoverCertificate, PrescreveError, registerProfessional } from "@/lib/prescreve";

/** Nome sem "Dr./Dra." na frente — a conta de assinatura pede o nome civil completo. */
function civilName(name: string) {
  return name.replace(/^\s*(dr|dra|doutor|doutora)\.?\s+/i, "").trim();
}

/**
 * GET /api/doctor/signing-account — dados que vão pra conta de assinatura
 * (vindos do cadastro na Facilitta) e se o CPF tem certificado em nuvem.
 */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const doctor = await getSigningDoctor(session.doctorId);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
    let certificate: { status: string; providers: string[]; preferred?: string | null } = { status: "sem_cpf", providers: [] };
    if (doctor.cpf && doctor.cpf.replace(/\D/g, "").length === 11) {
      try {
        const info = await discoverCertificate(doctor.cpf);
        certificate = { status: info.can_sign ? "ok" : "nenhum", providers: info.providers ?? [], preferred: info.preferred_provider ?? null };
      } catch {
        certificate = { status: "erro", providers: [] };
      }
    }
    return NextResponse.json({
      name: civilName(doctor.name),
      cpf: doctor.cpf,
      crm: doctor.crm,
      crmUf: doctor.crm_uf,
      rqe: doctor.rqe,
      email: session.email,
      certificate,
      // Certificados que a Facilitta aceita + o escolhido pelo médico (null = ainda não escolheu).
      catalog: listCertificates().map((c) => ({ id: c.id, label: c.label, appName: c.appName, hint: c.hint, approval: c.approval })),
      selected: doctor.signing_provider,
    });
  } catch (err) {
    const message = err instanceof PrescreveError ? err.message : "Falha ao carregar os dados";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/doctor/signing-account — cria a conta de assinatura (uma vez só)
 * com os dados do cadastro. Body: { email, password }. A senha vai direto
 * pro serviço de assinatura e não é guardada aqui.
 */
export async function POST(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres" }, { status: 400 });
  }

  try {
    const doctor = await getSigningDoctor(session.doctorId);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
    if (!doctor.cpf || !doctor.crm || !doctor.crm_uf) {
      return NextResponse.json(
        { error: "Falta CPF, CRM ou UF no seu cadastro. Peça para a administração completar." },
        { status: 400 }
      );
    }
    const result = await registerProfessional({
      nome: civilName(doctor.name),
      cpf: doctor.cpf,
      email,
      senha: password,
      tipo_registro: `CRM-${doctor.crm_uf.toUpperCase()}`,
      num_registro: doctor.crm,
    });
    return NextResponse.json({ ok: true, email, message: result.message ?? null });
  } catch (err) {
    if (err instanceof PrescreveError) {
      const already = /j[aá] (existe|cadastrad)|already|duplicad/i.test(err.message);
      return NextResponse.json(
        {
          error: already
            ? "Já existe uma conta de assinatura com esses dados. Use a senha dela na hora de autorizar (ou recupere a senha pelo e-mail)."
            : err.message,
          alreadyExists: already,
        },
        { status: already ? 409 : err.status >= 400 && err.status < 500 ? err.status : 502 }
      );
    }
    console.error("Erro ao criar conta de assinatura:", err);
    return NextResponse.json({ error: "Falha ao criar a conta de assinatura" }, { status: 500 });
  }
}
