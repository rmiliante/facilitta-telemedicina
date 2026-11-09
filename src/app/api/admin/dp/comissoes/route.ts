import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";

export const dynamic = "force-dynamic";

interface VendaIn { venda_id?: unknown; cliente?: unknown; status?: unknown; vendedor?: unknown; adesao_paga_em?: unknown }

const txt = (v: unknown, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** GET /api/admin/dp/comissoes — configuração (valor por venda, vendedor) e vendas já importadas. */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const db = getSupabaseAdmin();
  const [c, v] = await Promise.all([
    db.from("dp_settings").select("value").eq("key", "comissao_venda").maybeSingle(),
    db.from("dp_comissao_vendas").select("competencia, venda_id, cliente, status, vendedor, adesao_paga_em, conta, motivo").order("competencia", { ascending: false }).limit(5000),
  ]);
  if (v.error) return NextResponse.json({ error: v.error.message }, { status: 500 });
  return NextResponse.json({ config: (c.data as { value?: unknown } | null)?.value ?? null, vendas: v.data ?? [] });
}

/** POST /api/admin/dp/comissoes — importa as vendas de uma competência, aplica a regra e grava a comissão do colaborador. */
export async function POST(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { competencia?: string; employee_id?: string; valor_por_venda?: number; vendedor?: string; vendas?: VendaIn[] } | null;
  const competencia = b?.competencia ?? "";
  const valor = Number(b?.valor_por_venda);
  const vendedor = txt(b?.vendedor).toLowerCase();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return NextResponse.json({ error: "Competência inválida" }, { status: 400 });
  if (!b?.employee_id || !vendedor || !Number.isFinite(valor) || valor < 0 || valor > 100000) return NextResponse.json({ error: "Informe colaborador, vendedor e valor por venda" }, { status: 400 });
  if (!Array.isArray(b.vendas) || b.vendas.length === 0 || b.vendas.length > 5000) return NextResponse.json({ error: "Nenhuma venda para importar" }, { status: 400 });

  const rows = b.vendas.map((x) => {
    const id = txt(x.venda_id, 40).replace(/^#/, "");
    const status = txt(x.status, 40);
    const v = txt(x.vendedor, 120).toLowerCase();
    const d = txt(x.adesao_paga_em, 10);
    const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(d);
    const stOk = ["adesao paga", "ativo"].includes(norm(status));
    let motivo: string | null = null;
    if (!id) motivo = "Sem número da venda";
    else if (!v.includes(vendedor)) motivo = "Outro vendedor";
    else if (!stOk) motivo = "Status não conta";
    else if (!dataOk) motivo = "Sem data de adesão paga";
    else if (!d.startsWith(competencia)) motivo = "Adesão paga fora do mês";
    return { competencia, venda_id: id, cliente: txt(x.cliente, 120), status, vendedor: v, adesao_paga_em: dataOk ? d : null, conta: motivo === null, motivo };
  }).filter((r) => r.venda_id);

  const db = getSupabaseAdmin();
  const del = await db.from("dp_comissao_vendas").delete().eq("competencia", competencia);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  const ins = await db.from("dp_comissao_vendas").upsert(rows);
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });

  const qtd = rows.filter((r) => r.conta).length;
  const total = Math.round(qtd * valor * 100) / 100;
  const cm = await db.from("dp_comissoes").upsert({ employee_id: b.employee_id, competencia, valor: total, updated_at: new Date().toISOString() });
  if (cm.error) return NextResponse.json({ error: cm.error.message }, { status: 500 });
  await db.from("dp_settings").upsert({ key: "comissao_venda", value: { valor, vendedor, employee_id: b.employee_id }, updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true, qtd, total, desconsideradas: rows.length - qtd });
}
