import { NextRequest, NextResponse } from "next/server";
import { attachReceipt, receiptUrl } from "@/lib/finance";
import { financeErrorResponse } from "@/lib/financeApi";

/** POST multipart { file } — anexa (ou troca) o comprovante do pagamento. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie o arquivo do comprovante" }, { status: 400 });
  try {
    const payout = await attachReceipt(id, file);
    return NextResponse.json({ payout: { ...payout, receipt_url: await receiptUrl(payout.receipt_path) } });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao enviar o comprovante");
  }
}
