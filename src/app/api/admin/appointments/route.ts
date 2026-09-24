import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, access_token, queue_position, patients(id, full_name), doctors(id, name), specialties(id, name)"
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
 * Agenda uma nova consulta por ordem de chegada: marca-se a DATA, não
 * um horário. Checa antes se a especialidade ainda tem vaga dentro da
 * cota mensal contratada (ex: 50/mês), e se um médico for informado,
 * entra automaticamente no final da fila dele para aquele dia.
 *
 * Aceita `scheduledDate` (YYYY-MM-DD, formato novo) ou, por
 * compatibilidade, `scheduledAt` (datetime completo, formato antigo).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { patientId, doctorId, specialtyId, scheduledDate, scheduledAt } = body ?? {};

  const dateOnly = typeof scheduledDate === "string" && scheduledDate ? scheduledDate : null;
  const legacyDateTime = typeof scheduledAt === "string" && scheduledAt ? scheduledAt : null;

  if (
    typeof patientId !== "string" ||
    !patientId ||
    typeof specialtyId !== "string" ||
    !specialtyId ||
    (!dateOnly && !legacyDateTime)
  ) {
    return NextResponse.json(
      { error: "patientId, specialtyId e scheduledDate são obrigatórios" },
      { status: 400 }
    );
  }

  // Sempre grava ao meio-dia UTC daquele dia, pra evitar que o fuso
  // horário faça a data "andar" um dia pra frente ou pra trás.
  const scheduledAtIso = dateOnly ? `${dateOnly}T12:00:00.000Z` : new Date(legacyDateTime!).toISOString();
  const dayKey = scheduledAtIso.slice(0, 10);

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
  const scheduledDateObj = new Date(scheduledAtIso);
  const monthStart = new Date(
    Date.UTC(scheduledDateObj.getUTCFullYear(), scheduledDateObj.getUTCMonth(), 1)
  );
  const monthEnd = new Date(
    Date.UTC(scheduledDateObj.getUTCFullYear(), scheduledDateObj.getUTCMonth() + 1, 1)
  );

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

  const finalDoctorId = typeof doctorId === "string" && doctorId ? doctorId : null;
  let queuePosition: number | null = null;

  if (finalDoctorId) {
    const dayStart = new Date(`${dayKey}T00:00:00.000Z`).toISOString();
    const dayEnd = new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

    const { data: lastInQueue } = await supabase
      .from("appointments")
      .select("queue_position")
      .eq("doctor_id", finalDoctorId)
      .gte("scheduled_at", dayStart)
      .lt("scheduled_at", dayEnd)
      .neq("status", "cancelado")
      .order("queue_position", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    queuePosition = (lastInQueue?.queue_position ?? 0) + 1;
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      doctor_id: finalDoctorId,
      specialty_id: specialtyId,
      scheduled_at: scheduledAtIso,
      queue_position: queuePosition,
    })
    .select("*, patients(full_name), doctors(name), specialties(name)")
    .single();

  if (error) {
    console.error("Erro ao criar consulta:", error);
    return NextResponse.json({ error: "Falha ao agendar consulta" }, { status: 500 });
  }

  return NextResponse.json({ appointment });
}
