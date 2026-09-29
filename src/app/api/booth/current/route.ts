import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { maskCpf, todayKeySaoPaulo, utcDayRange } from "@/lib/format";

/**
 * GET /api/booth/current
 * Link único e genérico da cabine de atendimento presencial (sem
 * token de médico ou paciente — não precisa, porque a consulta já
 * está vinculada ao médico certo). Devolve o paciente que a
 * atendente acabou de mandar pra cabine (status em_andamento e ainda
 * não confirmou entrada), se houver algum; senão devolve null e a
 * tela fica em branco esperando.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  // "Hoje" no fuso de São Paulo (antes era o dia UTC, que virava às 21h).
  const { start: dayStart, end: dayEnd } = utcDayRange(todayKeySaoPaulo());

  const { data, error } = await supabase
    .from("appointments")
    .select("id, access_token, called_at, patients(full_name, cpf), doctors(name), specialties(name)")
    .eq("status", "em_andamento")
    .is("patient_joined_at", null)
    .gte("scheduled_at", dayStart)
    .lt("scheduled_at", dayEnd)
    .order("called_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar paciente atual da cabine:", error);
    return NextResponse.json({ error: "Falha ao buscar atendimento atual" }, { status: 500 });
  }

  // Rota pública: nunca devolve o CPF completo, só parte dele (o
  // suficiente pra pessoa na cabine confirmar que é ela).
  const pending = data
    ? (() => {
        const patient = data.patients as unknown as { full_name: string; cpf: string | null } | null;
        return {
          ...data,
          patients: patient ? { full_name: patient.full_name, cpf: maskCpf(patient.cpf) } : null,
        };
      })()
    : null;

  return NextResponse.json({ pending });
}
