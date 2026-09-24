import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/appointments/scheduled-patients?date=YYYY-MM-DD&specialtyId=xxx
 *
 * Lista os IDs dos pacientes que JÁ têm uma consulta marcada (não
 * cancelada) nessa data para essa especialidade — usado pra tirar
 * esses pacientes da lista de seleção ao agendar/adicionar na fila,
 * evitando duplicar o mesmo paciente na mesma especialidade no
 * mesmo dia.
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const specialtyId = req.nextUrl.searchParams.get("specialtyId");

  if (!date || !specialtyId) {
    return NextResponse.json(
      { error: "date e specialtyId são obrigatórios" },
      { status: 400 }
    );
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`).toISOString();
  const dayEnd = new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("specialty_id", specialtyId)
    .gte("scheduled_at", dayStart)
    .lt("scheduled_at", dayEnd)
    .neq("status", "cancelado");

  if (error) {
    console.error("Erro ao buscar pacientes já agendados:", error);
    return NextResponse.json({ error: "Falha ao buscar pacientes já agendados" }, { status: 500 });
  }

  const patientIds = Array.from(new Set((data ?? []).map((a) => a.patient_id)));
  return NextResponse.json({ patientIds });
}
