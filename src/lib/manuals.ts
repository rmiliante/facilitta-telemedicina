import { getSupabaseAdmin } from "@/lib/supabase";

export const MANUALS_BUCKET = "manuais";
export const MANUAL_MAX_BYTES = 25 * 1024 * 1024;

export function sanitizeFileName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "arquivo";
}

/** Próximo rótulo de versão: "v1.2" → "v1.3"; sem padrão, "v{n+1}.0". */
export function nextVersionLabel(last: string | null | undefined, count: number): string {
  const m = last?.match(/v?(\d+)\.(\d+)/i);
  if (m) return `v${m[1]}.${Number(m[2]) + 1}`;
  return `v${count + 1}.0`;
}

export interface ManualVersionRow {
  id: string;
  manual_id: string;
  version_label: string;
  notes: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export async function createManualUploadTicket(fileName: string) {
  const supabase = getSupabaseAdmin();
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const { data, error } = await supabase.storage.from(MANUALS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Falha ao preparar o envio do arquivo");
  return { path, token: data.token };
}

/** O arquivo registrado precisa ser de um envio feito por esta rota (pasta do ano) e existir no bucket. */
export async function assertUploaded(path: string): Promise<boolean> {
  if (!/^\d{4}\/[0-9a-f-]{36}-[A-Za-z0-9._-]+$/.test(path)) return false;
  const supabase = getSupabaseAdmin();
  const [folder, file] = path.split("/");
  const { data } = await supabase.storage.from(MANUALS_BUCKET).list(folder, { search: file.slice(0, 40) });
  return !!data?.some((f) => f.name === file);
}
