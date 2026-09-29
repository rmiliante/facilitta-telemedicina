import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { signPatientDocuments, type PatientDocument } from "@/lib/patientDocuments";

/**
 * GET /api/admin/patients/print-queue
 * Documentos emitidos pelos médicos (receitas, pedidos de exame,
 * atestados) que a atendente ainda não imprimiu — alimenta o aviso
 * "Receita nova para imprimir" na fila.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, documents")
    .filter("documents", "cs", JSON.stringify([{ needs_print: true }]))
    .limit(50);

  if (error) {
    console.error("Erro ao buscar documentos pra imprimir:", error);
    return NextResponse.json({ error: "Falha ao buscar documentos pra imprimir" }, { status: 500 });
  }

  const pending = [];
  for (const p of data ?? []) {
    const docs = ((p.documents as PatientDocument[] | null) ?? []).filter((d) => d.needs_print);
    for (const doc of await signPatientDocuments(docs)) {
      pending.push({ patientId: p.id, patientName: p.full_name, ...doc });
    }
  }
  pending.sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));

  return NextResponse.json({ pending });
}
