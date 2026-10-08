import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { listCustomExams } from "@/lib/customExams";

/** Exames personalizados salvos (sugestões extras no pedido de exame). */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json({ names: await listCustomExams() });
}
