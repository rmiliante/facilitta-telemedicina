import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isMissingColumnError, withoutVitals } from "@/lib/appointments";

/**
 * GET /api/admin/patients/:id/history
 * Histórico completo de atendimentos do paciente (mais recente primeiro),
 * com tudo que a médica registrou na consulta: data, início/fim, duração,
 * anotações, receita. Usado na ficha do paciente no admin, pra manter o
 * histórico médico visível independente de quem atendeu.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const columns =
    "id, scheduled_at, status, called_at, finished_at, doctor_notes, prescription_url, memed_prescription_at, memed_prescription_summary, vital_spo2, vital_bpm, vital_pa, vital_peso, vital_hgt, doctors(name), specialties(name)";
  const run = (cols: string) =>
    supabase.from("appointments").select(cols).eq("patient_id", id).order("scheduled_at", { ascending: false });

  let { data, error } = await run(columns);
  // Sem a migração de sinais vitais, as colunas vital_* não existem e o
  // histórico inteiro falhava ("Falha ao carregar o histórico médico").
  if (isMissingColumnError(error)) ({ data, error } = await run(withoutVitals(columns)));

  if (error) {
    console.error("Erro ao buscar histórico do paciente:", error);
    return NextResponse.json({ error: "Falha ao buscar histórico do paciente" }, { status: 500 });
  }

  return NextResponse.json({ history: data });
}
