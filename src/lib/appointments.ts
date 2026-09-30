import { getSupabaseAdmin } from "@/lib/supabase";
import type { PatientDocument, PatientDocumentWithUrl } from "@/lib/patientDocuments";
import { signPatientDocuments } from "@/lib/patientDocuments";

export interface PatientRecord {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  documents: PatientDocumentWithUrl[];
}

export interface AppointmentDetail {
  id: string;
  doctor_id: string | null;
  status: string;
  scheduled_at: string;
  doctor_notes: string | null;
  called_at: string | null;
  finished_at: string | null;
  prescription_url: string | null;
  memed_prescription_at: string | null;
  memed_prescription_summary: string | null;
  vital_spo2: string | null;
  vital_bpm: string | null;
  vital_pa: string | null;
  vital_peso: string | null;
  vital_hgt: string | null;
  patient_id: string;
  patients: PatientRecord | null;
  specialties: { name: string } | null;
  doctors: { name?: string | null; memed_email: string | null; memed_linked_at: string | null } | null;
}

export interface HistoryItem {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_notes: string | null;
  called_at: string | null;
  finished_at: string | null;
  prescription_url: string | null;
  memed_prescription_at: string | null;
  memed_prescription_summary: string | null;
  vital_spo2: string | null;
  vital_bpm: string | null;
  vital_pa: string | null;
  vital_peso: string | null;
  vital_hgt: string | null;
  specialties: { name: string } | null;
  doctors?: { name: string } | null;
}

const VITAL_COLUMNS = "vital_spo2, vital_bpm, vital_pa, vital_peso, vital_hgt";

/**
 * Tira as colunas de sinais vitais do select quando o banco ainda não
 * tem elas (migration_sinais_vitais.sql não rodada). Sem isso, a falta
 * da migração derrubava a tela de consulta e o histórico do paciente.
 */
export function withoutVitals(columns: string): string {
  return columns.replace(`, ${VITAL_COLUMNS}`, "");
}

/** Erro do Postgres "coluna não existe". */
export function isMissingColumnError(error: { code?: string } | null): boolean {
  return error?.code === "42703";
}

/** Busca uma consulta garantindo que ela pertence ao médico informado. */
export async function getOwnedAppointment(
  id: string,
  doctorId: string
): Promise<AppointmentDetail | null> {
  const supabase = getSupabaseAdmin();
  const columns =
    "id, doctor_id, status, scheduled_at, doctor_notes, called_at, finished_at, prescription_url, memed_prescription_at, memed_prescription_summary, vital_spo2, vital_bpm, vital_pa, vital_peso, vital_hgt, patient_id, patients(*), specialties(name), doctors(name, memed_email, memed_linked_at)";
  let { data, error } = await supabase.from("appointments").select(columns).eq("id", id).maybeSingle();
  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase.from("appointments").select(withoutVitals(columns)).eq("id", id).maybeSingle());
  }

  if (error || !data || data.doctor_id !== doctorId) return null;

  const rawPatient = data.patients as unknown as (PatientRecord & { documents: PatientDocument[] }) | null;
  const signedDocuments = await signPatientDocuments(rawPatient?.documents ?? []);
  const patients = rawPatient ? { ...rawPatient, documents: signedDocuments } : null;

  return { ...data, patients } as unknown as AppointmentDetail;
}

/** Histórico de outras consultas do mesmo paciente (mais recentes primeiro). */
export async function getPatientHistory(
  patientId: string,
  excludeAppointmentId: string
): Promise<HistoryItem[]> {
  const supabase = getSupabaseAdmin();
  const columns =
    "id, scheduled_at, status, doctor_notes, called_at, finished_at, prescription_url, memed_prescription_at, memed_prescription_summary, vital_spo2, vital_bpm, vital_pa, vital_peso, vital_hgt, specialties(name), doctors(name)";
  const run = (cols: string) =>
    supabase
      .from("appointments")
      .select(cols)
      .eq("patient_id", patientId)
      .neq("id", excludeAppointmentId)
      .order("scheduled_at", { ascending: false })
      .limit(30);
  let { data, error } = await run(columns);
  if (isMissingColumnError(error)) ({ data, error } = await run(withoutVitals(columns)));

  return (data ?? []) as unknown as HistoryItem[];
}

/**
 * O médico só pode ver/anexar documentos de pacientes que ele atende
 * (tem ou teve consulta com ele). Antes, qualquer médico logado
 * conseguia ler e apagar documentos de qualquer paciente pelo id.
 */
export async function doctorCanAccessPatient(doctorId: string, patientId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId);
  return !error && (count ?? 0) > 0;
}
