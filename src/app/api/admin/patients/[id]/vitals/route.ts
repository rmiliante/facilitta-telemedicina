import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  cleanVitalValues,
  deleteVitalSign,
  findSameDayAppointment,
  insertVitalSign,
  listVitalSigns,
  parseMeasuredAt,
} from "@/lib/vitalSigns";
import { VITALS_MIGRATION_WARNING } from "@/lib/vitals";
import { audit, patientName } from "@/lib/audit";

/**
 * Aferições de sinais vitais do paciente (atendente e admin).
 * GET    → histórico (mais recente primeiro)
 * POST   → nova aferição { spo2, bpm, pa, peso, hgt, measuredAt?, appointmentId? }
 * DELETE → ?vitalId=... remove uma aferição lançada por engano
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { items, migrated } = await listVitalSigns(id);
    return NextResponse.json({ items, migrated, warning: migrated ? null : VITALS_MIGRATION_WARNING });
  } catch {
    return NextResponse.json({ error: "Falha ao buscar aferições" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const values = cleanVitalValues(body);
  if (!values) return NextResponse.json({ error: "Preencha pelo menos um sinal vital." }, { status: 400 });

  const staff = await getStaffSession();
  const measuredAt = parseMeasuredAt(body.measuredAt);
  let appointmentId: string | null = null;
  if (typeof body.appointmentId === "string" && body.appointmentId) {
    // Só aceita a consulta se ela for deste paciente.
    const { data } = await getSupabaseAdmin()
      .from("appointments")
      .select("id")
      .eq("id", body.appointmentId)
      .eq("patient_id", id)
      .maybeSingle();
    appointmentId = (data?.id as string | undefined) ?? null;
  }
  if (!appointmentId) appointmentId = await findSameDayAppointment(id, measuredAt);

  const result = await insertVitalSign({
    patientId: id,
    appointmentId,
    measuredAt,
    values,
    recordedByName: staff?.name ?? "Admin",
    recordedByRole: staff?.role ?? "admin",
  });
  if (result.missingTable) return NextResponse.json({ error: VITALS_MIGRATION_WARNING }, { status: 503 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  await audit("staff", { action: "registrar_afericao", entity: "afericao", patientId: id, patientName: await patientName(id) });
  return NextResponse.json({ item: result.item });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vitalId = req.nextUrl.searchParams.get("vitalId");
  if (!vitalId || vitalId.startsWith("appt-")) {
    return NextResponse.json({ error: "Aferição inválida" }, { status: 400 });
  }
  const ok = await deleteVitalSign(id, vitalId);
  if (ok) await audit("staff", { action: "excluir_afericao", entity: "afericao", entityId: vitalId, patientId: id, patientName: await patientName(id) });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Falha ao remover" }, { status: 500 });
}
