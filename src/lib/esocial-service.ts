import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { normalizeRole, STAFF_ROLE_HEADER } from "@/lib/permissions";
import { esocialConfig } from "@/lib/esocial";
import { carregarCredencial, assinarEvento } from "@/lib/esocial-sign";
import { buildEvent, EMPRESA_PADRAO, TIPOS, type Colaborador, type Empresa, type EsocialTipo } from "@/lib/esocial-xml";

export async function masterOnly() {
  const role = normalizeRole((await headers()).get(STAFF_ROLE_HEADER));
  return role === "master" || role === null;
}

export async function loadEmpresa(): Promise<Empresa> {
  const { data } = await getSupabaseAdmin().from("dp_settings").select("value").eq("key", "esocial_empresa").maybeSingle();
  const v = ((data as { value?: Partial<Empresa> } | null)?.value ?? {}) as Partial<Empresa>;
  return { ...EMPRESA_PADRAO, ...v };
}

export type GerarResult =
  | { ok: true; evento: Record<string, unknown> }
  | { ok: false; status: number; error: string; missing?: string[] };

/** Monta, assina e guarda o evento (status "assinado"). Não envia nada ao eSocial. */
export async function gerarEvento(
  tipo: EsocialTipo,
  opts: { employeeId?: string | null; params?: Record<string, string>; operacao?: "inclusao" | "alteracao" },
): Promise<GerarResult> {
  if (!(tipo in TIPOS)) return { ok: false, status: 400, error: "Tipo de evento inválido" };
  const cfg = esocialConfig();
  if (cfg.ambiente !== "1" && cfg.ambiente !== "2") return { ok: false, status: 409, error: "ESOCIAL_AMBIENTE deve ser 1 (produção) ou 2 (testes)." };
  if (!cfg.pfx || !cfg.senha || !cfg.cnpj) return { ok: false, status: 409, error: "Certificado, senha ou CNPJ não configurados." };

  let cred;
  try {
    cred = carregarCredencial(cfg.pfx, cfg.senha);
  } catch (e) {
    return { ok: false, status: 500, error: `Não foi possível abrir o certificado: ${e instanceof Error ? e.message : "erro"}` };
  }
  if (cred.validTo.getTime() < Date.now()) return { ok: false, status: 409, error: "Certificado digital vencido." };

  const supabase = getSupabaseAdmin();
  let emp: Colaborador | undefined;
  if (!["S-1000", "S-1005", "S-1010", "S-1020", "S-1299"].includes(tipo)) {
    if (!opts.employeeId) return { ok: false, status: 400, error: "Colaborador não informado" };
    const { data } = await supabase
      .from("dp_employees")
      .select("id, full_name, cpf, role_title, admitted_at, salary, esocial")
      .eq("id", opts.employeeId)
      .maybeSingle();
    if (!data) return { ok: false, status: 404, error: "Colaborador não encontrado" };
    emp = data as Colaborador;
  }

  const { count } = await supabase.from("dp_esocial_events").select("id", { count: "exact", head: true });
  const empresa = await loadEmpresa();
  const built = buildEvent(
    tipo,
    { cnpj: cfg.cnpj, now: new Date(), seq: (count ?? 0) + 1, tpAmb: cfg.ambiente === "1" ? "1" : "2", empresa, operacao: opts.operacao },
    emp,
    opts.params ?? {},
  );
  if (!built.ok) return { ok: false, status: 422, error: "Faltam dados para gerar o evento", missing: built.missing };

  const signed = assinarEvento(built.xml, built.tag, built.id, cred);
  const { data: row, error } = await supabase
    .from("dp_esocial_events")
    .insert({
      employee_id: emp?.id ?? null,
      tipo,
      grupo: built.grupo,
      status: "assinado",
      ambiente: cfg.ambiente,
      event_id: built.id,
      params: { ...(opts.params ?? {}), ...(opts.operacao ? { operacao: opts.operacao } : {}) },
      xml: signed,
    })
    .select("id, employee_id, tipo, grupo, status, ambiente, event_id, params, xml, protocolo, resposta, created_at, sent_at")
    .single();
  if (error) return { ok: false, status: 500, error: error.message };
  await audit("staff", {
    action: "dp_esocial_gerar",
    entity: "dp_esocial_events",
    entityId: (row as { id: string }).id,
    details: { tipo, eventId: built.id, colaborador: emp?.full_name ?? null, ambiente: cfg.ambiente },
  });
  return { ok: true, evento: row as Record<string, unknown> };
}
