import { getSupabaseAdmin } from "@/lib/supabase";

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
}

export interface AppointmentDetail {
  id: string;
  doctor_id: string | null;
  status: string;
  scheduled_at: string;
  doctor_notes: string | null;
  patient_id: string;
  patients: PatientRecord | null;
  specialties: { name: string } | null;
}

export interface HistoryItem {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_notes: string | null;
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
      "id, doctor_id, status, scheduled_at, doctor_notes, patient_id, patients(*), specialties(name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data || data.doctor_id !== doctorId) return null;
  return data as unknown as AppointmentDetail;
}

/** Histórico de outras consultas do mesmo paciente (mais recentes primeiro). */
export async function getPatientHistory(
  patientId: string,
  excludeAppointmentId: string
): Promise<HistoryItem[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, doctor_notes, specialties(name)")
    .eq("patient_id", patientId)
    .neq("id", excludeAppointmentId)
    .order("scheduled_at", { ascending: false })
    .limit(10);

  return (data ?? []) as unknown as HistoryItem[];
}
