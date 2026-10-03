import { NextRequest, NextResponse } from "next/server";
import { attachPayoutFile, FinanceError, withFileUrls, type PayoutFileKind } from "@/lib/finance";

/** Resposta de erro padrão das rotas do financeiro. */
export function financeErrorResponse(err: unknown, fallback: string) {
  if (err instanceof FinanceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`${fallback}:`, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Recebe o arquivo (multipart, campo "file") e anexa ao fechamento. */
export async function handlePayoutUpload(req: NextRequest, id: string, kind: PayoutFileKind, uploadedBy: string | null) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie o arquivo" }, { status: 400 });
  try {
    const payout = await attachPayoutFile(id, kind, file, uploadedBy);
    return NextResponse.json({ payout: await withFileUrls(payout) });
  } catch (err) {
    return financeErrorResponse(err, kind === "nf" ? "Falha ao enviar a nota fiscal" : "Falha ao enviar o comprovante");
  }
}
