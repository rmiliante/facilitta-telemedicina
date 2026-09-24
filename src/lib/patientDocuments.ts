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
export async function addPatientDocuments(patientId: string, files: File[]): Promise<PatientDocument[]> {
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

    uploaded.push({ path, name: file.name, uploaded_at: new Date().toISOString() });
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
