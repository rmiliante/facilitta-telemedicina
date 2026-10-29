import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { todayKeySaoPaulo, utcDayRange } from "@/lib/format";

/**
 * GET /api/admin/appointments/cabine
 * Quem está na cabine agora e quem é o próximo (consultas de hoje).
 *  - atual:   já confirmou a entrada na cabine e a consulta não terminou.
 *  - proximo: o primeiro enviado para a cabine que ainda não entrou (ordem
 *             do envio); sem ninguém enviado, o próximo da fila.
 */
interface Row {
  id: string;
  status: string;
  called_at: string | null;
  patient_joined_at: string | null;
  finished_at: string | null;
  booth_rejected_at: string | null;
  queue_position: number | null;
  scheduled_at: string;
  patients: { full_name: string } | null;
  doctors: { name: string } | null;
  specialties: { name: string } | null;
}

const t = (s: string | null) => (s ? new Date(s).getTime() : Number.MAX_SAFE_INTEGER);

export async function GET() {
  const { start, end } = utcDayRange(todayKeySaoPaulo());
  const { data, error } = await getSupabaseAdmin()
    .from("appointments")
    .select(
      "id, status, called_at, patient_joined_at, finished_at, booth_rejected_at, queue_position, scheduled_at, patients(full_name), doctors(name), specialties(name)"
    )
    .in("status", ["agendado", "em_andamento"])
    .gte("scheduled_at", start)
    .lt("scheduled_at", end);
  if (error) {
    console.error("Erro ao buscar situação da cabine:", error);
    return NextResponse.json({ error: "Falha ao buscar a cabine" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];
  const emAndamento = rows.filter((r) => r.status === "em_andamento" && !r.finished_at);

  const atualRow = emAndamento
    .filter((r) => r.patient_joined_at)
    .sort((a, b) => t(a.patient_joined_at) - t(b.patient_joined_at))[0];
  const enviado = emAndamento
    .filter((r) => !r.patient_joined_at && !r.booth_rejected_at)
    .sort((a, b) => t(a.called_at) - t(b.called_at))[0];
  const daFila = rows
    .filter((r) => r.status === "agendado")
    .sort((a, b) => (a.queue_position ?? 1e9) - (b.queue_position ?? 1e9) || t(a.scheduled_at) - t(b.scheduled_at))[0];

  const view = (r: Row | undefined, extra: Record<string, unknown> = {}) =>
    r
      ? {
          paciente: r.patients?.full_name ?? "Paciente",
          medico: r.doctors?.name ?? null,
          especialidade: r.specialties?.name ?? null,
          ...extra,
        }
      : null;

  return NextResponse.json({
    atual: view(atualRow, { desde: atualRow?.patient_joined_at ?? null, outros: emAndamento.filter((r) => r.patient_joined_at).length - 1 }),
    proximo: enviado
      ? view(enviado, { tipo: "enviado", enviadoAs: enviado.called_at })
      : view(daFila, { tipo: "fila", posicao: daFila?.queue_position ?? null }),
  });
}
