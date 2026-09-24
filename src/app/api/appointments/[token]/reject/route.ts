import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/appointments/:token/reject
 * Botão "Não sou eu" na cabine — a pessoa na frente da tela não é o
 * paciente que a atendente mandou. Volta a consulta pra fila (sem
 * mexer na posição) e avisa a atendente.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !appointment) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from("appointments")
    .update({
      status: "agendado",
      called_at: null,
      patient_joined_at: null,
      booth_rejected_at: new Date().toISOString(),
    })
    .eq("id", appointment.id);

  if (updateErr) {
    console.error("Erro ao registrar 'não sou eu':", updateErr);
    return NextResponse.json({ error: "Falha ao registrar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
