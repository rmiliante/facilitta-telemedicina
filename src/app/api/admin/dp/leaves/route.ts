import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";

const COLS = "id, employee_id, kind, cod_mot, start_date, end_date, days, abono, per_aquis_inicio, per_aquis_fim, notes, esocial_event_id, esocial_end_event_id, created_at";
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** GET /api/admin/dp/leaves — férias e afastamentos (todos) + status dos eventos eSocial ligados. */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("dp_leaves").select(COLS).order("start_date", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = new Set<string>();
  for (const l of data ?? []) {
    if (l.esocial_event_id) ids.add(l.esocial_event_id);
    if (l.esocial_end_event_id) ids.add(l.esocial_end_event_id);
  }
  const eventos: Record<string, { status: string; tipo: string; protocolo: string | null }> = {};
  if (ids.size) {
    const { data: evs } = await supabase.from("dp_esocial_events").select("id, status, tipo, protocolo").in("id", [...ids]);
    for (const e of evs ?? []) eventos[e.id] = { status: e.status, tipo: e.tipo, protocolo: e.protocolo };
  }
  return NextResponse.json({ leaves: data ?? [], eventos });
}

/** POST /api/admin/dp/leaves — registra férias ou afastamento (não envia nada ao eSocial). */
export async function POST(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "ferias" ? "ferias" : b.kind === "afastamento" ? "afastamento" : null;
  const employeeId = typeof b.employee_id === "string" ? b.employee_id : "";
  const start = isoDate(b.start_date);
  if (!kind || !employeeId || !start) return NextResponse.json({ error: "Colaborador, tipo e data de início são obrigatórios" }, { status: 400 });
  const text = (v: unknown, n = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

  let days: number | null = null;
  let end: string | null = isoDate(b.end_date);
  let codMot: string | null = null;
  let abono = false;
  let perI: string | null = null;
  let perF: string | null = null;

  if (kind === "ferias") {
    days = Number(b.days);
    abono = b.abono === true;
    if (!Number.isInteger(days) || days < 5 || days > 30 - (abono ? 10 : 0)) {
      return NextResponse.json({ error: abono ? "Com abono, os dias de gozo devem ser de 5 a 20" : "Dias de gozo devem ser de 5 a 30" }, { status: 400 });
    }
    end = addDays(start, days - 1);
    codMot = "15";
    perI = isoDate(b.per_aquis_inicio);
    perF = isoDate(b.per_aquis_fim);
    if (!perI) return NextResponse.json({ error: "Período aquisitivo é obrigatório nas férias" }, { status: 400 });
  } else {
    codMot = text(b.cod_mot, 2);
    if (!codMot || !/^\d{2}$/.test(codMot)) return NextResponse.json({ error: "Motivo do afastamento é obrigatório" }, { status: 400 });
    if (end && end < start) return NextResponse.json({ error: "Fim anterior ao início" }, { status: 400 });
    if (end) days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("dp_leaves")
    .insert({ employee_id: employeeId, kind, cod_mot: codMot, start_date: start, end_date: end, days, abono, per_aquis_inicio: perI, per_aquis_fim: perF, notes: text(b.notes) })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leave: data });
}
