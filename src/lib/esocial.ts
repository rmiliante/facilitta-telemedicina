import https from "node:https";
import { createSecureContext } from "node:tls";
import type { TLSSocket } from "node:tls";

/**
 * eSocial — conexão com os web services oficiais (SOAP, TLS com certificado e-CNPJ A1).
 * Etapa 1: só verificação de conexão em PRODUÇÃO RESTRITA (ambiente de teste, sem valor legal).
 * Nunca devolve a senha nem o conteúdo do certificado.
 */

const HOST_RESTRITA = "webservices.producaorestrita.esocial.gov.br";
const HOST_PROD_ENVIO = "webservices.envio.esocial.gov.br";
const HOST_PROD_CONSULTA = "webservices.consulta.esocial.gov.br";
const hostDe = (cfg: { ambiente: string | null }, tipo: "envio" | "consulta") =>
  cfg.ambiente === "1" ? (tipo === "envio" ? HOST_PROD_ENVIO : HOST_PROD_CONSULTA) : HOST_RESTRITA;
const PATH_CONSULTA = "/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc";
const SOAP_ACTION =
  "http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_1_0/ServicoConsultarLoteEventos/ConsultarLoteEventos";

export interface EsocialConfig {
  ambiente: string | null;
  cnpj: string | null;
  hasPfx: boolean;
  hasSenha: boolean;
  pfx: Buffer | null;
  senha: string | null;
}

export function esocialConfig(): EsocialConfig {
  const b64 = (process.env.ESOCIAL_CERT_PFX_BASE64 ?? "").replace(/\s+/g, "");
  const senha = process.env.ESOCIAL_CERT_SENHA ?? "";
  return {
    ambiente: process.env.ESOCIAL_AMBIENTE?.trim() || null,
    cnpj: (process.env.ESOCIAL_CNPJ ?? "").replace(/\D/g, "") || null,
    hasPfx: b64.length > 0,
    hasSenha: senha.length > 0,
    pfx: b64 ? Buffer.from(b64, "base64") : null,
    senha: senha || null,
  };
}

export interface ProbeResult {
  ok: boolean;
  httpStatus?: number;
  certificate?: { subject: string; validTo: string; daysToExpire: number | null };
  responseSnippet?: string;
  error?: string;
}

/** Consulta um protocolo inexistente só para provar que a conexão com certificado funciona. */
export function probeConsulta(cfg: EsocialConfig): Promise<ProbeResult> {
  return new Promise((resolve) => {
    if (!cfg.pfx || !cfg.senha) return resolve({ ok: false, error: "Certificado ou senha não configurados" });
    const body =
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_1_0">` +
      `<soapenv:Header/><soapenv:Body><v1:ConsultarLoteEventos><v1:consulta>` +
      `<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0"><consultaLoteEventos><protocoloEnvio>1.2.202001.0000000000000000001</protocoloEnvio></consultaLoteEventos></eSocial>` +
      `</v1:consulta></v1:ConsultarLoteEventos></soapenv:Body></soapenv:Envelope>`;
    let cert: ProbeResult["certificate"];
    let settled = false;
    const done = (r: ProbeResult) => {
      if (!settled) {
        settled = true;
        resolve({ ...r, certificate: r.certificate ?? cert });
      }
    };
    try {
      const req = https.request(
        {
          host: hostDe(cfg, "consulta"),
          path: PATH_CONSULTA,
          method: "POST",
          pfx: cfg.pfx,
          passphrase: cfg.senha,
          minVersion: "TLSv1.2",
          timeout: 20000,
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: SOAP_ACTION,
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () =>
            done({
              ok: true,
              httpStatus: res.statusCode,
              responseSnippet: Buffer.concat(chunks).toString("utf8").replace(/\s+/g, " ").slice(0, 400),
            }),
          );
        },
      );
      req.on("socket", (s) => {
        (s as TLSSocket).once("secureConnect", () => {
          const c = (s as TLSSocket).getCertificate() as { subject?: { CN?: string }; valid_to?: string };
          if (c && c.valid_to) {
            const ms = new Date(c.valid_to).getTime() - Date.now();
            cert = {
              subject: c.subject?.CN ?? "",
              validTo: c.valid_to,
              daysToExpire: Number.isFinite(ms) ? Math.floor(ms / 86400000) : null,
            };
          }
        });
      });
      req.on("timeout", () => {
        req.destroy();
        done({ ok: false, error: "Tempo esgotado ao falar com o eSocial" });
      });
      req.on("error", (e) => done({ ok: false, error: e.message }));
      req.write(body);
      req.end();
    } catch (e) {
      done({ ok: false, error: e instanceof Error ? e.message : "Falha ao conectar" });
    }
  });
}

