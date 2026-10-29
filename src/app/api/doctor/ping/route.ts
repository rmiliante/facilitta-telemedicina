import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/doctor/ping
 * Sinal de "estou com o sistema aberto": a tela do médico chama isto a
 * cada minuto e o admin usa para mostrar quem está online.
 */
export async function POST() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { error } = await getSupabaseAdmin()
    .from("doctors")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.doctorId);
  // Sem a coluna (migration não rodada) não deve atrapalhar o médico.
  if (error) console.error("Erro no ping do médico:", error.message);
  return NextResponse.json({ ok: !error });
}
