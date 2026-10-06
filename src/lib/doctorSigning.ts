import { getSupabaseAdmin } from "@/lib/supabase";
import { getCertificate, type CertificateProvider } from "@/lib/certificateProviders";
import { getSession, loginProfessional, startSession, PrescreveError } from "@/lib/prescreve";

/**
 * Sessão de assinatura digital do médico (VIDaaS/BirdID via Prescreve).
 * Guardada no cadastro do médico: uma aprovação no app vale até 8h,
 * então ele aprova uma vez por plantão e assina quantas receitas precisar.
 */

export interface SigningDoctor {
  id: string;
  name: string;
  cpf: string | null;
  crm: string | null;
  crm_uf: string | null;
  rqe: string | null;
  endereco_profissional: string | null;
  specialty: string | null;
  prescreve_session_id: string | null;
  prescreve_session_status: string | null;
  prescreve_session_expires_at: string | null;
  /** Certificado escolhido pelo médico (vidaas, birdid...). null = ainda não escolheu. */
  signing_provider: string | null;
}

export interface SigningState {
  /** Médico tem CPF, CRM e UF cadastrados (sem isso não dá pra emitir). */
  ready: boolean;
  missing: string[];
  status: "none" | "awaiting_approval" | "active" | "expired";
  expiresAt: string | null;
  message?: string;
  /** Certificado em uso (null = ainda não definido). */
  provider?: { id: string; label: string; appName: string; approval: "push" | "otp" } | null;
}

export async function getSigningDoctor(doctorId: string): Promise<SigningDoctor | null> {
  const supabase = getSupabaseAdmin();
  const columns =
    "id, name, cpf, crm, crm_uf, rqe, endereco_profissional, memed_cpf, memed_crm, memed_uf, prescreve_session_id, prescreve_session_status, prescreve_session_expires_at, signing_provider, specialties(name)";
  const run = (cols: string) => supabase.from("doctors").select(cols).eq("id", doctorId).maybeSingle();
  let { data, error } = await run(columns);
  // Colunas novas (certificado escolhido, RQE/endereço): se ainda não existem no banco, segue sem elas.
  if (error?.code === "42703") ({ data, error } = await run(columns.replace(" signing_provider,", "")));
  if (error?.code === "42703") {
    ({ data, error } = await run(columns.replace(" signing_provider,", "").replace(" rqe, endereco_profissional,", "")));
  }

  if (error) {
    // 42703 = coluna não existe: migração da receita ainda não rodada.
    if (error.code === "42703") {
      throw new PrescreveError(
        "Receita digital ainda não configurada no banco. Avise a administração.",
        500
      );
    }
    throw new PrescreveError("Falha ao carregar o cadastro do médico", 500);
  }
  if (!data) return null;

  const d = data as unknown as Record<string, unknown> & { specialties: { name: string } | null };
  return {
    id: d.id as string,
    name: d.name as string,
    cpf: ((d.cpf as string | null) || (d.memed_cpf as string | null)) ?? null,
    crm: ((d.crm as string | null) || (d.memed_crm as string | null)) ?? null,
    crm_uf: ((d.crm_uf as string | null) || (d.memed_uf as string | null)) ?? null,
    rqe: (d.rqe as string | null) ?? null,
    endereco_profissional: (d.endereco_profissional as string | null) ?? null,
    specialty: d.specialties?.name ?? null,
    prescreve_session_id: (d.prescreve_session_id as string | null) ?? null,
    prescreve_session_status: (d.prescreve_session_status as string | null) ?? null,
    prescreve_session_expires_at: (d.prescreve_session_expires_at as string | null) ?? null,
    signing_provider: (d.signing_provider as string | null) ?? null,
  };
}

function providerInfo(p: CertificateProvider | null): SigningState["provider"] {
  return p ? { id: p.id, label: p.label, appName: p.appName, approval: p.approval } : null;
}

/** Guarda o certificado escolhido. Retorna false se a coluna ainda não existe no banco. */
export async function saveSigningProvider(doctorId: string, providerId: string): Promise<boolean> {
  const { error } = await getSupabaseAdmin().from("doctors").update({ signing_provider: providerId }).eq("id", doctorId);
  return !error;
}

