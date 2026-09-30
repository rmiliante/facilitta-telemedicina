import { NextResponse } from "next/server";
import { getCreditBalance, PrescreveError } from "@/lib/prescreve";

/** GET /api/admin/signing-credits — quantas assinaturas digitais ainda restam. */
export async function GET() {
  try {
    return NextResponse.json({ credits: await getCreditBalance() });
  } catch (err) {
    const message = err instanceof PrescreveError ? err.message : "Falha ao consultar o saldo";
    return NextResponse.json({ credits: null, error: message });
  }
}
