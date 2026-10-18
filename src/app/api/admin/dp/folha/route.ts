import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";

const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const comp = (v: unknown) => (typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null);
const money = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : null;
};
const text = (v: unknown, n = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

/** GET /api/admin/dp/folha — comissões informadas e guias (status/validação). */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const [c, g] = await Promise.all([
    supabase.from("dp_comissoes").select("employee_id, competencia, valor").limit(2000),
    supabase.from("dp_guias").select("competencia, tipo, valor, status, codigo, pago_em, contador_nome, contador_em, notes").limit(2000),
  ]);
  if (c.error) return NextResponse.json({ error: c.error.message }, { status: 500 });
  if (g.error) return NextResponse.json({ error: g.error.message }, { status: 500 });
  return NextResponse.json({ comissoes: c.data ?? [], guias: g.data ?? [] });
}

/** PUT /api/admin/dp/folha — grava uma comissão ({kind:"comissao"}) ou uma guia ({kind:"guia"}). Só estimativas e controle; nada é enviado ao governo. */
export async function PUT(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();
  const competencia = comp(b.competencia);
  if (!competencia) return NextResponse.json({ error: "Competência inválida" }, { status: 400 });

  if (b.kind === "comissao") {
    const valor = money(b.valor);
    if (typeof b.employee_id !== "string" || valor === null) return NextResponse.json({ error: "Colaborador e valor são obrigatórios" }, { status: 400 });
    const { error } = await supabase.from("dp_comissoes").upsert({ employee_id: b.employee_id, competencia, valor, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.kind === "guia") {
    const tipo = ["fgts", "darf", "das"].includes(b.tipo) ? (b.tipo as string) : null;
    const status = ["pendente", "emitida", "paga"].includes(b.status) ? (b.status as string) : "pendente";
    if (!tipo) return NextResponse.json({ error: "Tipo de guia inválido" }, { status: 400 });
    const { error } = await supabase.from("dp_guias").upsert({
      competencia,
      tipo,
      valor: b.valor === null || b.valor === "" || b.valor === undefined ? null : money(b.valor),
      status,
      codigo: text(b.codigo, 300),
      pago_em: isoDate(b.pago_em),
      contador_nome: text(b.contador_nome, 80),
      contador_em: isoDate(b.contador_em),
      notes: text(b.notes, 300),
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Tipo de gravação inválido" }, { status: 400 });
}
