import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/dashboard-pacientes
 * Estatísticas de pacientes (só números; nada clínico) para o dashboard.
 * Filtros: from/to (YYYY-MM-DD), specialtyId, city, situacao
 * (todos | agendada | sem_agendamento — vale só para a lista "sem consulta").
 */

interface P {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  city: string | null;
  created_at: string;
}
interface A {
  patient_id: string | null;
  status: string;
  scheduled_at: string;
  tipo_consulta?: string | null;
  specialty_id: string | null;
  specialties: { name: string } | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 1000;

async function fetchAll<T>(table: string, columns: string, fallbackColumns?: string): Promise<T[]> {
  const supabase = getSupabaseAdmin();
  const out: T[] = [];
  let cols = columns;
  for (let from = 0; ; from += PAGE) {
    let { data, error } = await supabase.from(table).select(cols).range(from, from + PAGE - 1);
    if (error?.code === "42703" && fallbackColumns && cols !== fallbackColumns) {
      cols = fallbackColumns;
      ({ data, error } = await supabase.from(table).select(cols).range(from, from + PAGE - 1));
    }
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();
const topWithOthers = (map: Map<string, number>, top: number) => {
  const all = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const head = all.slice(0, top).map(([name, count]) => ({ name, count }));
  const rest = all.slice(top).reduce((s, [, c]) => s + c, 0);
  if (rest > 0) head.push({ name: "Outras", count: rest });
  return head;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawFrom = sp.get("from") ?? "";
  const rawTo = sp.get("to") ?? "";
  const from = DAY.test(rawFrom) ? rawFrom : null;
  const to = DAY.test(rawTo) ? rawTo : null;
  const specialtyId = sp.get("specialtyId") || null;
  const city = (sp.get("city") ?? "").trim();
  const situacao = sp.get("situacao") ?? "todos";

  let patients: P[];
  let appts: A[];
  try {
    patients = await fetchAll<P>("patients", "id, full_name, cpf, birth_date, city, created_at");
    appts = await fetchAll<A>(
      "appointments",
      "patient_id, status, scheduled_at, tipo_consulta, specialty_id, specialties(name)",
      "patient_id, status, scheduled_at, specialty_id, specialties(name)"
    );
  } catch (e) {
    console.error("Erro no dashboard de pacientes:", e);
    return NextResponse.json({ error: "Falha ao buscar dados" }, { status: 500 });
  }

  const inRange = (day: string) => (!from || day >= from) && (!to || day <= to);
  const cityPatients = city ? patients.filter((p) => norm(p.city ?? "") === norm(city)) : patients;
  const ids = new Set(cityPatients.map((p) => p.id));
  const cityAppts = appts.filter((a) => a.patient_id && ids.has(a.patient_id));
  const apptsR = cityAppts.filter(
    (a) => inRange(a.scheduled_at.slice(0, 10)) && (!specialtyId || a.specialty_id === specialtyId)
  );

  // Opções de cidade para o filtro.
  const cityCount = new Map<string, { name: string; count: number }>();
  for (const p of patients) {
    const name = (p.city ?? "").trim();
    if (!name) continue;
    const k = norm(name);
    const cur = cityCount.get(k);
    if (cur) cur.count += 1;
    else cityCount.set(k, { name, count: 1 });
  }
  const cities = [...cityCount.values()].sort((a, b) => b.count - a.count).slice(0, 60).map((c) => c.name);

  const now = new Date();
  const today = new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

  // Atendidos (consulta concluída) no período/especialidade.
  const done = apptsR.filter((a) => a.status === "concluido");
  const atendidos = new Set(done.map((a) => a.patient_id as string));

  // Já realizaram consulta (em qualquer data; respeita a especialidade, se filtrada).
  const doneAny = new Set(
    cityAppts
      .filter((a) => a.status === "concluido" && (!specialtyId || a.specialty_id === specialtyId))
      .map((a) => a.patient_id as string)
  );

  // Próxima consulta aberta de cada paciente.
  const nextOpen = new Map<string, { day: string; specialty: string }>();
  for (const a of cityAppts) {
    if (a.status !== "agendado" && a.status !== "em_andamento") continue;
    const day = a.scheduled_at.slice(0, 10);
    if (day < today) continue;
    const cur = nextOpen.get(a.patient_id as string);
    if (!cur || day < cur.day) nextOpen.set(a.patient_id as string, { day, specialty: a.specialties?.name ?? "" });
  }

  const pendingBase = cityPatients.filter(
    (p) => !doneAny.has(p.id) && ((!from && !to) || inRange(p.created_at.slice(0, 10)))
  );
  const pending = pendingBase
    .map((p) => {
      const open = nextOpen.get(p.id);
      return {
        id: p.id,
        name: p.full_name,
        cpf: p.cpf,
        city: p.city,
        createdAt: p.created_at.slice(0, 10),
        scheduledFor: open?.day ?? null,
        specialty: open?.specialty ?? null,
      };
    })
    .filter((p) => (situacao === "agendada" ? !!p.scheduledFor : situacao === "sem_agendamento" ? !p.scheduledFor : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Novos cadastros: no período, ou nos últimos 30 dias se não houver período.
  const last30 = new Date(now.getTime() - 30 * 86400000 - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const novos = cityPatients.filter((p) => {
    const d = p.created_at.slice(0, 10);
    return from || to ? inRange(d) : d >= last30;
  }).length;

  // Cadastros por mês (12 meses).
  const months: { key: string; label: string; count: number }[] = [];
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: MES[d.getUTCMonth()], count: 0 });
  }
  for (const p of cityPatients) {
    const m = months.find((x) => x.key === p.created_at.slice(0, 7));
    if (m) m.count += 1;
  }

  // Por especialidade (pacientes atendidos distintos).
  const specSets = new Map<string, Set<string>>();
  for (const a of done) {
    const name = a.specialties?.name ?? "Sem especialidade";
    if (!specSets.has(name)) specSets.set(name, new Set());
    specSets.get(name)!.add(a.patient_id as string);
  }
  const bySpecialty = topWithOthers(new Map([...specSets].map(([k, v]) => [k, v.size])), 8);

  // Por cidade.
  const cityMap = new Map<string, number>();
  const cityName = new Map<string, string>();
  for (const p of cityPatients) {
    const raw = (p.city ?? "").trim();
    const k = raw ? norm(raw) : "";
    if (!cityName.has(k)) cityName.set(k, raw || "Não informada");
    cityMap.set(k, (cityMap.get(k) ?? 0) + 1);
  }
  const byCity = topWithOthers(new Map([...cityMap].map(([k, v]) => [cityName.get(k) as string, v])), 5);

  // Faixa etária.
  const ages = { "0–17": 0, "18–39": 0, "40–59": 0, "60+": 0, "Sem data": 0 };
  for (const p of cityPatients) {
    if (!p.birth_date) {
      ages["Sem data"] += 1;
      continue;
    }
    const b = new Date(p.birth_date + "T12:00:00Z");
    let age = now.getUTCFullYear() - b.getUTCFullYear();
    if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age -= 1;
    if (age < 18) ages["0–17"] += 1;
    else if (age < 40) ages["18–39"] += 1;
    else if (age < 60) ages["40–59"] += 1;
    else ages["60+"] += 1;
  }
  const byAge = Object.entries(ages).map(([name, count]) => ({ name, count }));

  // Rotina x Retorno (consultas não canceladas no período).
  const typed = apptsR.filter((a) => a.status !== "cancelado" && (a.tipo_consulta === "rotina" || a.tipo_consulta === "retorno"));
  const retorno = typed.filter((a) => a.tipo_consulta === "retorno").length;
  const retornoPct = typed.length ? Math.round((retorno / typed.length) * 100) : null;

  // Mais frequentes e faltas.
  const byId = new Map(patients.map((p) => [p.id, p]));
  const counts = new Map<string, { done: number; faltas: number }>();
  for (const a of apptsR) {
    const id = a.patient_id as string;
    const c = counts.get(id) ?? { done: 0, faltas: 0 };
    if (a.status === "concluido") c.done += 1;
    if (a.status === "faltou") c.faltas += 1;
    counts.set(id, c);
  }
  const rank = (key: "done" | "faltas") =>
    [...counts.entries()]
      .filter(([, c]) => c[key] > 0)
      .sort((a, b) => b[1][key] - a[1][key])
      .slice(0, 5)
      .map(([id, c]) => ({ name: byId.get(id)?.full_name ?? "—", city: byId.get(id)?.city ?? null, consultas: c.done, faltas: c.faltas }));

  return NextResponse.json({
    total: cityPatients.length,
    novos,
    novosLabel: from || to ? "no período" : "nos últimos 30 dias",
    atendidos: atendidos.size,
    semConsulta: pendingBase.length,
    semConsultaPct: cityPatients.length ? Math.round((pendingBase.length / cityPatients.length) * 100) : 0,
    retornoPct,
    months,
    bySpecialty,
    byCity,
    byAge,
    frequentes: rank("done"),
    faltosos: rank("faltas"),
    pending: pending.slice(0, 500),
    pendingTotal: pending.length,
    cities,
  });
}
