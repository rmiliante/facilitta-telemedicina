import { NextRequest, NextResponse } from "next/server";
import { finalizePatientDocument, signPatientDocuments } from "@/lib/patientDocuments";

/**
 * POST /api/admin/patients/:id/documents/finalize
 * Segundo passo do envio direto pro Storage: registra na ficha do
 * paciente o arquivo que o navegador já subiu direto pra URL assinada.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { path, name } = body ?? {};

  if (typeof path !== "string" || !path || typeof name !== "string" || !name) {
    return NextResponse.json({ error: "path e name são obrigatórios" }, { status: 400 });
  }

  try {
    const updated = await finalizePatientDocument(id, path, name);
    const signed = await signPatientDocuments(updated);
    return NextResponse.json({ files: signed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao registrar o arquivo" },
      { status: 500 }
    );
  }
}
