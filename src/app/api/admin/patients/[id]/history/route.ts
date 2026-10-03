import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { selectOptional } from "@/lib/appointments";
import { getStaffSession } from "@/lib/auth";
import { audit, patientName } from "@/lib/audit";

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
    "id, scheduled_at, status, called_at, finished_at, doctor_notes, chief_complaint, conduct, prescription_url, memed_prescription_at, memed_prescription_summary, vital_spo2, vital_bpm, vital_pa, vital_peso, vital_hgt, tipo_consulta, doctors(name), specialties(name)";
  const run = (cols: string) =>
    supabase.from("appointments").select(cols).eq("patient_id", id).order("scheduled_at", { ascending: false });

  // Colunas de migrações ainda não rodadas saem do select (antes, faltar a
  // de sinais vitais derrubava o histórico inteiro).
  const res = await selectOptional(run, columns);
  const data = res.data as Record<string, unknown>[] | null;
  const error = res.error;

  if (error) {
    console.error("Erro ao buscar histórico do paciente:", error);
    return NextResponse.json({ error: "Falha ao buscar histórico do paciente" }, { status: 500 });
  }

  // A recepção vê as consultas (data, médico, situação) pra organizar os
  // anexos, mas não o conteúdo clínico — isso fica pro médico e o admin.
  const staff = await getStaffSession();
  if (staff?.role === "atendente") {
    const safe = (data ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown>;
      return {
        id: r.id,
        scheduled_at: r.scheduled_at,
        status: r.status,
        tipo_consulta: r.tipo_consulta,
        called_at: r.called_at,
        finished_at: r.finished_at,
        doctors: r.doctors,
        specialties: r.specialties,
      };
    });
    await audit("staff", { action: "ver_historico", entity: "paciente", entityId: id, patientId: id, patientName: await patientName(id) });
    return NextResponse.json({ history: safe });
  }

  await audit("staff", { action: "ver_historico", entity: "paciente", entityId: id, patientId: id, patientName: await patientName(id) });
  return NextResponse.json({ history: data });
}
