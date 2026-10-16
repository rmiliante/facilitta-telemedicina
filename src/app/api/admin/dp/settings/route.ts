import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { normalizeRole, STAFF_ROLE_HEADER } from "@/lib/permissions";

async function masterOnly() {
  const role = normalizeRole((await headers()).get(STAFF_ROLE_HEADER));
  return role === "master" || role === null;
}

/** GET /api/admin/dp/settings — receita dos últimos 12 meses (usada no Fator R). */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { data } = await getSupabaseAdmin().from("dp_settings").select("value").eq("key", "receita_12m").maybeSingle();
  const v = (data as { value?: unknown } | null)?.value;
  return NextResponse.json({ receita12m: typeof v === "number" ? v : null });
}

/** PATCH /api/admin/dp/settings — { receita12m: number } */
export async function PATCH(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const v = Number(body.receita12m);
  if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  const { error } = await getSupabaseAdmin()
    .from("dp_settings")
    .upsert({ key: "receita_12m", value: v, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit("staff", { action: "dp_alterar_config", entity: "dp_settings", entityId: "receita_12m", details: { valor: v } });
  return NextResponse.json({ receita12m: v });
}
