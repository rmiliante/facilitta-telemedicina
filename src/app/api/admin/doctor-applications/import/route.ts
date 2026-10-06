import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BRAZIL_STATES } from "@/lib/doctorApplications";
import { normalizeSpecialty, specializationsOf } from "@/lib/specialtyNormalize";

/**
 * POST /api/admin/doctor-applications/import — importa candidatos vindos do
 * formulário do site (e-mails "Novo Cadastro Profissional"). Entram como
 * origem "orgânico", status "novo". Um mesmo e-mail reenviado várias vezes
 * vira um só candidato (fica o registro mais completo); e-mails que já
 * estão na tabela são ignorados.
 */

interface InRow {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  profession?: string;
  registry?: string;
  specialty?: string;
  collaboration?: string;
  comments?: string;
  idea?: string;
  receivedAt?: string;
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parseDate(v: string): string | null {
  if (!v) return null;
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?/);
  if (br) {
    // Horário de Brasília (UTC-3).
    const d = new Date(Date.UTC(+br[3], +br[2] - 1, +br[1], (br[4] ? +br[4] : 0) + 3, br[5] ? +br[5] : 0));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** "COREN MG 203192", "CRM/BA 12345", "12345-SP" → { number, uf }. */
function parseRegistry(registry: string, state: string) {
  const upper = registry.toUpperCase();
  let uf = (BRAZIL_STATES as readonly string[]).find((s) => new RegExp(`(^|[^A-Z])${s}([^A-Z]|$)`).test(upper)) ?? "";
  if (!uf && (BRAZIL_STATES as readonly string[]).includes(state.toUpperCase())) uf = state.toUpperCase();
  const num = registry.match(/\d[\d.\-]*/)?.[0]?.replace(/\D/g, "") ?? "";
  return { number: num || registry.slice(0, 40), uf };
}

const weight = (r: InRow) => Object.values(r).reduce<number>((n, v) => n + (typeof v === "string" ? v.length : 0), 0);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rows: InRow[] = Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [];
  if (rows.length === 0) return NextResponse.json({ error: "Nenhuma linha para importar" }, { status: 400 });

  // Dedup dentro do arquivo: mantém o registro mais completo (empate: o mais recente).
  const best = new Map<string, InRow>();
  let invalid = 0;
  for (const r of rows) {
    const email = str(r.email, 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !str(r.name, 200)) {
      invalid += 1;
      continue;
    }
    const prev = best.get(email);
    const rd = parseDate(str(r.receivedAt)) ?? "";
    const pd = prev ? parseDate(str(prev.receivedAt)) ?? "" : "";
    if (!prev || weight(r) > weight(prev) || (weight(r) === weight(prev) && rd > pd)) best.set(email, { ...r, email });
  }
  const duplicatesInFile = rows.length - invalid - best.size;

  const supabase = getSupabaseAdmin();
  const { data: existing, error: exErr } = await supabase.from("doctor_applications").select("email");
  if (exErr) return NextResponse.json({ error: "Falha ao consultar candidaturas" }, { status: 500 });
  const known = new Set((existing ?? []).map((e) => String(e.email).trim().toLowerCase()));

  const toInsert: Record<string, unknown>[] = [];
  let alreadyThere = 0;
  for (const [email, r] of best) {
    if (known.has(email)) {
      alreadyThere += 1;
      continue;
    }
    const { number, uf } = parseRegistry(str(r.registry, 80), str(r.state, 40));
    const state = (BRAZIL_STATES as readonly string[]).includes(str(r.state, 4).toUpperCase())
      ? str(r.state, 4).toUpperCase()
      : null;
    const received = parseDate(str(r.receivedAt));
    toInsert.push({
      name: str(r.name, 200),
      email,
      whatsapp: str(r.phone, 40) || null,
      city: str(r.city, 120) || null,
      state,
      profession: str(r.profession, 80) || "Médico(a)",
      crm: number || null,
      crm_uf: uf || null,
      specialty: normalizeSpecialty(str(r.profession, 80) || "Médico(a)", str(r.specialty, 120)),
      specializations: specializationsOf(str(r.profession, 80) || "Médico(a)", str(r.specialty, 120), str(r.comments)),
      specialty_raw: str(r.specialty, 120) || null,
      collaboration: str(r.collaboration, 300) || null,
      comments: str(r.comments) || null,
      innovative_idea: str(r.idea) || null,
      received_at: received,
      ...(received ? { created_at: received } : {}),
      origin: "organico",
      status: "novo",
      available_days: [],
      available_shifts: [],
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("doctor_applications").insert(toInsert);
    if (error) {
      const missing = error.code === "42703" || error.code === "PGRST204" || error.code === "23502";
      return NextResponse.json(
        {
          error: missing
            ? "O banco ainda não foi atualizado para receber candidatos do site. Rode a migration_captacao_origem.sql no Supabase e tente de novo."
            : "Falha ao importar candidatos",
        },
        { status: missing ? 409 : 500 }
      );
    }
  }

  return NextResponse.json({ imported: toInsert.length, alreadyThere, duplicatesInFile, invalid });
}
