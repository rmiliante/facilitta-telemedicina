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
  patient_id: string;
  patients: PatientRecord | null;
  specialties: { name: string } | null;
  doctors: { memed_email: string | null; memed_linked_at: string | null } | null;
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
  specialties: { name: string } | null;
}

/** Busca uma consulta garantindo que ela pertence ao médico informado. */
export async function getOwnedAppointment(
  id: string,
  doctorId: string
): Promise<AppointmentDetail | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, doctor_id, status, scheduled_at, doctor_notes, called_at, finished_at, prescription_url, memed_prescription_at, memed_prescription_summary, patient_id, patients(*), specialties(name), doctors(memed_email, memed_linked_at)"
    )
    .eq("id", id)
    .maybeSingle();

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
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, doctor_notes, called_at, finished_at, prescription_url, memed_prescription_at, memed_prescription_summary, specialties(name)"
    )
    .eq("patient_id", patientId)
    .neq("id", excludeAppointmentId)
    .order("scheduled_at", { ascending: false })
    .limit(10);

  return (data ?? []) as unknown as HistoryItem[];
}
