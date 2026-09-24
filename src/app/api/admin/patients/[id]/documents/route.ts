import { NextRequest, NextResponse } from "next/server";
import {
  addPatientDocuments,
  removePatientDocument,
  signPatientDocuments,
  type PatientDocument,
} from "@/lib/patientDocuments";
import { getSupabaseAdmin } from "@/lib/supabase";

/** GET /api/admin/patients/:id/documents — lista os documentos do paciente (com link temporário). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("patients")
    .select("documents")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const files = await signPatientDocuments((data.documents as PatientDocument[] | null) ?? []);
  return NextResponse.json({ files });
}

/** POST /api/admin/patients/:id/documents — anexa um ou mais arquivos (multipart/form-data, campo "files"). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Envie os arquivos como multipart/form-data" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  try {
    const updated = await addPatientDocuments(id, files);
    const signed = await signPatientDocuments(updated);
    return NextResponse.json({ files: signed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao anexar documento" },
      { status: 500 }
    );
  }
}

/** DELETE /api/admin/patients/:id/documents — remove um documento anexado. Body: { path }. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { path } = body ?? {};

  if (typeof path !== "string" || !path) {
    return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
  }

  try {
    const updated = await removePatientDocument(id, path);
    const signed = await signPatientDocuments(updated);
    return NextResponse.json({ files: signed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao remover documento" },
      { status: 500 }
    );
  }
}
