import { getSupabaseAdmin } from "@/lib/supabase";

export const DOCTOR_APPLICATIONS_BUCKET = "candidaturas";

/** Tempo de validade do link assinado gerado pra ver a foto no admin. */
const SIGNED_URL_EXPIRES_IN = 60 * 60; // 1 hora

export const APPLICATION_STATUSES = ["novo", "em_avaliacao", "aprovado", "recusado"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const WEEKDAYS = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
] as const;

export const SHIFTS = [
  { key: "manha", label: "Manhã" },
  { key: "tarde", label: "Tarde" },
  { key: "noite", label: "Noite" },
] as const;

export const SPECIALTIES = [
  "Alergia e Imunologia",
  "Anestesiologia",
  "Cardiologia",
  "Cirurgia Geral",
  "Clínico Geral",
  "Dermatologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Geriatria",
  "Ginecologia e Obstetrícia",
  "Infectologia",
  "Nefrologia",
  "Neurologia",
  "Nutrologia",
  "Oftalmologia",
  "Oncologia",
  "Ortopedia",
  "Otorrinolaringologia",
  "Pediatria",
  "Pneumologia",
  "Psiquiatria",
  "Reumatologia",
  "Urologia",
  "Psicologia",
  "Nutrição",
  "Outra",
] as const;

export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

/** Envia a foto de perfil enviada no formulário público pro bucket privado. */
export async function uploadApplicationPhoto(file: File): Promise<string> {
  const supabase = getSupabaseAdmin();
  const path = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(DOCTOR_APPLICATIONS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });

  if (error) {
    throw new Error(`Falha ao enviar a foto: ${error.message}`);
  }
  return path;
}

/** Gera um link assinado (temporário) pra visualizar a foto no admin. */
export async function signApplicationPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(DOCTOR_APPLICATIONS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN);

  if (error || !data) return null;
  return data.signedUrl;
}
