// Cliente da API de Prescrições da Prescreve (v4.2) — receitas controladas
// (azul, amarela, controle especial) com numeração SNCR automática.
// Docs: portal do parceiro → API Prescrições → Manual de Integração.
//
// É um cliente SEPARADO da Assinatura Digital White Label (prescreve.ts):
// a White Label continua assinando receita simples, exames e laudos.
//
// Fluxo por médico:
//   1) Abrir sessão de assinatura (8h): VIDaaS (aprova no app), BirdID (OTP)
//      ou A1 (.pfx + senha). Uma vez a cada 8 horas.
//   2) Conferir saldo de numeração SNCR do médico (o médico pede mais no Gov.br).
//   3) Emitir (até 10 documentos do mesmo paciente por envio).
//   Se faltar numeração para qualquer documento do envio, NADA é emitido
//   (erro 409 SNCR_SEM_NUMERACAO).
//
// Chave: PRESCREVE_API_KEY (produção). Flag: PRESCREVE_PRESCRICOES_ATIVO=1.

const DEFAULT_BASE_URL = "https://api.prescreve.com";
const API = "/public/v4.2";

export function prescricoesAtivo(): boolean {
  return process.env.PRESCREVE_PRESCRICOES_ATIVO === "1";
}

function baseUrl(): string {
  return (process.env.PRESCREVE_API_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function apiKey(): string {
  const key = process.env.PRESCREVE_API_KEY;
  if (!key) {
    console.error("Prescrições: falta a variável PRESCREVE_API_KEY no servidor.");
    throw new PrescricoesError("Receita controlada indisponível: configuração pendente no servidor.", 500);
  }
  return key;
}

export class PrescricoesError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 502, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Query = Record<string, string | number | undefined>;

interface CallOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Query;
  bearer?: string;
}

async function call<T>(path: string, opts: CallOptions = {}): Promise<T> {
  const method = opts.method || "GET";
  let url = baseUrl() + (path.startsWith("/backend") ? "" : API) + path;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += "?" + s;
  }
  const headers: Record<string, string> = { "X-API-Key": apiKey() };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.bearer) headers["Authorization"] = "Bearer " + opts.bearer;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    console.error("Prescrições: falha de rede", method, path, e);
    throw new PrescricoesError("Não foi possível falar com a Prescreve. Tente de novo.", 502);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      (typeof data.detail === "string" && data.detail) ||
      "Erro da Prescreve (" + res.status + ")";
    const code =
      (typeof data.code === "string" && data.code) ||
      (typeof data.error_code === "string" && data.error_code) ||
      undefined;
    console.error("Prescrições erro", res.status, path, code || "", message);
    throw new PrescricoesError(message, res.status, code);
  }
  return data as T;
}

// ───────────────────────── Login do médico (sem senha) ─────────────────────────
// Usamos o código por e-mail (OTP): a Facilitta NÃO guarda senha da Prescreve.

export interface PerfilPrescreve {
  uuid: string;
  cpf: string;
  nome: string;
  num_registro?: string;
  tipo_registro?: string;
}

export interface LoginResult {
  access_token: string;
  refresh_token?: string;
  profile: PerfilPrescreve;
}

export function otpRequest(email: string) {
  return call<{ success: boolean; message: string }>("/auth/profissional/otp/request", {
    method: "POST",
    body: { email },
  });
}

export function otpVerify(email: string, token: string) {
  return call<LoginResult>("/auth/profissional/otp/verify", {
    method: "POST",
    body: { email, token },
  });
}

export function me(bearer: string) {
  return call<Record<string, unknown>>("/me", { bearer });
}

// ───────────────────────── Sessão de assinatura (8h) ─────────────────────────

export type ProviderCertificado = "local" | "birdid" | "vidaas";

export interface ProfissionalRef {
  uuid: string;
  cpf: string; // só dígitos
}

export interface SessaoInfo {
  connected?: boolean;
  status?: string;
  provider?: string;
  expires_in?: number;
}

/** local: senha = senha do .pfx; birdid: senha = OTP do app; vidaas: use vidaasIniciar. */
export function conectarCertificado(p: ProfissionalRef, provider: ProviderCertificado, senha?: string) {
  return call<SessaoInfo>("/certificado/conectar", {
    method: "POST",
    body: { profissional_uuid: p.uuid, profissional_cpf: p.cpf, provider, senha },
  });
}

export function statusCertificado(uuid: string) {
  return call<SessaoInfo>("/certificado/status", { query: { profissional_uuid: uuid } });
}

export function encerrarSessao(uuid: string) {
  return call<Record<string, unknown>>("/certificado/sessao", {
    method: "DELETE",
    query: { profissional_uuid: uuid },
  });
}

