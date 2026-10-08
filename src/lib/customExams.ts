import { getSupabaseAdmin } from "@/lib/supabase";
import { findExam, searchExams } from "@/lib/examSearch";

/**
 * Exames digitados à mão pelo médico (fora da lista padrão) ficam salvos
 * e passam a aparecer nas sugestões de todos os médicos.
 */

export function examKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Já existe na lista padrão (nome exato ou sigla idêntica)? */
function inStandardList(name: string) {
  if (findExam(name)) return true;
  const key = examKey(name);
  return searchExams(name, 5).some((h) => h.matched && examKey(h.matched) === key);
}

export async function listCustomExams(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("custom_exams")
    .select("name")
    .order("name", { ascending: true })
    .limit(2000);
  if (error) return [];
  return (data ?? []).map((r) => r.name as string);
}

/** Salva os exames novos de um pedido emitido. Nunca derruba a emissão. */
export async function saveCustomExams(names: string[], doctorId: string) {
  try {
    const seen = new Set<string>();
    const rows = [];
    for (const raw of names) {
      const name = raw.trim().replace(/\s+/g, " ").slice(0, 300);
      const key = examKey(name);
      if (name.length < 3 || !key || seen.has(key) || inStandardList(name)) continue;
      seen.add(key);
      rows.push({ name, name_key: key, created_by_doctor_id: doctorId });
    }
    if (rows.length === 0) return;
    await getSupabaseAdmin().from("custom_exams").upsert(rows, { onConflict: "name_key", ignoreDuplicates: true });
  } catch (err) {
    console.error("Falha ao salvar exame personalizado:", err);
  }
}
