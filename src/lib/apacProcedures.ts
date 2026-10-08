import { getSupabaseAdmin } from "@/lib/supabase";
import { examKey } from "@/lib/customExams";

/** Laudo para solicitação de APAC: dados extras do paciente e procedimentos usados. */

export interface ApacInput {
  cns: string;
  motherName: string;
  sex: string;
  address: string;
  cep: string;
  cid: string;
  cid2: string;
}

function str(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function cleanApac(raw: unknown): ApacInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sex = str(r.sex, 20);
  return {
    cns: str(r.cns, 40).replace(/\D/g, ""),
    motherName: str(r.motherName, 200),
    sex: sex === "Feminino" || sex === "Masculino" ? sex : "",
    address: str(r.address, 300),
    cep: str(r.cep, 12),
    cid: str(r.cid, 20).toUpperCase(),
    cid2: str(r.cid2, 20).toUpperCase(),
  };
}

export function validateApac(a: ApacInput, procedure: string, justificativa: string): string | null {
  if (!procedure) return "Informe o procedimento solicitado";
  if (a.cns.length !== 15) return "Informe o CNS (Cartão SUS) do paciente, com 15 números";
  if (!a.motherName) return "Informe o nome da mãe do paciente";
  if (!a.address) return "Informe o endereço do paciente";
  if (!a.cid) return "Informe o CID-10 principal";
  if (!justificativa) return "Escreva a justificativa clínica";
  return null;
}

export async function listApacProcedures(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("apac_procedures")
    .select("name")
    .order("name", { ascending: true })
    .limit(2000);
  if (error) return [];
  return (data ?? []).map((r) => r.name as string);
}

/** Guarda o procedimento digitado pra sugerir nos próximos laudos. Nunca derruba a emissão. */
export async function saveApacProcedure(name: string, doctorId: string) {
  try {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 300);
    const key = examKey(clean);
    if (clean.length < 3 || !key) return;
    await getSupabaseAdmin()
      .from("apac_procedures")
      .upsert({ name: clean, name_key: key, created_by_doctor_id: doctorId }, { onConflict: "name_key", ignoreDuplicates: true });
  } catch (err) {
    console.error("Falha ao salvar procedimento APAC:", err);
  }
}

/** Atualiza o cadastro do paciente com os dados completados no laudo. Nunca derruba a emissão. */
export async function savePatientApacData(patientId: string, a: ApacInput) {
  try {
    await getSupabaseAdmin()
      .from("patients")
      .update({ cns: a.cns, mother_name: a.motherName, sex: a.sex || null, address: a.address, cep: a.cep || null })
      .eq("id", patientId);
  } catch (err) {
    console.error("Falha ao atualizar o cadastro do paciente:", err);
  }
}
