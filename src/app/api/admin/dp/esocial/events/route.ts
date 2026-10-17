import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { gerarEvento, masterOnly } from "@/lib/esocial-service";
import type { EsocialTipo } from "@/lib/esocial-xml";

const COLS = "id, employee_id, tipo, grupo, status, ambiente, event_id, params, protocolo, resposta, created_at, sent_at";

/** GET /api/admin/dp/esocial/events?employee_id=…  ou  ?tipo=S-1000 — histórico de eventos (sem o XML). */
export async function GET(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const employeeId = req.nextUrl.searchParams.get("employee_id");
  const tipo = req.nextUrl.searchParams.get("tipo");
  let q = getSupabaseAdmin().from("dp_esocial_events").select(COLS).order("created_at", { ascending: false }).limit(50);
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (tipo) q = q.eq("tipo", tipo);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ eventos: data ?? [] });
}

/** POST /api/admin/dp/esocial/events — gera e assina um evento (NÃO envia). Body: {tipo, employee_id?, params?, operacao?} */
export async function POST(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const params: Record<string, string> = {};
  if (body.params && typeof body.params === "object") {
    for (const [k, v] of Object.entries(body.params as Record<string, unknown>)) if (typeof v === "string") params[k] = v.slice(0, 300);
  }
  const r = await gerarEvento(body.tipo as EsocialTipo, {
    employeeId: typeof body.employee_id === "string" ? body.employee_id : null,
    params,
    operacao: body.operacao === "alteracao" ? "alteracao" : "inclusao",
  });
  if (!r.ok) return NextResponse.json({ error: r.error, missing: r.missing }, { status: r.status });
  return NextResponse.json({ evento: r.evento });
}
