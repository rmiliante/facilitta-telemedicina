import { getSupabaseAdmin } from "@/lib/supabase";
import { monthRange } from "@/lib/finance";

/**
 * Relatório mensal (prestação de contas à prefeitura): uso da cota por
 * especialidade, comparecimento, faltas, cancelamentos, pacientes
 * atendidos, duração média e produção por médico. Também lista quem
 * faltou várias vezes nos últimos 90 dias.
 */

interface Row {
  id: string;
  status: string;
  patient_id: string;
  specialty_id: string;
  doctor_id: string | null;
  called_at: string | null;
  finished_at: string | null;
  specialties: { name: string } | null;
  doctors: { name: string } | null;
}

function duration(r: Pick<Row, "status" | "called_at" | "finished_at">): number | null {
  if (r.status !== "concluido" || !r.called_at || !r.finished_at) return null;
  const min = Math.round((new Date(r.finished_at).getTime() - new Date(r.called_at).getTime()) / 60000);
  return min >= 0 && min <= 720 ? min : null;
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

/** Quantos faltaram no período (concluído + faltou = quem deveria vir). */
function faltaTaxa(realizados: number, faltas: number) {
  return pct(faltas, realizados + faltas);
}

export async function monthlyReport(month: string) {
  const supabase = getSupabaseAdmin();
  const { start, end } = monthRange(month);
  const since90 = new Date(new Date(end).getTime() - 90 * 86400000).toISOString();

  const [apptRes, specRes, faltasRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, patient_id, specialty_id, doctor_id, called_at, finished_at, specialties(name), doctors(name)")
      .gte("scheduled_at", start)
      .lt("scheduled_at", end),
    supabase.from("specialties").select("id, name, monthly_quota").order("name", { ascending: true }),
    supabase
      .from("appointments")
      .select("patient_id, scheduled_at, patients(full_name, phone)")
      .eq("status", "faltou")
      .gte("scheduled_at", since90)
      .lt("scheduled_at", end),
  ]);
  for (const r of [apptRes, specRes, faltasRes]) if (r.error) throw r.error;

  const rows = (apptRes.data ?? []) as unknown as Row[];
  const specs = (specRes.data ?? []) as { id: string; name: string; monthly_quota: number }[];
  const count = (list: Row[], status: string) => list.filter((r) => r.status === status).length;

  const especialidades = specs
    .map((s) => {
      const list = rows.filter((r) => r.specialty_id === s.id);
      const naoCancelados = list.filter((r) => r.status !== "cancelado").length;
      const realizados = count(list, "concluido");
      const faltas = count(list, "faltou");
      return {
        id: s.id,
        name: s.name,
        cota: s.monthly_quota,
        agendados: naoCancelados,
        usoCota: pct(naoCancelados, s.monthly_quota),
        realizados,
        faltas,
        cancelados: count(list, "cancelado"),
        taxaFaltas: faltaTaxa(realizados, faltas),
        duracaoMedia: avg(list.map(duration).filter((m): m is number => m !== null)),
      };
    })
    .filter((s) => s.agendados > 0 || s.cancelados > 0 || s.cota > 0);

  const byDoctor = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.doctor_id) continue;
    byDoctor.set(r.doctor_id, [...(byDoctor.get(r.doctor_id) ?? []), r]);
  }
  const medicos = [...byDoctor.entries()]
    .map(([id, list]) => {
      const realizados = count(list, "concluido");
      const faltas = count(list, "faltou");
      return {
        id,
        name: list[0].doctors?.name ?? "—",
        realizados,
        faltas,
        taxaFaltas: faltaTaxa(realizados, faltas),
        duracaoMedia: avg(list.map(duration).filter((m): m is number => m !== null)),
      };
    })
    .sort((a, b) => b.realizados - a.realizados);

  const realizados = count(rows, "concluido");
  const faltas = count(rows, "faltou");
  const totais = {
    agendamentos: rows.filter((r) => r.status !== "cancelado").length,
    realizados,
    faltas,
    cancelados: count(rows, "cancelado"),
    taxaFaltas: faltaTaxa(realizados, faltas),
    pacientesAtendidos: new Set(rows.filter((r) => r.status === "concluido").map((r) => r.patient_id)).size,
    duracaoMedia: avg(rows.map(duration).filter((m): m is number => m !== null)),
    cotaTotal: especialidades.reduce((a, s) => a + s.cota, 0),
  };

  // Faltas recorrentes: 2 ou mais nos últimos 90 dias (até o fim do mês).
  const faltasMap = new Map<string, { name: string; phone: string | null; faltas: number; ultima: string }>();
  for (const f of (faltasRes.data ?? []) as unknown as {
    patient_id: string;
    scheduled_at: string;
    patients: { full_name: string; phone: string | null } | null;
  }[]) {
    const cur = faltasMap.get(f.patient_id) ?? { name: f.patients?.full_name ?? "—", phone: f.patients?.phone ?? null, faltas: 0, ultima: f.scheduled_at };
    cur.faltas += 1;
    if (f.scheduled_at > cur.ultima) cur.ultima = f.scheduled_at;
    faltasMap.set(f.patient_id, cur);
  }
  const faltososRecorrentes = [...faltasMap.entries()]
    .filter(([, v]) => v.faltas >= 2)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.faltas - a.faltas || b.ultima.localeCompare(a.ultima));

  return { month, totais, especialidades, medicos, faltososRecorrentes };
}

/**
 * Faltas por paciente (todas), pra marcar na lista de pacientes. Busca só
 * as consultas com falta e conta aqui (filtrar por uma lista enorme de
 * ids estouraria o tamanho da URL da API).
 */
export async function faltasPorPaciente(patientIds: string[]): Promise<Record<string, number>> {
  if (patientIds.length === 0) return {};
  const wanted = new Set(patientIds);
  const { data, error } = await getSupabaseAdmin().from("appointments").select("patient_id").eq("status", "faltou");
  if (error) return {};
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { patient_id: string }[]) {
    if (wanted.has(r.patient_id)) out[r.patient_id] = (out[r.patient_id] ?? 0) + 1;
  }
  return out;
}
