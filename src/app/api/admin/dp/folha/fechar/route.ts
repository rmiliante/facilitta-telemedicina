import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.round(v * 100) / 100 : null);

/** GET /api/admin/dp/folha/fechar — folhas já fechadas. */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { data, error } = await getSupabaseAdmin().from("dp_folhas").select("employee_id, competencia, salario, comissao, inss, irrf, fgts, liquido, pagamento, status, gerado_em").order("competencia", { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folhas: data ?? [] });
}

/** POST /api/admin/dp/folha/fechar — fecha (grava) a folha real da competência. Não envia nada ao eSocial. */
export async function POST(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { competencia?: string; pagamento?: string; linhas?: Record<string, unknown>[] } | null;
  if (!b?.competencia || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.competencia)) return NextResponse.json({ error: "Competência inválida" }, { status: 400 });
  if (!Array.isArray(b.linhas) || b.linhas.length === 0) return NextResponse.json({ error: "Nenhum colaborador na folha" }, { status: 400 });
  const pagamento = typeof b.pagamento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.pagamento) ? b.pagamento : null;
  const rows = [];
  for (const l of b.linhas) {
    const salario = num(l.salario), comissao = num(l.comissao), inss = num(l.inss), irrf = num(l.irrf), fgts = num(l.fgts), liquido = num(l.liquido);
    if (typeof l.employee_id !== "string" || salario === null || comissao === null || inss === null || irrf === null || fgts === null || liquido === null) return NextResponse.json({ error: "Valores da folha inválidos" }, { status: 400 });
    rows.push({ employee_id: l.employee_id, competencia: b.competencia, salario, comissao, inss, irrf, fgts, liquido, pagamento, status: "fechada", gerado_em: new Date().toISOString() });
  }
  const { error } = await getSupabaseAdmin().from("dp_folhas").upsert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, folhas: rows.length });
}
