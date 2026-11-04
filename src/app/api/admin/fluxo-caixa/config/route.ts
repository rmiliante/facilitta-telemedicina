import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseSettingsInput } from "@/lib/cashflowProjection";
import { financeErrorResponse } from "@/lib/financeApi";
import { audit } from "@/lib/audit";

/** PUT — salva as premissas da projeção (caixa de partida, cotas cheias, consultas por mês). */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const value = parseSettingsInput(body);
    const { error } = await getSupabaseAdmin().from("cash_settings").upsert({ key: "projecao", value, updated_at: new Date().toISOString() });
    if (error) throw error;
    await audit("staff", { action: "alterar_premissas_fluxo", entity: "fluxo_caixa", entityId: "projecao", details: { ...value } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao salvar as premissas");
  }
}