/** Diagnóstico sem segredos: tamanho, formato e se o Node consegue abrir o certificado com a senha. */
export function diagnosticoCertificado(cfg: EsocialConfig) {
  const bruto = process.env.ESOCIAL_CERT_PFX_BASE64 ?? "";
  const semEspaco = bruto.replace(/\s+/g, "");
  const senhaBruta = process.env.ESOCIAL_CERT_SENHA ?? "";
  const d: Record<string, unknown> = {
    caracteresNoValor: bruto.length,
    caracteresInvalidosBase64: (semEspaco.match(/[^A-Za-z0-9+/=]/g) ?? []).length,
    comecaComAspas: /^["'\u201c\u2018]/.test(bruto.trim()),
    primeiros3: semEspaco.slice(0, 3),
    bytesDecodificados: cfg.pfx ? cfg.pfx.length : 0,
    inicioHex: cfg.pfx ? cfg.pfx.subarray(0, 4).toString("hex") : null,
    senhaTamanho: senhaBruta.length,
    senhaTemEspacoNasPontas: senhaBruta !== senhaBruta.trim(),
  };
  try {
    if (!cfg.pfx) throw new Error("sem certificado");
    createSecureContext({ pfx: cfg.pfx, passphrase: cfg.senha ?? "" });
    d.abreComSenha = true;
  } catch (e) {
    d.abreComSenha = false;
    d.erroAoAbrir = e instanceof Error ? e.message : String(e);
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Envio de lote e consulta de resultado (SOMENTE produção restrita)   */
/* ------------------------------------------------------------------ */

const PATH_ENVIO = "/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc";
const ACTION_ENVIO =
  "http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_0/ServicoEnviarLoteEventos/EnviarLoteEventos";

function soapPost(cfg: EsocialConfig, path: string, action: string, body: string): Promise<{ httpStatus: number; body: string }> {
  return new Promise((resolve, reject) => {
    if (!cfg.pfx || !cfg.senha) return reject(new Error("Certificado ou senha não configurados"));
    if (cfg.ambiente !== "1" && cfg.ambiente !== "2") return reject(new Error("ESOCIAL_AMBIENTE deve ser 1 (produção) ou 2 (produção restrita/testes)"));
    const req = https.request(
      {
        host: hostDe(cfg, path === PATH_ENVIO ? "envio" : "consulta"),
        path,
        method: "POST",
        pfx: cfg.pfx,
        passphrase: cfg.senha,
        minVersion: "TLSv1.2",
        timeout: 60000,
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: action, "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ httpStatus: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Tempo esgotado ao falar com o eSocial"));
    });
    req.on("error", (e) => reject(e));
    req.write(body);
    req.end();
  });
}

const SOAP_OPEN = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_0"><soapenv:Header/><soapenv:Body>`;
const SOAP_CLOSE = `</soapenv:Body></soapenv:Envelope>`;

export async function enviarLote(cfg: EsocialConfig, loteXml: string) {
  const body = `${SOAP_OPEN}<v1:EnviarLoteEventos><v1:loteEventos>${loteXml}</v1:loteEventos></v1:EnviarLoteEventos>${SOAP_CLOSE}`;
  if (Buffer.byteLength(body) > 750 * 1024) throw new Error("Lote acima do limite de 750 KB");
  return soapPost(cfg, PATH_ENVIO, ACTION_ENVIO, body);
}

export async function consultarLote(cfg: EsocialConfig, protocolo: string) {
  if (!/^[\d.]+$/.test(protocolo)) throw new Error("Protocolo inválido");
  const body =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_1_0">` +
    `<soapenv:Header/><soapenv:Body><v1:ConsultarLoteEventos><v1:consulta>` +
    `<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0"><consultaLoteEventos><protocoloEnvio>${protocolo}</protocoloEnvio></consultaLoteEventos></eSocial>` +
    `</v1:consulta></v1:ConsultarLoteEventos></soapenv:Body></soapenv:Envelope>`;
  return soapPost(cfg, PATH_CONSULTA, SOAP_ACTION, body);
}

const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const first = (xml: string, tag: string) => {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? unesc(m[1].trim()) : null;
};

export interface RetornoResumo {
  cdResposta: string | null;
  descResposta: string | null;
  protocoloEnvio: string | null;
  eventos: {
    id: string;
    cdResposta: string | null;
    descResposta: string | null;
    recibo: string | null;
    ocorrencias: { tipo: string | null; codigo: string | null; descricao: string | null; localizacao: string | null }[];
  }[];
  fault: string | null;
}

/** Resume a resposta SOAP do eSocial (envio ou consulta) em campos simples. */
export function resumirRetorno(xml: string): RetornoResumo {
  const fault = /<(?:\w+:)?Fault[\s>]/.test(xml) ? first(xml, "faultstring") ?? "Falha SOAP" : null;
  const status = first(xml, "status") ?? "";
  const eventos: RetornoResumo["eventos"] = [];
  for (const m of xml.matchAll(/<evento\s+Id="([^"]+)"[^>]*>([\s\S]*?)<\/evento>/g)) {
    const blk = m[2];
    const proc = first(blk, "processamento") ?? blk;
    const ocorrencias = [...proc.matchAll(/<ocorrencia>([\s\S]*?)<\/ocorrencia>/g)].map((o) => ({
      tipo: first(o[1], "tipo"),
      codigo: first(o[1], "codigo"),
      descricao: first(o[1], "descricao"),
      localizacao: first(o[1], "localizacao"),
    }));
    eventos.push({
      id: m[1],
      cdResposta: first(proc, "cdResposta"),
      descResposta: first(proc, "descResposta"),
      recibo: first(blk, "nrRecibo"),
      ocorrencias,
    });
  }
  return {
    cdResposta: first(status, "cdResposta"),
    descResposta: first(status, "descResposta"),
    protocoloEnvio: first(xml, "protocoloEnvio"),
    eventos,
    fault,
  };
}
