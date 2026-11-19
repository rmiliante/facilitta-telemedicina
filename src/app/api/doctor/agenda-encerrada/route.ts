import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { todayKeySaoPaulo } from "@/lib/format";

/** GET → { pendente }: a atendente encerrou a agenda de hoje e a médica ainda não clicou em Fechar. */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data } = await getSupabaseAdmin()
    .from("agenda_encerrada")
    .select("closed_at")
    .eq("day", todayKeySaoPaulo())
    .eq("doctor_id", session.doctorId)
    .is("ack_at", null)
    .maybeSingle();
  return NextResponse.json({ pendente: !!data, closedAt: data?.closed_at ?? null });
}

/** POST → a médica clicou em Fechar. */
export async function POST() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  await getSupabaseAdmin()
    .from("agenda_encerrada")
    .update({ ack_at: new Date().toISOString() })
    .eq("day", todayKeySaoPaulo())
    .eq("doctor_id", session.doctorId);
  return NextResponse.json({ ok: true });
}
