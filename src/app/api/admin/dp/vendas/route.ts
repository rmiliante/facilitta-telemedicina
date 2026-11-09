import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";

export const dynamic = "force-dynamic";

/** GET /api/admin/dp/vendas — vendas do Master com as cobranças do Asaas (snapshot). */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const db = getSupabaseAdmin();
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db.from("dp_vendas").select("venda_id, vendedor, cliente, produto, data_venda, status, cobrancas, atualizado_em").order("venda_id").range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({ vendas: out });
}

interface VendaIn { id: string; vendedor?: string; cliente?: string; produto?: string; data?: string | null; status?: string; cob?: unknown }

/** POST /api/admin/dp/vendas — importa/atualiza o snapshot (upsert por venda). */
export async function POST(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { vendas?: VendaIn[] } | null;
  if (!Array.isArray(b?.vendas) || b.vendas.length === 0 || b.vendas.length > 5000) return NextResponse.json({ error: "Lista de vendas inválida" }, { status: 400 });
  const agora = new Date().toISOString();
  const rows = [];
  for (const v of b.vendas) {
    if (typeof v.id !== "string" || !/^\d{1,8}$/.test(v.id)) return NextResponse.json({ error: "ID de venda inválido" }, { status: 400 });
    const cob = Array.isArray(v.cob) ? v.cob.filter((c) => Array.isArray(c) && c.length >= 5).slice(0, 60) : [];
    rows.push({
      venda_id: v.id,
      vendedor: String(v.vendedor ?? "Sem código").slice(0, 120),
      cliente: String(v.cliente ?? "").slice(0, 200),
      produto: String(v.produto ?? "").slice(0, 80),
      data_venda: v.data && /^\d{4}-\d{2}-\d{2}$/.test(v.data) ? v.data : null,
      status: String(v.status ?? "").slice(0, 40),
      cobrancas: cob,
      atualizado_em: agora,
    });
  }
  const db = getSupabaseAdmin();
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("dp_vendas").upsert(rows.slice(i, i + 200));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, vendas: rows.length });
}
