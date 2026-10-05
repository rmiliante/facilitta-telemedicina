import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  EXPERIENCE_ORDER,
  countBy,
  experienceBucket,
  normalizeLabel,
  parseExperienceYears,
  professionGroup,
} from "@/lib/dashboardStats";

interface AppRow {
  id: string;
  email: string;
  status: string;
  origin?: string | null;
  profession?: string | null;
  specialty?: string | null;
  state?: string | null;
  crm_uf?: string | null;
  city?: string | null;
  experience_years?: number | null;
  collaboration?: string | null;
  comments?: string | null;
  innovative_idea?: string | null;
  presentation?: string | null;
  created_at: string;
  received_at?: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * GET /api/admin/dashboard-captacao — números da aba "Captação" do dashboard.
 * Conta cada candidato uma vez (pelo e-mail): o formulário do site reenvia o
 * mesmo candidato várias vezes. Colunas novas (origin, profession...) podem
 * não existir ainda no banco: nesse caso tudo conta como tráfego pago/médico.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("doctor_applications").select("*").limit(5000);
  if (error) {
    console.error("Erro no dashboard de captação:", error);
    return NextResponse.json({ error: "Falha ao buscar os dados de captação" }, { status: 500 });
  }

  // Um candidato por e-mail: fica o registro mais avançado no funil / com mais texto.
  const rank: Record<string, number> = { aprovado: 3, em_avaliacao: 2, recusado: 1, novo: 0 };
  const size = (r: AppRow) => (r.comments?.length ?? 0) + (r.presentation?.length ?? 0) + (r.innovative_idea?.length ?? 0);
  const byEmail = new Map<string, AppRow>();
  for (const row of (data ?? []) as AppRow[]) {
    const key = (row.email ?? row.id).trim().toLowerCase();
    const prev = byEmail.get(key);
    const r = rank[row.status] ?? 0;
    const pr = prev ? rank[prev.status] ?? 0 : -1;
    if (!prev || r > pr || (r === pr && size(row) > size(prev))) byEmail.set(key, row);
  }
  const apps = Array.from(byEmail.values());
  const when = (a: AppRow) => new Date(a.received_at ?? a.created_at).getTime();
  const now = Date.now();
  const origin = (a: AppRow): "organico" | "pago" => (a.origin === "organico" ? "organico" : "pago");

  const approved = apps.filter((a) => a.status === "aprovado");
  const approvedEmails = new Set(approved.map((a) => a.email.trim().toLowerCase()));

  // Cadastrados / atendendo: aprovado que já virou médico (mesmo e-mail) / já concluiu consulta.
  let cadastrados = 0;
  let atendendo = 0;
  const { data: doctors } = await supabase.from("doctors").select("id, email");
  const doctorIds = new Set<string>();
  for (const d of doctors ?? []) {
    if (approvedEmails.has(String(d.email).trim().toLowerCase())) {
      cadastrados += 1;
      doctorIds.add(d.id as string);
    }
  }
  if (doctorIds.size > 0) {
    const { data: done } = await supabase
      .from("appointments")
      .select("doctor_id")
      .eq("status", "concluido")
      .in("doctor_id", Array.from(doctorIds));
    atendendo = new Set((done ?? []).map((r) => r.doctor_id as string)).size;
  }

  const byOrigin = (["organico", "pago"] as const).map((o) => {
    const list = apps.filter((a) => origin(a) === o);
    const ok = list.filter((a) => a.status === "aprovado").length;
    return { origin: o, count: list.length, approved: ok, rate: list.length ? Math.round((ok / list.length) * 100) : 0 };
  });

  // Últimas 8 semanas (começando na segunda), orgânico x pago.
  const weekStart = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  const firstWeek = weekStart(now) - 7 * 7 * DAY;
  const weeks = Array.from({ length: 8 }, (_, i) => ({
    start: new Date(firstWeek + i * 7 * DAY).toISOString().slice(0, 10),
    organico: 0,
    pago: 0,
  }));
  for (const a of apps) {
    const idx = Math.round((weekStart(when(a)) - firstWeek) / (7 * DAY));
    if (idx >= 0 && idx < 8) weeks[idx][origin(a)] += 1;
  }

  const years = apps.map((a) => a.experience_years ?? parseExperienceYears(a.comments, a.presentation, a.innovative_idea));
  const experience = EXPERIENCE_ORDER.map((name) => ({ name, count: years.filter((y) => experienceBucket(y) === name).length }));

  return NextResponse.json({
    total: apps.length,
    novos30d: apps.filter((a) => now - when(a) <= 30 * DAY).length,
    aprovados: approved.length,
    taxaAprovacao: apps.length ? Math.round((approved.length / apps.length) * 100) : 0,
    semResposta7d: apps.filter((a) => a.status === "novo" && now - when(a) > 7 * DAY).length,
    byOrigin,
    byProfession: countBy(apps, (a) => professionGroup(a.profession)),
    funnel: [
      { name: "Novos", count: apps.filter((a) => a.status === "novo").length },
      { name: "Em avaliação", count: apps.filter((a) => a.status === "em_avaliacao").length },
      { name: "Aprovados", count: approved.length },
      { name: "Cadastrados", count: cadastrados },
      { name: "Atendendo", count: atendendo },
    ],
    recusados: apps.filter((a) => a.status === "recusado").length,
    bySpecialty: countBy(apps, (a) => normalizeLabel(a.specialty)).slice(0, 8),
    byState: countBy(apps, (a) => normalizeLabel(a.state || a.crm_uf, "—").toUpperCase()).slice(0, 8),
    topCities: countBy(apps.filter((a) => a.city), (a) => normalizeLabel(a.city)).slice(0, 3).map((c) => c.name),
    experience,
    byCollaboration: countBy(apps, (a) => normalizeLabel(a.collaboration)),
    weeks,
  });
}
