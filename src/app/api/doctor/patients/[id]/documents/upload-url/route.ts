import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { createPatientDocumentUploadTicket } from "@/lib/patientDocuments";

/**
 * POST /api/doctor/patients/:id/documents/upload-url
 * Primeiro passo do envio direto pro Storage: devolve uma URL assinada
 * (e o token dela) pra esse arquivo específico. O navegador sobe o
 * arquivo direto pra lá (sem passar pelo nosso servidor) e só depois
 * chama /finalize pra registrar na ficha do paciente. Existe pra PDFs
 * grandes (ex: todos os exames juntos) não esbarrarem no limite de
 * tamanho de requisição do nosso servidor.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

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
