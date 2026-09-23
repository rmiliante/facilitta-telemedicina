import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, access_token, patients(id, full_name), doctors(id, name), specialties(id, name)"
    )
    .order("scheduled_at", { ascending: true });

  if (from) query = query.gte("scheduled_at", from);
  if (to) query = query.lt("scheduled_at", to);

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao buscar consultas:", error);
    return NextResponse.json({ error: "Falha ao buscar consultas" }, { status: 500 });
  }
  return NextResponse.json({ appointments: data });
}

/**
 * POST /api/admin/appointments
 * Agenda uma nova consulta, checando antes se a especialidade ainda
 * tem vaga dentro da cota mensal contratada (ex: 50/mês).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { patientId, doctorId, specialtyId, scheduledAt } = body ?? {};

  if (
    typeof patientId !== "string" ||
    !patientId ||
    typeof specialtyId !== "string" ||
    !specialtyId ||
    typeof scheduledAt !== "string" ||
    !scheduledAt
  ) {
    return NextResponse.json(
      { error: "patientId, specialtyId e scheduledAt são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: specialty, error: specialtyErr } = await supabase
    .from("specialties")
    .select("id, name, monthly_quota")
    .eq("id", specialtyId)
    .maybeSingle();

  if (specialtyErr || !specialty) {
    return NextResponse.json({ error: "Especialidade não encontrada" }, { status: 404 });
  }

  // Conta quantas consultas dessa especialidade já existem no mesmo
  // mês/ano da data marcada (contando só as que não foram canceladas).
  const scheduledDate = new Date(scheduledAt);
  const monthStart = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), 1);
  const monthEnd = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth() + 1, 1);

  const { count, error: countErr } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("specialty_id", specialtyId)
    .neq("status", "cancelado")
    .gte("scheduled_at", monthStart.toISOString())
    .lt("scheduled_at", monthEnd.toISOString());

  if (countErr) {
    console.error("Erro ao contar consultas do mês:", countErr);
    return NextResponse.json({ error: "Falha ao checar limite mensal" }, { status: 500 });
  }

  if ((count ?? 0) >= specialty.monthly_quota) {
    return NextResponse.json(
      {
        error: `Limite mensal de ${specialty.monthly_quota} consultas de ${specialty.name} já foi atingido para esse mês.`,
      },
      { status: 409 }
    );
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      doctor_id: typeof doctorId === "string" && doctorId ? doctorId : null,
      specialty_id: specialtyId,
      scheduled_at: scheduledAt,
    })
    .select("*, patients(full_name), doctors(name), specialties(name)")
    .single();

  if (error) {
    console.error("Erro ao criar consulta:", error);
    return NextResponse.json({ error: "Falha ao agendar consulta" }, { status: 500 });
  }

  return NextResponse.json({ appointment });
}
