// Cliente da Prescreve — Assinatura Digital White Label.
// Docs: portal do parceiro → White Label → Manual de Integração.
//
// Fluxo: abre uma "sessão de assinatura" com o CPF do médico (o app
// VIDaaS dele recebe um pedido e ele aprova no celular; a sessão vale
// 8h), depois cada PDF é assinado com essa sessão (1 crédito por PDF).
// O PDF assinado fica disponível só por 3h na Prescreve — por isso a
// gente baixa na hora e guarda no nosso Storage.

const DEFAULT_BASE_URL = "https://api.prescreve.com";

function baseUrl() {
  return (process.env.PRESCREVE_API_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function wlKey() {
  const key = process.env.PRESCREVE_WL_KEY;
  if (!key) {
    console.error("Assinatura digital: falta a variável PRESCREVE_WL_KEY no servidor.");
    throw new PrescreveError("Assinatura digital indisponível: configuração pendente no servidor.", 500);
  }
  return key;
}

export class PrescreveError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        "X-WL-Key": wlKey(),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof PrescreveError) throw err;
    throw new PrescreveError("Não foi possível falar com o serviço de assinatura. Tente de novo.");
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      (typeof data.detail === "string" && data.detail) ||
      `Erro do serviço de assinatura (${res.status})`;
    console.error("Prescreve WL erro", res.status, path, message);
    throw new PrescreveError(message, res.status === 402 ? 402 : res.status === 401 || res.status === 400 || res.status === 409 ? res.status : 502);
  }
  return data as T;
}

export type SessionStatus = "awaiting_approval" | "active" | "expired" | string;

export interface SessionInfo {
  session_id: string;
  provider?: string;
  status: SessionStatus;
  expires_in?: number;
  message?: string;
}

/**
 * Abre sessão de assinatura (VIDaaS tem prioridade: dispara o push no app).
 * Com `accessToken` (login da conta de assinatura do médico), a sessão
 * sai "com OID": o CRM vai gravado dentro da assinatura de cada PDF.
 * Sem ele, usa só o CPF (assinatura válida, sem o CRM embutido).
 */
export function startSession(cpf: string, accessToken?: string): Promise<SessionInfo> {
  return call<SessionInfo>("/wl/v1/sessions/start", {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: JSON.stringify(accessToken ? {} : { cpf: cpf.replace(/\D/g, "") }),
  });
}

export interface RegisterInput {
  nome: string;
  cpf: string;
  email: string;
  senha: string;
  tipo_registro: string; // ex: CRM-BA
  num_registro: string;
}

/** Cria a conta de assinatura do médico (habilita o CRM na assinatura). A Prescreve envia e-mail de confirmação. */
export function registerProfessional(input: RegisterInput): Promise<{ message?: string; profissional_uuid?: string; is_upgrade?: boolean }> {
  return call("/wl/v1/professionals/register", {
    method: "POST",
    body: JSON.stringify({
      nome: input.nome,
      cpf: input.cpf.replace(/\D/g, ""),
      email: input.email,
      senha: input.senha,
      confirmacao_senha: input.senha,
      profissao: "Médico",
      tipo_registro: input.tipo_registro,
      num_registro: input.num_registro.replace(/\D/g, ""),
    }),
  });
}

/** Login na conta de assinatura; devolve o token usado só pra abrir a sessão (não é guardado). */
export async function loginProfessional(email: string, senha: string): Promise<string> {
  const data = await call<{ access_token?: string }>("/wl/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), senha }),
  });
  if (!data.access_token) throw new PrescreveError("Não foi possível entrar na conta de assinatura.", 401);
  return data.access_token;
}

/** Consulta a sessão (usado em polling enquanto o médico não aprova no app). */
export function getSession(sessionId: string): Promise<SessionInfo> {
  return call<SessionInfo>(`/wl/v1/sessions/${encodeURIComponent(sessionId)}`);
}

export interface SignResult {
  request_id: string;
  document_uuid?: string;
  download_url: string;
  expires_at?: string;
  provider?: string;
  signed_sha256?: string;
  credits_remaining?: number;
}

/** Assina um PDF (debita 1 crédito). */
export function signPdf(sessionId: string, pdf: Uint8Array): Promise<SignResult> {
  return call<SignResult>("/wl/v1/sign", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, pdf_b64: Buffer.from(pdf).toString("base64") }),
  });
}

/** Baixa o PDF assinado (o link da Prescreve expira em 3h). */
export async function downloadSigned(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new PrescreveError("PDF assinado, mas falhou ao baixar o arquivo do serviço de assinatura.");
  return new Uint8Array(await res.arrayBuffer());
}

export interface CertificateDiscovery {
  can_sign: boolean;
  providers: string[];
  preferred_provider?: string | null;
  vidaas?: boolean;
  birdid?: boolean;
  message?: string | null;
}

/** Verifica se o CPF tem certificado em nuvem (VIDaaS/BirdID) disponível pra assinar. */
export function discoverCertificate(cpf: string): Promise<CertificateDiscovery> {
  return call<CertificateDiscovery>(`/wl/v1/professionals/discover?cpf=${encodeURIComponent(cpf.replace(/\D/g, ""))}`);
}

/** Saldo de créditos de assinatura (1 crédito = 1 documento assinado). */
export async function getCreditBalance(): Promise<number | null> {
  const data = await call<Record<string, unknown>>("/wl/v1/billing/balance");
  for (const key of ["balance", "credits", "saldo", "credits_remaining", "available", "remaining"]) {
    const v = data[key];
    if (typeof v === "number") return v;
    if (v && typeof v === "object") {
      for (const inner of ["available", "remaining", "balance", "credits"]) {
        const iv = (v as Record<string, unknown>)[inner];
        if (typeof iv === "number") return iv;
      }
    }
  }
  return null;
}
