import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { esocialConfig } from "@/lib/esocial";
import { digits, type Empresa } from "@/lib/esocial-xml";
import { loadEmpresa, masterOnly } from "@/lib/esocial-service";

/** GET — parâmetros do empregador para o S-1000 e ambiente configurado. */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const cfg = esocialConfig();
  return NextResponse.json({
    empresa: await loadEmpresa(),
    ambiente: cfg.ambiente,
    cnpj: cfg.cnpj ? `${cfg.cnpj.slice(0, 2)}.***.***/****-${cfg.cnpj.slice(-2)}` : null,
  });
}

/** PATCH — salva parâmetros do empregador (nunca guarda certificado nem senha). */
export async function PATCH(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const atual = await loadEmpresa();
  const s = (v: unknown, max = 20) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const novo: Empresa = {
    classTrib: "classTrib" in b ? s(b.classTrib, 2) : atual.classTrib,
    indPorte: "indPorte" in b ? (s(b.indPorte, 1) === "S" ? "S" : "") : atual.indPorte,
    indDesFolha: "indDesFolha" in b ? s(b.indDesFolha, 1) : atual.indDesFolha,
    indOptRegEletron: "indOptRegEletron" in b ? s(b.indOptRegEletron, 1) : atual.indOptRegEletron,
    iniValid: "iniValid" in b ? s(b.iniValid, 7) : atual.iniValid,
    cnpjSind: "cnpjSind" in b ? digits(s(b.cnpjSind, 20)) : atual.cnpjSind,
    cnaePrep: "cnaePrep" in b ? digits(s(b.cnaePrep, 12)).slice(0, 7) : atual.cnaePrep,
    aliqRat: "aliqRat" in b ? (["1", "2", "3"].includes(s(b.aliqRat, 1)) ? s(b.aliqRat, 1) : "") : atual.aliqRat,
  };
  if (!/^\d{4}-\d{2}$/.test(novo.iniValid)) return NextResponse.json({ error: "Início da validade deve ser AAAA-MM" }, { status: 400 });
  if (novo.cnpjSind && novo.cnpjSind.length !== 14) return NextResponse.json({ error: "CNPJ do sindicato deve ter 14 dígitos" }, { status: 400 });
  const { error } = await getSupabaseAdmin()
    .from("dp_settings")
    .upsert({ key: "esocial_empresa", value: novo, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit("staff", { action: "dp_esocial_empresa", entity: "dp_settings", entityId: "esocial_empresa", details: { campos: Object.keys(b) } });
  return NextResponse.json({ empresa: novo });
}
