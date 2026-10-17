import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";

const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

/** PATCH — encerra o afastamento (data fim) ou liga os eventos eSocial gerados. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const upd: Record<string, unknown> = {};
  if ("end_date" in b) {
    const e = isoDate(b.end_date);
    if (!e) return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    upd.end_date = e;
  }
  if ("esocial_event_id" in b) upd.esocial_event_id = uuid(b.esocial_event_id);
  if ("esocial_end_event_id" in b) upd.esocial_end_event_id = uuid(b.esocial_end_event_id);
  if (!Object.keys(upd).length) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  if (upd.end_date) {
    const { data: cur } = await supabase.from("dp_leaves").select("start_date").eq("id", id).maybeSingle();
    if (!cur) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    if ((upd.end_date as string) < cur.start_date) return NextResponse.json({ error: "Fim anterior ao início" }, { status: 400 });
  }
  const { error } = await supabase.from("dp_leaves").update(upd).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
