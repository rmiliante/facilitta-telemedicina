import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/appointments/booth-alerts
 * Avisos de "não sou eu" clicados na cabine, pra atendente ver que
 * chamou a pessoa errada. Cada aviso é consumido (limpo) assim que
 * lido, pra não repetir a mesma notificação em toda atualização.
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

  const alerts = data ?? [];

  if (alerts.length > 0) {
    await supabase
      .from("appointments")
      .update({ booth_rejected_at: null })
      .in(
        "id",
        alerts.map((a) => a.id)
      );
  }

  return NextResponse.json({ alerts });
}
