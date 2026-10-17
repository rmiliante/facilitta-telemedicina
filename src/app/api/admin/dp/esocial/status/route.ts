import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { normalizeRole, STAFF_ROLE_HEADER } from "@/lib/permissions";
import { diagnosticoCertificado, esocialConfig, probeConsulta } from "@/lib/esocial";

/**
 * GET /api/admin/dp/esocial/status — confere variáveis e conexão com o eSocial
 * (somente produção restrita). Só Master. Não devolve segredos.
 */
export async function GET() {
  const role = normalizeRole((await headers()).get(STAFF_ROLE_HEADER));
  if (role !== "master" && role !== null) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const cfg = esocialConfig();
  const config = {
    ESOCIAL_AMBIENTE: cfg.ambiente,
    ESOCIAL_CNPJ: cfg.cnpj ? `${cfg.cnpj.slice(0, 2)}.***.***/****-${cfg.cnpj.slice(-2)}` : null,
    ESOCIAL_CERT_PFX_BASE64: cfg.hasPfx ? "definida" : "FALTA",
    ESOCIAL_CERT_SENHA: cfg.hasSenha ? "definida" : "FALTA",
  };
  if (cfg.ambiente !== "2") {
    return NextResponse.json({
      ok: false,
      config,
      error: "Nesta etapa só funciona em produção restrita: ESOCIAL_AMBIENTE deve ser 2.",
    });
  }
  const diagnostico = diagnosticoCertificado(cfg);
  const probe = await probeConsulta(cfg);
  return NextResponse.json({ config, diagnostico, ...probe });
}
