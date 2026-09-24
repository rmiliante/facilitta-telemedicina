import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/appointments/booth-alerts
 * Avisos de "não sou eu" clicados na cabine, pra atendente ver que
 * chamou a pessoa errada. Fica valendo até a atendente resolver
 * (reenviar esse paciente pro atendimento ou dispensar o aviso), o
 * mesmo sinal que aparece com o círculo amarelo na fila.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, booth_rejected_at, patients(full_name), doctors(name)")
    .not("booth_rejected_at", "is", null)
    .order("booth_rejected_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: "Falha ao buscar avisos" }, { status: 500 });
  }

  return NextResponse.json({ alerts: data ?? [] });
}
