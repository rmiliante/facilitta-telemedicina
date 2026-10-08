import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type Row = Record<string, unknown>;

async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  const out: Row[] = [];
  const size = 1000;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await build(i * size, i * size + size - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

const DIRECT = "direto / sem origem";

function tally(items: (string | null | undefined)[]) {
  const m = new Map<string, number>();
  for (const v of items) {
    const k = (v ?? "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function avg(values: unknown[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * GET /api/admin/captacao-relatorio?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Funil de visitas do formulário de captação e perfil dos cadastros do período.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const to = re.test(searchParams.get("to") ?? "") ? (searchParams.get("to") as string) : today;
  const from = re.test(searchParams.get("from") ?? "")
    ? (searchParams.get("from") as string)
    : new Date(Date.parse(to) - 29 * 86400000).toISOString().slice(0, 10);
  const startIso = `${from}T00:00:00-03:00`;
  const endIso = `${to}T23:59:59.999-03:00`;

  const supabase = getSupabaseAdmin();

  const events = await fetchAll((a, b) =>
    supabase
      .from("captacao_events")
      .select("session_id,event,utm_source,utm_campaign")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .in("event", ["view", "start"])
      .order("created_at", { ascending: true })
      .range(a, b),
  );

  const apps = await fetchAll((a, b) =>
    supabase
      .from("doctor_applications")
      .select(
        "created_at,specialty,state,experience_years,consult_price,shift_price,care_mode,has_rqe,device,available_shifts,utm_source,utm_campaign",
      )
      .eq("origin", "pago")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true })
      .range(a, b),
  );

  // Sessões únicas por etapa, agrupadas pela origem da primeira visita.
  const sessionOrigin = new Map<string, string>();
  const viewed = new Set<string>();
  const started = new Set<string>();
  for (const e of events) {
    const sid = String(e.session_id);
    const key = `${(e.utm_source as string | null) || DIRECT}||${(e.utm_campaign as string | null) || "—"}`;
    if (!sessionOrigin.has(sid)) sessionOrigin.set(sid, key);
    if (e.event === "view") viewed.add(sid);
    if (e.event === "start") started.add(sid);
  }

  const byOrigin = new Map<string, { source: string; campaign: string; visits: number; started: number; signups: number }>();
  const slot = (key: string) => {
    let r = byOrigin.get(key);
    if (!r) {
      const [source, campaign] = key.split("||");
      r = { source, campaign, visits: 0, started: 0, signups: 0 };
      byOrigin.set(key, r);
    }
    return r;
  };
  for (const sid of viewed) slot(sessionOrigin.get(sid) as string).visits++;
  for (const sid of started) slot(sessionOrigin.get(sid) as string).started++;
  for (const a of apps) {
    slot(`${(a.utm_source as string | null) || DIRECT}||${(a.utm_campaign as string | null) || "—"}`).signups++;
  }

  // Cadastros por dia (fuso de São Paulo).
  const perDay = new Map<string, number>();
  const cursor = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  for (let d = cursor; d <= last && perDay.size < 400; d = new Date(d.getTime() + 86400000)) {
    perDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const a of apps) {
    const day = new Date(Date.parse(String(a.created_at)) - 3 * 3600 * 1000).toISOString().slice(0, 10);
    if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const total = apps.length;
  const rqeAnswered = apps.filter((a) => a.has_rqe === true || a.has_rqe === false);
  const shiftLabels: Record<string, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
  const shiftItems = apps.flatMap((a) => ((a.available_shifts as string[] | null) ?? []).map((s) => shiftLabels[s] ?? s));
  const careLabels: Record<string, string> = { consulta: "Por consulta", plantao: "Plantão", ambos: "Ambos" };

  return NextResponse.json({
    from,
    to,
    funnel: { visits: viewed.size, started: started.size, signups: total },
    origins: [...byOrigin.values()].sort((a, b) => b.signups - a.signups || b.visits - a.visits),
    perDay: [...perDay.entries()].map(([date, count]) => ({ date, count })),
    specialties: tally(apps.map((a) => a.specialty as string | null)).slice(0, 6),
    care: tally(apps.map((a) => (a.care_mode ? careLabels[a.care_mode as string] : null))),
    rqe: {
      answered: rqeAnswered.length,
      yes: rqeAnswered.filter((a) => a.has_rqe === true).length,
    },
    devices: tally(apps.map((a) => a.device as string | null)),
    shifts: tally(shiftItems),
    states: tally(apps.map((a) => a.state as string | null)).slice(0, 6),
    avgConsult: avg(apps.map((a) => a.consult_price)),
    avgShift: avg(apps.map((a) => a.shift_price)),
    avgExperience: avg(apps.map((a) => a.experience_years)),
  });
}
