import { NextRequest, NextResponse } from "next/server";
import { createPatientDocumentUploadTicket } from "@/lib/patientDocuments";

/**
 * POST /api/admin/patients/:id/documents/upload-url
 * Primeiro passo do envio direto pro Storage (ver a versão do médico
 * pra detalhes do porquê): devolve uma URL assinada pra esse arquivo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const fileName = body?.fileName;

  if (typeof fileName !== "string" || !fileName.trim()) {
    return NextResponse.json({ error: "fileName é obrigatório" }, { status: 400 });
  }

  try {
    const ticket = await createPatientDocumentUploadTicket(id, fileName);
    return NextResponse.json(ticket);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao preparar envio do arquivo" },
      { status: 500 }
    );
  }
}
