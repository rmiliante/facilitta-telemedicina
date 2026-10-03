import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { handlePayoutUpload } from "@/lib/financeApi";

/** POST multipart { file } — anexa (ou troca) a nota fiscal do repasse, pelo admin. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaffSession();
  return handlePayoutUpload(req, id, "nf", staff?.name ?? "Administração");
}