/** Dispara o pedido no app VIDaaS. A resposta traz o "code" usado em vidaasAguardar. */
export function vidaasIniciar(p: ProfissionalRef) {
  return call<Record<string, unknown> & { code?: string }>("/certificado/vidaas/iniciar", {
    method: "POST",
    body: { profissional_uuid: p.uuid, profissional_cpf: p.cpf },
  });
}

/** Long-poll: chame a cada poucos segundos até status "connected". */
export function vidaasAguardar(code: string) {
  return call<SessaoInfo>("/certificado/vidaas/aguardar", { query: { code } });
}

// ───────────────────────── Numeração SNCR ─────────────────────────
// NRA amarela (A1/A2/A3) · NRB azul (B1) · NRB2 azul (B2) · NRR retinoides (C2)
// NRT talidomida (C3) · RCE controle especial (C1/C5) · RET antimicrobiano/GLP-1

export type TipoNumeracao = "NRA" | "NRB" | "NRB2" | "NRR" | "NRT" | "RCE" | "RET";

export interface SaldoSncr {
  profissional_uuid: string;
  saldo: Record<TipoNumeracao, number>;
}

export function saldoSncr(bearer: string) {
  return call<SaldoSncr>("/sncr/saldo", { bearer });
}

/** Link de uso único (5 min) para o MÉDICO pedir numeração no Gov.br. */
export function sncrLoginUrl(bearer: string) {
  return call<{ login_url: string }>("/sncr/login-url", { bearer });
}

// ───────────────────────── Emissão ─────────────────────────

export type TipoControle =
  | "C1" | "C5"                // controle especial (RCE)
  | "antimicrobiana" | "GLP1"  // retenção (RET)
  | "A1" | "A2" | "A3"         // notificação amarela (NRA)
  | "B1" | "B2"                // notificação azul (NRB / NRB2)
  | "C2"                       // retinoides (NRR, exige CRM)
  | "C3";                      // talidomida (NRT, exige CRM)

/** Tipo de numeração consumida por cada tipo de controle. */
export const NUMERACAO_POR_CONTROLE: Record<TipoControle, TipoNumeracao> = {
  C1: "RCE", C5: "RCE",
  antimicrobiana: "RET", GLP1: "RET",
  A1: "NRA", A2: "NRA", A3: "NRA",
  B1: "NRB", B2: "NRB2",
  C2: "NRR", C3: "NRT",
};

/** Notificação A, B, B2 e Retinoides (C2) aceitam exatamente 1 medicamento. */
export function aceitaSoUmMedicamento(t?: TipoControle): boolean {
  return t === "A1" || t === "A2" || t === "A3" || t === "B1" || t === "B2" || t === "C2";
}

export interface MedicamentoItem {
  /** Nome e dosagem, ex.: "Clonazepam 2mg". */
  nome_medicamento: string;
  /** Só dígitos, como texto (ex.: "30"). "30 comprimidos" é recusado. */
  quantidade: string;
  concentracao?: string;        // ex.: "2 mg" (obrigatório na prática para NRA/NRB)
  forma_farmaceutica?: string;  // ex.: "Comprimido"
  controlado?: boolean;
  lista?: "ATB" | "GLP1";
}

export interface DocReceita {
  tipo: "receita";
  medicamentos: MedicamentoItem[];
  informacoes?: string;
  /** Vazio/ausente = receita simples, sem numeração SNCR. */
  tipo_controle?: TipoControle;
}

export interface DocPedidoExame {
  tipo: "pedido_exame";
  exames: { nome_exame: string; observacoes?: string; codigo?: string; descricao?: string }[];
  informacoes?: string;
}

export interface DocLivre {
  tipo: "documento";
  tipo_documento: string; // título no PDF, ex.: "Atestado Médico"
  informacoes: string;    // HTML simples (p, strong, br, ul, li)
}

export type DocumentoEmissao = DocReceita | DocPedidoExame | DocLivre;

export interface EmitirInput {
  profissional: ProfissionalRef;
  profissional_endereco: string;
  paciente_nome: string;
  paciente_cpf: string;
  paciente_telefone: string; // DDD + número, só dígitos
  paciente_email?: string;
  paciente_endereco?: string;
  paciente_data_nascimento?: string; // DD/MM/AAAA (obrigatório com C2)
  paciente_sexo?: string;
  documentos: DocumentoEmissao[]; // até 10
  /** Valida o envio inteiro sem emitir nem gastar numeração. */
  dry_run?: boolean;
}

export interface DocumentoEmitido {
  indice: number;
  tipo: string;
  tipo_documento: string;
  documento_id: number;
  token: string;
  s3_url?: string;
  numero_sncr?: string | null;
}

