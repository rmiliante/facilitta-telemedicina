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
    throw new PrescreveError(message, res.status === 402 ? 402 : 502);
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

/** Abre sessão de assinatura pelo CPF (VIDaaS tem prioridade: dispara o push no app). */
export function startSession(cpf: string): Promise<SessionInfo> {
  return call<SessionInfo>("/wl/v1/sessions/start", {
    method: "POST",
    body: JSON.stringify({ cpf: cpf.replace(/\D/g, "") }),
  });
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