function missingFields(doctor: SigningDoctor): string[] {
  const missing: string[] = [];
  if (!doctor.cpf || doctor.cpf.replace(/\D/g, "").length !== 11) missing.push("CPF");
  if (!doctor.crm) missing.push("CRM");
  if (!doctor.crm_uf) missing.push("UF do CRM");
  if (!doctor.endereco_profissional?.trim() && !process.env.RECEITA_ENDERECO) missing.push("endereço profissional");
  return missing;
}

async function saveSession(doctorId: string, sessionId: string | null, status: string | null, expiresInSec?: number) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("doctors")
    .update({
      prescreve_session_id: sessionId,
      prescreve_session_status: status,
      prescreve_session_expires_at:
        expiresInSec != null ? new Date(Date.now() + expiresInSec * 1000).toISOString() : null,
    })
    .eq("id", doctorId);
}

/** Estado atual da sessão; se estiver aguardando aprovação no app, consulta a Prescreve. */
export async function refreshSigningState(doctor: SigningDoctor): Promise<SigningState> {
  const missing = missingFields(doctor);
  const base = { ready: missing.length === 0, missing, provider: providerInfo(getCertificate(doctor.signing_provider)) };
  const expiresAt = doctor.prescreve_session_expires_at;
  const notExpired = expiresAt ? new Date(expiresAt).getTime() > Date.now() + 30_000 : false;

  if (!doctor.prescreve_session_id) return { ...base, status: "none", expiresAt: null };

  if (doctor.prescreve_session_status === "active") {
    return notExpired
      ? { ...base, status: "active", expiresAt }
      : { ...base, status: "expired", expiresAt: null };
  }

  if (doctor.prescreve_session_status === "awaiting_approval") {
    const info = await getSession(doctor.prescreve_session_id);
    if (info.status === "active") {
      await saveSession(doctor.id, doctor.prescreve_session_id, "active", info.expires_in ?? 8 * 60 * 60);
      return {
        ...base,
        status: "active",
        expiresAt: new Date(Date.now() + (info.expires_in ?? 8 * 60 * 60) * 1000).toISOString(),
      };
    }
    if (info.status === "awaiting_approval") return { ...base, status: "awaiting_approval", expiresAt: null };
    await saveSession(doctor.id, null, null);
    return { ...base, status: "expired", expiresAt: null, message: info.message ?? "Tempo de aprovação esgotado." };
  }

  return { ...base, status: "none", expiresAt: null };
}

/**
 * Dispara o pedido de aprovação no app VIDaaS do médico. Com e-mail e
 * senha da conta de assinatura, entra antes (CRM gravado na assinatura);
 * a senha só é usada aqui e não é guardada.
 */
export async function startSigningSession(
  doctor: SigningDoctor,
  account?: { email: string; password: string },
  otp?: string
): Promise<SigningState> {
  const missing = missingFields(doctor);
  const cert = getCertificate(doctor.signing_provider);
  const provider = providerInfo(cert);
  if (missing.length > 0) {
    return { ready: false, missing, status: "none", expiresAt: null, provider };
  }
  const token = account ? await loginProfessional(account.email, account.password) : undefined;
  // VIDaaS (ou sem escolha) segue o fluxo de sempre; outros certificados informam o provedor.
  const info = await startSession(
    doctor.cpf!,
    token,
    cert && cert.id !== "vidaas" ? { provider: cert.id, otp: cert.approval === "otp" ? otp : undefined } : undefined
  );
  if (info.status === "active") {
    await saveSession(doctor.id, info.session_id, "active", info.expires_in ?? 8 * 60 * 60);
    return {
      ready: true,
      missing: [],
      status: "active",
      expiresAt: new Date(Date.now() + (info.expires_in ?? 8 * 60 * 60) * 1000).toISOString(),
      provider,
    };
  }
  await saveSession(doctor.id, info.session_id, "awaiting_approval", info.expires_in ?? 180);
  return { ready: true, missing: [], status: "awaiting_approval", expiresAt: null, provider };
}

export async function clearSigningSession(doctorId: string) {
  await saveSession(doctorId, null, null);
}