export interface EmitirResult {
  emissao_uuid?: string;
  emissao_token?: string;
  documentos: DocumentoEmitido[];
}

export function emitir(input: EmitirInput) {
  if (input.documentos.length < 1 || input.documentos.length > 10) {
    throw new PrescricoesError("Envie de 1 a 10 documentos por vez.", 400);
  }
  for (const d of input.documentos) {
    if (d.tipo === "receita" && aceitaSoUmMedicamento(d.tipo_controle) && d.medicamentos.length !== 1) {
      throw new PrescricoesError("Notificação A, B e retinoides aceitam 1 medicamento por documento.", 400);
    }
  }
  return call<EmitirResult>("/emitir", {
    method: "POST",
    body: {
      profissional_uuid: input.profissional.uuid,
      profissional_cpf: input.profissional.cpf,
      profissional_endereco: input.profissional_endereco,
      paciente_nome: input.paciente_nome,
      paciente_cpf: input.paciente_cpf,
      paciente_telefone: input.paciente_telefone,
      paciente_email: input.paciente_email,
      paciente_endereco: input.paciente_endereco,
      paciente_data_nascimento: input.paciente_data_nascimento,
      paciente_sexo: input.paciente_sexo,
      documentos: input.documentos,
      dry_run: input.dry_run ? true : undefined,
    },
  });
}

export function cancelarDocumento(uuid: string, token: string) {
  return call<Record<string, unknown>>("/cancelar", {
    method: "POST",
    body: { profissional_uuid: uuid, token },
  });
}

export function renovarReceita(p: ProfissionalRef, token: string) {
  return call<EmitirResult>("/renovar", {
    method: "POST",
    body: { profissional_uuid: p.uuid, profissional_cpf: p.cpf, token },
  });
}

/** URL temporária do PDF assinado (baixe e guarde no nosso Storage). */
export function urlDocumento(token: string, bearer: string) {
  return call<{ url: string; expires: number }>("/documentos/presigned", {
    query: { token },
    bearer,
  });
}

export function listarDocumentos(bearer: string, limit = 50, offset = 0) {
  return call<{ documentos: Record<string, unknown>[] }>("/documentos_profissional", {
    query: { limit, offset },
    bearer,
  });
}

// ───────────────────────── Conta do profissional (cadastro e validação do CRM) ─────────────────────────
// O cadastro cria só a conta (sem documento). A validação do CRM é uma etapa separada,
// feita com o token do próprio médico (login por código no e-mail).

export interface CadastroProfissionalInput {
  nome: string;
  email: string;
  senha: string;
  cpf: string;      // só dígitos
  uf: string;       // UF do CRM, ex.: "PR"
  numeroCrm: string;
}

export function cadastrarProfissional(i: CadastroProfissionalInput) {
  return call<{ message?: string }>("/backend/v4.1/profissionais/cadastro", {
    method: "POST",
    body: {
      nome: i.nome,
      email: i.email,
      senha: i.senha,
      confirmacao_senha: i.senha,
      cpf: i.cpf,
      profissao: "Médico",
      tipo_registro: "CRM-" + i.uf.toUpperCase(),
      num_registro: i.numeroCrm,
    },
  });
}

/** Envia a foto/PDF da carteira do conselho. Validação automática (pode ir para revisão manual). */
export async function validarDocumentoProfissional(bearer: string, file: Blob, fileName: string) {
  const form = new FormData();
  form.append("file", file, fileName);
  let res: Response;
  try {
    res = await fetch(baseUrl() + "/backend/v2/auth/profissional/validacao", {
      method: "POST",
      headers: { "X-API-Key": apiKey(), Authorization: "Bearer " + bearer },
      body: form,
      cache: "no-store",
    });
  } catch (e) {
    console.error("Prescrições: falha de rede na validação do CRM", e);
    throw new PrescricoesError("Não foi possível falar com a Prescreve. Tente de novo.", 502);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      "Erro da Prescreve (" + res.status + ")";
    throw new PrescricoesError(message, res.status);
  }
  const d = (data.data && typeof data.data === "object" ? data.data : data) as Record<string, unknown>;
  const flag = (x: unknown) => x === true || x === 1 || (typeof x === "string" && ["true", "sim", "aprovado", "validado", "approved", "valid"].includes(x.trim().toLowerCase()));
  const validado = [d.validado, d.valido, d.valid, d.aprovado, d.approved, d.is_valid, d.status].some(flag);
  console.log("Prescrições validação CRM: retorno", JSON.stringify(data));
  const motivoRaw = d.motivo ?? d.mensagem ?? d.message ?? d.reason;
  return { validado, motivo: typeof motivoRaw === "string" ? motivoRaw : "", raw: data };
}
