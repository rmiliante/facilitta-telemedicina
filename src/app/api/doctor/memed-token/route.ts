import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMemedDoctorToken, getMemedScriptUrl, isMemedHomologacao } from "@/lib/memed";

/**
 * GET /api/doctor/memed-token
 * Busca um token de acesso FRESCO do prescritor na Memed (o token
 * muda, então nunca guardamos ele — buscamos de novo a cada vez que
 * o médico vai abrir o módulo de prescrição).
 */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, memed_linked_at")
    .eq("id", session.doctorId)
    .maybeSingle();

  if (!doctor?.memed_linked_at) {
    return NextResponse.json(
      { error: "Esse médico ainda não foi vinculado à Memed. Peça pra Admin vincular no cadastro." },
      { status: 400 }
    );
  }

  const token = await getMemedDoctorToken(doctor.id);
  if (!token) {
    return NextResponse.json({ error: "Falha ao obter token da Memed" }, { status: 502 });
  }

  return NextResponse.json({
    token,
    scriptUrl: getMemedScriptUrl(),
    homologacao: isMemedHomologacao(),
  });
}
