import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cpfLikePattern, isDayKey, utcDayRange } from "@/lib/format";

/**
 * GET /api/doctor/appointments
 * Lista os atendimentos do médico logado (todas as datas, não só hoje),
 * com filtros opcionais por data, nome do paciente e CPF — pra ele
 * conseguir achar uma consulta antiga e ver/anexar exames do paciente.
 */
export async function GET(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date")?.trim();
  const name = req.nextUrl.searchParams.get("name")?.trim();
  const cpf = req.nextUrl.searchParams.get("cpf")?.trim();

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, called_at, finished_at, patients!inner(id, full_name, cpf, documents), specialties(name)"
    )
    .eq("doctor_id", session.doctorId)
    .order("scheduled_at", { ascending: false })
    .limit(200);

  if (date) {
    // Data inválida derrubava a rota com erro 500.
    if (!isDayKey(date)) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    const { start, end } = utcDayRange(date);
    query = query.gte("scheduled_at", start).lt("scheduled_at", end);
  }
  if (name) {
    query = query.ilike("patients.full_name", `%${name.replace(/[%_\\]/g, " ")}%`);
  }
  const cpfPattern = cpf ? cpfLikePattern(cpf) : null;
  if (cpfPattern) {
    // Acha o CPF com ou sem pontuação (antes só achava quem estava
    // cadastrado sem pontos e traço).
    query = query.ilike("patients.cpf", cpfPattern);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar atendimentos do médico:", error);
    return NextResponse.json({ error: "Falha ao buscar atendimentos" }, { status: 500 });
  }

  return NextResponse.json({ appointments: data });
}
