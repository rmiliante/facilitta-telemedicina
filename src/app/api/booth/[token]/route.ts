import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/booth/:token
 * Tela pública da "cabine de atendimento" (paciente presencial, sem
 * login). O token é do MÉDICO (booth_token), fixo e não divulgado —
 * fica configurado só no computador daquela cabine. Devolve o nome
 * do médico e a fila de hoje, com o link (access_token) de cada
 * consulta pra entrar direto na sala.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data: doctor, error: doctorErr } = await supabase
    .from("doctors")
    .select("id, name, active, specialties(name)")
    .eq("booth_token", token)
    .maybeSingle();

  if (doctorErr || !doctor) {
    return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  }
  if (!doctor.active) {
    return NextResponse.json({ error: "Médico inativo" }, { status: 410 });
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayKey = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const dayStart = new Date(`${dayKey}T00:00:00.000Z`).toISOString();
  const dayEnd = new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, status, queue_position, called_at, patient_joined_at, access_token, patients(full_name, cpf), specialties(name)"
    )
    .eq("doctor_id", doctor.id)
    .gte("scheduled_at", dayStart)
    .lt("scheduled_at", dayEnd)
    .neq("status", "cancelado")
    .order("queue_position", { ascending: true, nullsFirst: false })
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar fila da cabine:", error);
    return NextResponse.json({ error: "Falha ao buscar fila" }, { status: 500 });
  }

  const withPosition = (data ?? []).filter((a) => a.queue_position != null);
  const withoutPosition = (data ?? []).filter((a) => a.queue_position == null);

  const doctorSpecialty = Array.isArray(doctor.specialties)
    ? doctor.specialties[0]?.name ?? null
    : (doctor.specialties as { name: string } | null)?.name ?? null;

  return NextResponse.json({
    doctor: { name: doctor.name, specialty: doctorSpecialty },
    queue: [...withPosition, ...withoutPosition],
  });
}
