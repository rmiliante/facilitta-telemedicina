import { getSupabaseAdmin } from "@/lib/supabase";

export const EXAM_FILES_BUCKET = "exames";

/** Tempo de validade do link assinado gerado pra visualizar/baixar um arquivo. */
const SIGNED_URL_EXPIRES_IN = 60 * 60; // 1 hora

export interface ExamFile {
  path: string;
  name: string;
  uploaded_at: string;
}

export interface ExamFileWithUrl extends ExamFile {
  url: string | null;
}

/** Gera links assinados (temporários) pra visualizar/baixar uma lista de arquivos do bucket privado. */
export async function signExamFiles(files: ExamFile[]): Promise<ExamFileWithUrl[]> {
  if (files.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(EXAM_FILES_BUCKET)
    .createSignedUrls(
      files.map((f) => f.path),
      SIGNED_URL_EXPIRES_IN
    );

  if (error || !data) {
    return files.map((f) => ({ ...f, url: null }));
  }

  return files.map((f, i) => ({ ...f, url: data[i]?.signedUrl ?? null }));
}
