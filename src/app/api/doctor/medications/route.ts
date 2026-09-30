import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { searchMedications } from "@/lib/medications";

/** GET /api/doctor/medications?q=dipiro — sugestões pro campo Medicamento da receita. */
export async function GET(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ results: searchMedications(q.slice(0, 80)) });
}
