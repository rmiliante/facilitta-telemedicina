import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { isDayKey, sanitizeSearch } from "@/lib/format";

const PAGE = 100;

/**
 * GET /api/admin/auditoria — registro de auditoria (LGPD), mais recentes
 * primeiro. Filtros: from/to (YYYY-MM-DD), action, q (quem ou paciente),
 * before (ISO, pra carregar a próxima página). Só o admin acessa (o proxy
 * não libera esta rota para a atendente).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const action = sp.get("action");
  const q = sanitizeSearch(sp.get("q") ?? "");
  const before = sp.get("before");

  let query = getSupabaseAdmin()
    .from("audit_log")
    .select("id, at, actor_type, actor_name, action, entity, entity_id, patient_id, patient_name, details, ip")
    .order("at", { ascending: false })
    .limit(PAGE + 1);
  if (isDayKey(from)) query = query.gte("at", new Date(`${from}T00:00:00-03:00`).toISOString());
  if (isDayKey(to)) query = query.lt("at", new Date(new Date(`${to}T00:00:00-03:00`).getTime() + 86400000).toISOString());
  if (action && action in AUDIT_ACTIONS) query = query.eq("action", action);
  if (q) query = query.or(`actor_name.ilike.%${q}%,patient_name.ilike.%${q}%`);
  if (before && !Number.isNaN(new Date(before).getTime())) query = query.lt("at", before);

  const { data, error } = await query;
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return NextResponse.json(
      { error: "A auditoria precisa da atualização do banco: rode supabase/migration_auditoria_relatorios.sql no Supabase." },
      { status: 503 }
    );
  }
  if (error) {
    console.error("Erro ao buscar auditoria:", error);
    return NextResponse.json({ error: "Falha ao buscar a auditoria" }, { status: 500 });
  }
  const rows = data ?? [];
  return NextResponse.json({
    items: rows.slice(0, PAGE),
    hasMore: rows.length > PAGE,
    actions: AUDIT_ACTIONS,
  });
}
