import { NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { todayKeySaoPaulo, utcDayRange } from "@/lib/format";
import { currentMonthSaoPaulo, doctorStatement, monthRange } from "@/lib/finance";

/**
 * GET /api/doctor/resumo — números da tela inicial do médico: fila e
 * atendidos de hoje, atendimentos do mês e repasse a receber.
 */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const today = utcDayRange(todayKeySaoPaulo());
  const month = monthRange(currentMonthSaoPaulo());

  const [todayRes, monthRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("status")
      .eq("doctor_id", session.doctorId)
      .gte("scheduled_at", today.start)
      .lt("scheduled_at", today.end),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", session.doctorId)
      .eq("status", "concluido")
      .gte("scheduled_at", month.start)
      .lt("scheduled_at", month.end),
  ]);
  if (todayRes.error || monthRes.error) {
    return NextResponse.json({ error: "Falha ao carregar o resumo" }, { status: 500 });
  }
  const todayRows = (todayRes.data ?? []) as { status: string }[];

  // Repasse: se o financeiro ainda não estiver no banco, só não mostra.
  let repasse: { aReceber: number; emAberto: number } | null = null;
  try {
    const st = await doctorStatement(session.doctorId);
    repasse = { aReceber: st.totals.aReceber, emAberto: st.totals.emAberto };
  } catch {
    repasse = null;
  }

  return NextResponse.json({
    filaHoje: todayRows.filter((r) => r.status === "agendado" || r.status === "em_andamento").length,
    atendidosHoje: todayRows.filter((r) => r.status === "concluido").length,
    atendidosMes: monthRes.count ?? 0,
    repasse,
  });
}
