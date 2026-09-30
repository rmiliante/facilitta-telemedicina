import { getSupabaseAdmin } from "@/lib/supabase";
import { VITAL_FIELDS, type VitalKey, type VitalSign } from "@/lib/vitals";

/**
 * Aferições de sinais vitais (tabela vital_signs). Enquanto a migração
 * supabase/migration_afericoes.sql não roda, a leitura cai nos valores
 * antigos salvos em cada consulta (appointments.vital_*) e a gravação
 * responde avisando que falta a migração.
 */

const COLUMNS =
  "id, patient_id, appointment_id, measured_at, spo2, bpm, pa, peso, hgt, recorded_by_name, recorded_by_role";

export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /vital_signs/.test(error.message ?? "");
}

export async function listVitalSigns(patientId: string): Promise<{ items: VitalSign[]; migrated: boolean }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("vital_signs")
    .select(COLUMNS)
    .eq("patient_id", patientId)
    .order("measured_at", { ascending: false })
    .limit(200);

  if (!error) return { items: (data ?? []) as VitalSign[], migrated: true };
  if (!isMissingTable(error)) {
    console.error("Erro ao buscar aferições:", error);
    throw new Error("Falha ao buscar aferições");
  }

  // Fallback: sinais vitais antigos, gravados direto na consulta.
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, patient_id, scheduled_at, called_at, vital_spo2, vital_bpm, vital_pa, vital_peso, vital_hgt, doctors(name)")
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: false })
    .limit(100);

  const items: VitalSign[] = [];
  for (const row of (appts ?? []) as unknown as Record<string, unknown>[]) {
    const v = (k: string) => (typeof row[k] === "string" && row[k] ? (row[k] as string) : null);
    const vals = { spo2: v("vital_spo2"), bpm: v("vital_bpm"), pa: v("vital_pa"), peso: v("vital_peso"), hgt: v("vital_hgt") };
    if (!Object.values(vals).some(Boolean)) continue;
    const doctor = row.doctors as { name?: string } | null;
    items.push({
      id: `appt-${row.id}`,
      patient_id: patientId,
      appointment_id: row.id as string,
      measured_at: (row.called_at as string) || (row.scheduled_at as string),
      ...vals,
      recorded_by_name: doctor?.name ?? null,
      recorded_by_role: "medico",
    });
  }
  items.sort((a, b) => b.measured_at.localeCompare(a.measured_at));
  return { items, migrated: false };
}

/** Limpa e valida os valores digitados; devolve null se nada foi preenchido. */
export function cleanVitalValues(body: Record<string, unknown>): Record<VitalKey, string | null> | null {
  const out = {} as Record<VitalKey, string | null>;
  let any = false;
  for (const f of VITAL_FIELDS) {
    const raw = body[f.key];
    const value = typeof raw === "string" ? raw.trim().slice(0, 20) : "";
    out[f.key] = value || null;
    if (value) any = true;
  }
  return any ? out : null;
}

/** Data/hora informada pelo formulário (horário de São Paulo) ou agora. */
export function parseMeasuredAt(raw: unknown): string {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    const d = new Date(`${raw}:00-03:00`);
    if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 5 * 60000) return d.toISOString();
  }
  return new Date().toISOString();
}

/** Consulta do paciente no mesmo dia (horário de SP), pra vincular a aferição. */
export async function findSameDayAppointment(patientId: string, measuredAt: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(measuredAt));
  const start = new Date(`${day}T00:00:00-03:00`).toISOString();
  const end = new Date(`${day}T23:59:59-03:00`).toISOString();
  const { data } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("patient_id", patientId)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .neq("status", "cancelado")
    .order("scheduled_at", { ascending: true })
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

export async function insertVitalSign(input: {
  patientId: string;
  appointmentId: string | null;
  measuredAt: string;
  values: Record<VitalKey, string | null>;
  recordedByName: string;
  recordedByRole: "atendente" | "admin" | "medico";
}): Promise<{ item?: VitalSign; missingTable?: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("vital_signs")
    .insert({
      patient_id: input.patientId,
      appointment_id: input.appointmentId,
      measured_at: input.measuredAt,
      ...input.values,
      recorded_by_name: input.recordedByName,
      recorded_by_role: input.recordedByRole,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    if (isMissingTable(error)) return { missingTable: true };
    console.error("Erro ao salvar aferição:", error);
    return { error: "Falha ao salvar aferição" };
  }
  return { item: data as VitalSign };
}

export async function deleteVitalSign(patientId: string, id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("vital_signs").delete().eq("id", id).eq("patient_id", patientId);
  return !error;
}
