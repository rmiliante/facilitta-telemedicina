import { NextRequest, NextResponse } from "next/server";
import { markPatientDocumentPrinted, signPatientDocuments } from "@/lib/patientDocuments";

/** POST /api/admin/patients/:id/documents/printed — marca o documento como impresso. Body: { path }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.path !== "string" || !body.path) {
    return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
  }
  try {
    const updated = await markPatientDocumentPrinted(id, body.path);
    return NextResponse.json({ files: await signPatientDocuments(updated) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao marcar como impresso" },
      { status: 500 }
    );
  }
}
