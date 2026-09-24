"use client";

import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

// Mesmo bucket de src/lib/examFiles.ts — repetido aqui (em vez de
// importado) pra esse arquivo não puxar nada do lado servidor
// (getSupabaseAdmin, service role key) pro bundle do navegador.
const EXAM_FILES_BUCKET = "exames";

/**
 * Envia um arquivo do paciente direto pro Storage, sem passar pelo
 * nosso servidor — evita o limite de tamanho de requisição que fazia
 * PDFs grandes (todos os exames juntos) serem recusados.
 *
 * Fluxo em 2 passos:
 * 1. Pede uma URL assinada em `${basePath}/upload-url`.
 * 2. Sobe o arquivo direto pro Storage com ela, e confirma em
 *    `${basePath}/finalize` pra ficar registrado na ficha do paciente.
 *
 * `basePath` é a raiz da rota de documentos do paciente, ex:
 * "/api/doctor/patients/123/documents" ou "/api/admin/patients/123/documents".
 */
export async function uploadPatientDocument(basePath: string, file: File): Promise<{ files: unknown[] }> {
  const ticketRes = await fetch(`${basePath}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name }),
  });
  if (!ticketRes.ok) {
    const err = await ticketRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Falha ao preparar envio de "${file.name}"`);
  }
  const { path, token } = (await ticketRes.json()) as { path: string; token: string };

  const supabase = getSupabaseBrowser();
  const { error: uploadErr } = await supabase.storage.from(EXAM_FILES_BUCKET).uploadToSignedUrl(path, token, file);
  if (uploadErr) {
    throw new Error(`Falha ao enviar "${file.name}": ${uploadErr.message}`);
  }

  const finalizeRes = await fetch(`${basePath}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, name: file.name }),
  });
  if (!finalizeRes.ok) {
    const err = await finalizeRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Arquivo "${file.name}" enviado, mas falha ao registrar`);
  }
  return finalizeRes.json();
}

/** Envia vários arquivos em sequência; retorna a lista final (já com o último enviado). */
export async function uploadPatientDocuments<T>(basePath: string, files: File[]): Promise<T[]> {
  let files_: T[] = [];
  for (const file of files) {
    const result = (await uploadPatientDocument(basePath, file)) as { files: T[] };
    files_ = result.files;
  }
  return files_;
}
