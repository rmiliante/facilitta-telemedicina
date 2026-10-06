import { NextRequest, NextResponse } from "next/server";
import { createManualUploadTicket } from "@/lib/manuals";

/** POST /api/admin/manuals/upload-url — URL assinada para enviar o arquivo direto ao Storage. */
export async function POST(req: NextRequest) {
  const { fileName } = await req.json().catch(() => ({}));
  if (typeof fileName !== "string" || !fileName.trim()) {
    return NextResponse.json({ error: "Nome do arquivo é obrigatório" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createManualUploadTicket(fileName));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao preparar o envio" }, { status: 500 });
  }
}
