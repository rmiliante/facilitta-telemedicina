import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { certificateLabel } from "@/lib/certificateProviders";
import { countBy, monthsBetween, normalizeLabel, parseExperienceYears } from "@/lib/dashboardStats";

const DAY = 24 * 60 * 60 * 1000;

interface DoctorRow {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
  cpf?: string | null;
  crm?: string | null;
  crm_uf?: string | null;
  memed_crm?: string | null;
  memed_uf?: string | null;
  signing_provider?: string | null;
  prescreve_session_status?: string | null;
  prescreve_session_expires_at?: string | null;
  specialties: { name: string } | null;
}

/**
 * GET /api/admin/dashboard-medicos — números da aba "Médicos" do dashboard
 * (médicos ativos no sistema). Colunas opcionais (certificado, sessão de
 * assinatura, CPF/CRM) são buscadas com fallback se o banco ainda não as tem.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const base = "id, name, email, active, created_at, specialties(name)";
  const attempts = [
    `${base}, cpf, crm, crm_uf, memed_crm, memed_uf, signing_provider, prescreve_session_status, prescreve_session_expires_at`,
    `${base}, cpf, crm, crm_uf, memed_crm, memed_uf, prescreve_session_status, prescreve_session_expires_at`,
    base,
  ];
  let doctors: DoctorRow[] | null = null;
  for (const cols of attempts) {
    const { data, error } = await supabase.from("doctors").select(cols).eq("active", true);
    if (!error) {
      doctors = (data ?? []) as unknown as DoctorRow[];
      break;
    }
    if (error.code !== "42703") {
      console.error("Erro no dashboard de médicos:", error);
      return NextResponse.json({ error: "Falha ao buscar os médicos" }, { status: 500 });
    }
  }
  if (!doctors) return NextResponse.json({ error: "Falha ao buscar os médicos" }, { status: 500 });

  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const { data: appts } = await supabase.from("appointments").select("doctor_id").eq("status", "concluido").gte("scheduled_at", since);
  const done = new Map<string, number>();
  for (const a of appts ?? []) done.set(a.doctor_id as string, (done.get(a.doctor_id as string) ?? 0) + 1);

  // Experiência e origem vêm da candidatura com o mesmo e-mail (quando houver).
  const { data: apps } = await supabase.from("doctor_applications").select("*").limit(5000);
  const appByEmail = new Map<string, Record<string, unknown>>();
  for (const a of apps ?? []) {
    const k = String(a.email ?? "").trim().toLowerCase();
    if (!appByEmail.has(k) || a.status === "aprovado") appByEmail.set(k, a as Record<string, unknown>);
  }

  const now = Date.now();
  const rows = doctors.map((d) => {
    const app = appByEmail.get(d.email.trim().toLowerCase());
    const years = app
      ? ((app.experience_years as number | null) ??
        parseExperienceYears(app.comments as string, app.presentation as string, app.innovative_idea as string))
      : null;
    const origin = app ? (app.origin === "organico" ? "Captação orgânica" : "Tráfego pago") : "Indicação / direto";
    const uf = (d.crm_uf || d.memed_uf || "").toUpperCase() || null;
    const sessionActive =
      d.prescreve_session_status === "active" &&
      !!d.prescreve_session_expires_at &&
      new Date(d.prescreve_session_expires_at).getTime() > now;
    const incomplete = !(d.cpf && (d.crm || d.memed_crm) && uf);
    return {
      id: d.id,
      name: d.name,
      specialty: normalizeLabel(d.specialties?.name),
      uf,
      experienceYears: years,
      months: monthsBetween(d.created_at),
      consultas90d: done.get(d.id) ?? 0,
      certificate: d.signing_provider ? certificateLabel(d.signing_provider) : "Não definido",
      signing: sessionActive ? "ativa" : incomplete ? "cadastro incompleto" : "inativa",
      incomplete,
      origin,
    };
  });

  const consultasTotal = rows.reduce((s, r) => s + r.consultas90d, 0);
  return NextResponse.json({
    total: rows.length,
    assinaturaAtiva: rows.filter((r) => r.signing === "ativa").length,
    mediaConsultasMes: rows.length ? Math.round((consultasTotal / 3 / rows.length) * 10) / 10 : 0,
    incompletos: rows.filter((r) => r.incomplete).length,
    bySpecialty: countBy(rows, (r) => r.specialty),
    byState: countBy(rows, (r) => r.uf ?? "—"),
    byCertificate: countBy(rows, (r) => r.certificate),
    byOrigin: countBy(rows, (r) => r.origin),
    doctors: rows.sort((a, b) => b.consultas90d - a.consultas90d || a.name.localeCompare(b.name)),
  });
}
