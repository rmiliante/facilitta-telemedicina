import { getSupabaseAdmin } from "@/lib/supabase";
import { cpfLikePattern } from "@/lib/format";

/** Pacientes com exatamente esse CPF (comparando só os dígitos). */
export async function findPatientsByCpf(cpf: unknown) {
  const digits = typeof cpf === "string" ? cpf.replace(/\D/g, "") : "";
  if (digits.length !== 11) return [];
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("patients")
    .select("id, full_name, cpf, birth_date, phone, city, state, created_at")
    .ilike("cpf", cpfLikePattern(digits)!)
    .order("created_at", { ascending: true });
  return (data ?? []).filter((p) => (p.cpf ?? "").replace(/\D/g, "") === digits);
}
