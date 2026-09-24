import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

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

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayKey = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const dayStart = new Date(`${dayKey}T00:00:00.000Z`).toISOString();
  const dayEnd = new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

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

  return NextResponse.json({ pending: data ?? null });
}
