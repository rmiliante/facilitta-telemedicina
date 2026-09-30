import { getSupabaseAdmin } from "@/lib/supabase";
import { EXAM_FILES_BUCKET, signExamFiles, type ExamFile, type ExamFileWithUrl } from "@/lib/examFiles";

export type PatientDocument = ExamFile;
export type PatientDocumentWithUrl = ExamFileWithUrl;

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

/**
 * Documentos do paciente (pedidos de exame, resultados, laudos etc.) —
 * ficam ligados ao PACIENTE, não a uma consulta específica. Assim, o
 * médico vê em qualquer atendimento tudo que já foi anexado daquele
 * paciente, não só o que entrou junto de um agendamento em particular.
 */
export type DocumentOrigin = Pick<PatientDocument, "source" | "appointment_id">;

/** Aceita só um id de consulta com formato válido (vem do navegador). */
export function cleanAppointmentId(value: unknown): string | undefined {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined;
}

export async function addPatientDocuments(
  patientId: string,
  files: File[],
  origin: DocumentOrigin = {}
): Promise<PatientDocument[]> {
  const supabase = getSupabaseAdmin();

  const { data: current, error: fetchErr } = await supabase
    .from("patients")
    .select("documents")
    .eq("id", patientId)
    .maybeSingle();

  if (fetchErr || !current) {
    throw new Error("Paciente não encontrado");
  }

  const existing = (current.documents as PatientDocument[] | null) ?? [];
  const uploaded: PatientDocument[] = [];

  for (const file of files) {
    const path = `pacientes/${patientId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const { error: uploadErr } = await supabase.storage
      .from(EXAM_FILES_BUCKET)
      .upload(path, file, { contentType: file.type || undefined });

    if (uploadErr) {
      throw new Error(`Falha ao enviar "${file.name}": ${uploadErr.message}`);
    }

    uploaded.push({ path, name: file.name, uploaded_at: new Date().toISOString(), ...origin });
  }

  const nextDocuments = [...existing, ...uploaded];

  const { error: updateErr } = await supabase
    .from("patients")
    .update({ documents: nextDocuments })
    .eq("id", patientId);

  if (updateErr) {
    throw new Error("Documentos enviados, mas falha ao salvar no cadastro do paciente");
  }

  return nextDocuments;
}

/**
 * Prepara um envio direto do navegador pro Storage (URL assinada de
 * upload): o arquivo grande vai direto pro Supabase sem passar pelo
 * nosso servidor, evitando o limite de tamanho de requisição da
 * hospedagem (é o que fazia PDFs grandes com todos os exames juntos
 * serem recusados). Depois do upload, chame finalizePatientDocument
 * pra registrar o arquivo na ficha do paciente.
 */
export async function createPatientDocumentUploadTicket(
  patientId: string,
  fileName: string
): Promise<{ path: string; token: string }> {
  const supabase = getSupabaseAdmin();
  const path = `pacientes/${patientId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabase.storage.from(EXAM_FILES_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error("Falha ao preparar o envio do arquivo");
  }

  return { path, token: data.token };
}

/** Registra na ficha do paciente um arquivo que já foi enviado direto pro Storage (ver ticket acima). */
export async function finalizePatientDocument(
  patientId: string,
  path: string,
  name: string,
  origin: DocumentOrigin = {}
): Promise<PatientDocument[]> {
  // Só aceita arquivos da pasta desse paciente (o caminho vem do
  // navegador — sem isso, dava pra "anexar" arquivo de outro paciente).
  if (!path.startsWith(`pacientes/${patientId}/`) || path.includes("..")) {
    throw new Error("Arquivo inválido para esse paciente");
  }

  const supabase = getSupabaseAdmin();

  const { data: current, error: fetchErr } = await supabase
    .from("patients")
    .select("documents")
    .eq("id", patientId)
    .maybeSingle();

  if (fetchErr || !current) {
    throw new Error("Paciente não encontrado");
  }

  const existing = (current.documents as PatientDocument[] | null) ?? [];
  const nextDocuments = [...existing, { path, name, uploaded_at: new Date().toISOString(), ...origin }];

  const { error: updateErr } = await supabase
    .from("patients")
    .update({ documents: nextDocuments })
    .eq("id", patientId);

  if (updateErr) {
    throw new Error("Arquivo enviado, mas falha ao salvar no cadastro do paciente");
  }

  return nextDocuments;
}

export async function removePatientDocument(patientId: string, path: string): Promise<PatientDocument[]> {
  const supabase = getSupabaseAdmin();

  const { data: current, error: fetchErr } = await supabase
    .from("patients")
    .select("documents")
    .eq("id", patientId)
    .maybeSingle();

  if (fetchErr || !current) {
    throw new Error("Paciente não encontrado");
  }

  const existing = (current.documents as PatientDocument[] | null) ?? [];
  // Só apaga do Storage se o arquivo for mesmo desse paciente — antes,
  // qualquer caminho enviado era apagado do bucket.
  if (!existing.some((f) => f.path === path)) {
    throw new Error("Documento não encontrado nesse paciente");
  }
  const nextDocuments = existing.filter((f) => f.path !== path);

  await supabase.storage.from(EXAM_FILES_BUCKET).remove([path]);

  const { error: updateErr } = await supabase
    .from("patients")
    .update({ documents: nextDocuments })
    .eq("id", patientId);

  if (updateErr) {
    throw new Error("Falha ao remover documento do cadastro do paciente");
  }

  return nextDocuments;
}

/** Reaproveita o mesmo gerador de link assinado usado pros exames de consulta. */
export const signPatientDocuments = signExamFiles;

/**
 * Salva no cadastro do paciente um PDF gerado pelo sistema (receita,
 * pedido de exame ou atestado já assinados), marcado pra atendente imprimir.
 */
export async function addGeneratedPatientDocument(
  patientId: string,
  pdf: Uint8Array,
  fileName: string,
  meta: Pick<PatientDocument, "kind" | "signed" | "author" | "appointment_id" | "needs_print">
): Promise<PatientDocument> {
  const supabase = getSupabaseAdmin();
  const path = `pacientes/${patientId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;

  const { error: uploadErr } = await supabase.storage
    .from(EXAM_FILES_BUCKET)
    .upload(path, pdf, { contentType: "application/pdf" });
  if (uploadErr) throw new Error(`Falha ao salvar o PDF: ${uploadErr.message}`);

  const { data: current, error: fetchErr } = await supabase
    .from("patients")
    .select("documents")
    .eq("id", patientId)
    .maybeSingle();
  if (fetchErr || !current) throw new Error("Paciente não encontrado");

  const doc: PatientDocument = { path, name: fileName, uploaded_at: new Date().toISOString(), source: "medico", ...meta };
  const existing = (current.documents as PatientDocument[] | null) ?? [];
  const { error: updateErr } = await supabase
    .from("patients")
    .update({ documents: [...existing, doc] })
    .eq("id", patientId);
  if (updateErr) throw new Error("PDF salvo, mas falha ao registrar no cadastro do paciente");

  return doc;
}

/** Marca um documento como impresso (tira o aviso da fila da atendente). */
export async function markPatientDocumentPrinted(patientId: string, path: string): Promise<PatientDocument[]> {
  const supabase = getSupabaseAdmin();
  const { data: current, error } = await supabase
    .from("patients")
    .select("documents")
    .eq("id", patientId)
    .maybeSingle();
  if (error || !current) throw new Error("Paciente não encontrado");

  const existing = (current.documents as PatientDocument[] | null) ?? [];
  if (!existing.some((d) => d.path === path)) throw new Error("Documento não encontrado nesse paciente");

  const next = existing.map((d) =>
    d.path === path ? { ...d, needs_print: false, printed_at: new Date().toISOString() } : d
  );
  const { error: updateErr } = await supabase.from("patients").update({ documents: next }).eq("id", patientId);
  if (updateErr) throw new Error("Falha ao marcar como impresso");
  return next;
}
