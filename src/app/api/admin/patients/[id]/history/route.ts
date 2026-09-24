import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

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

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, called_at, finished_at, doctor_notes, prescription_url, memed_prescription_at, memed_prescription_summary, doctors(name), specialties(name)"
    )
    .eq("patient_id", id)
    .order("scheduled_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar histórico do paciente:", error);
    return NextResponse.json({ error: "Falha ao buscar histórico do paciente" }, { status: 500 });
  }

  return NextResponse.json({ history: data });
}
