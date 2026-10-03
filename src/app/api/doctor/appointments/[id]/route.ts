import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getOwnedAppointment, getPatientHistory } from "@/lib/appointments";
import { safeHttpUrl } from "@/lib/format";
import { audit } from "@/lib/audit";

/** GET /api/doctor/appointments/:id — detalhes da consulta + dados do paciente. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment) {
    return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });
  }

  const history = await getPatientHistory(appointment.patient_id, id);
  await audit("doctor", {
    action: "ver_consulta",
    entity: "consulta",
    entityId: id,
    patientId: appointment.patient_id,
    patientName: appointment.patients?.full_name ?? null,
  });

  return NextResponse.json({ appointment, history });
}

/**
 * PATCH /api/doctor/appointments/:id
 * Salva as anotações da consulta e/ou muda o status (ex: concluído).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment) {
    return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.doctorNotes === "string") update.doctor_notes = body.doctorNotes;
  // Resumo da consulta: aparece no histórico do paciente nas próximas consultas.
  if (typeof body.chiefComplaint === "string") update.chief_complaint = body.chiefComplaint.trim().slice(0, 500) || null;
  if (typeof body.conduct === "string") update.conduct = body.conduct.trim().slice(0, 3000) || null;
  if (typeof body.prescriptionUrl === "string") {
    const url = body.prescriptionUrl.trim();
    if (url && !safeHttpUrl(url)) {
      return NextResponse.json({ error: "Link da receita inválido (use um endereço https://)" }, { status: 400 });
    }
    update.prescription_url = url ? safeHttpUrl(url) : null;
  }
  if (typeof body.vitalSpo2 === "string") update.vital_spo2 = body.vitalSpo2.trim() || null;
  if (typeof body.vitalBpm === "string") update.vital_bpm = body.vitalBpm.trim() || null;
  if (typeof body.vitalPa === "string") update.vital_pa = body.vitalPa.trim() || null;
  if (typeof body.vitalPeso === "string") update.vital_peso = body.vitalPeso.trim() || null;
  if (typeof body.vitalHgt === "string") update.vital_hgt = body.vitalHgt.trim() || null;
  if (typeof body.memedPrescriptionSummary === "string" && body.memedPrescriptionSummary.trim()) {
    update.memed_prescription_summary = body.memedPrescriptionSummary.trim();
    update.memed_prescription_at = new Date().toISOString();
  }
  if (
    typeof body.status === "string" &&
    ["agendado", "em_andamento", "concluido", "cancelado", "faltou"].includes(body.status)
  ) {
    update.status = body.status;

    // Garante que fica registrado quando o atendimento começou, mesmo
    // se o médico iniciar a videochamada direto (sem a atendente ter
    // clicado em "Iniciar atendimento" antes).
    if (body.status === "em_andamento" && !appointment.called_at) {
      update.called_at = new Date().toISOString();
    }
    // Registra o fim, pra calcular o tempo total de atendimento.
    if (body.status === "concluido" && !appointment.finished_at) {
      update.finished_at = new Date().toISOString();
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let { error } = await supabase.from("appointments").update(update).eq("id", id);
  // Sem a migração do resumo, salva o resto (anotações, status) e avisa.
  let warning: string | undefined;
  if (error && (error.code === "42703" || error.code === "PGRST204") && /chief_complaint|conduct/.test(error.message ?? "")) {
    delete update.chief_complaint;
    delete update.conduct;
    warning = "Queixa principal e conduta não foram salvas: falta rodar supabase/migration_auditoria_relatorios.sql.";
    ({ error } = Object.keys(update).length ? await supabase.from("appointments").update(update).eq("id", id) : { error: null });
  }

  if (error) {
    console.error("Erro ao atualizar consulta:", error);
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }

  // Autosave de anotação chama isso a cada pausa na digitação: registra só
  // mudanças de status (o que importa pra auditoria), não cada tecla.
  if (typeof update.status === "string") {
    await audit("doctor", {
      action: "salvar_consulta",
      entity: "consulta",
      entityId: id,
      patientId: appointment.patient_id,
      patientName: appointment.patients?.full_name ?? null,
      details: { status: update.status },
    });
  }
  return NextResponse.json({ ok: true, warning });
}
