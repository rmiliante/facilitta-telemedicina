import { getSupabaseAdmin } from "@/lib/supabase";
import { monthRange } from "@/lib/finance";
import { billing, BILLING_RULE_LABEL, CONTRACT_START_MONTH } from "@/lib/contract";

/**
 * Relatório mensal (prestação de contas à prefeitura): uso da cota por
 * especialidade, comparecimento, faltas, cancelamentos, pacientes
 * atendidos, duração média e produção por médico. Também lista quem
 * faltou várias vezes nos últimos 90 dias e calcula o valor a receber da
 * prefeitura (regra do contrato em lib/contract.ts).
 */

interface Row {
  id: string;
  scheduled_at: string;
  patients: { full_name: string } | null;
  status: string;
  patient_id: string;
  specialty_id: string;
  doctor_id: string | null;
  called_at: string | null;
  finished_at: string | null;
  contract_fee?: number | string | null;
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

  const apptCols = "id, scheduled_at, status, patient_id, specialty_id, doctor_id, called_at, finished_at, patients(full_name), specialties(name), doctors(name)";
  const appts = (cols: string) => supabase.from("appointments").select(cols).gte("scheduled_at", start).lt("scheduled_at", end);
  const [apptFirst, specRes, faltasRes, docRes] = await Promise.all([
    appts(`${apptCols}, contract_fee`),
    supabase.from("specialties").select("id, name, monthly_quota").order("name", { ascending: true }),
    supabase
      .from("appointments")
      .select("patient_id, scheduled_at, patients(full_name, phone)")
      .eq("status", "faltou")
      .gte("scheduled_at", since90)
      .lt("scheduled_at", end),
    supabase.from("doctors").select("specialty_id, contract_fee").eq("active", true),
  ]);
  // Sem a migração do valor recebido por consulta: relatório sai sem faturamento.
  let apptRes = apptFirst;
  const valorDisponivel = !(apptRes.error && /contract_fee/.test(apptRes.error.message ?? ""));
  if (!valorDisponivel) apptRes = await appts(apptCols);
  for (const r of [apptRes, specRes, faltasRes]) if (r.error) throw r.error;

  const toFee = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));
  // Valor atual dos médicos ativos de cada especialidade (completa a cota quando não houve consulta com valor).
  const refFees = new Map<string, number[]>();
  for (const d of (docRes.error ? [] : docRes.data ?? []) as { specialty_id: string | null; contract_fee: number | string | null }[]) {
    const fee = toFee(d.contract_fee);
    if (!d.specialty_id || fee === null) continue;
    refFees.set(d.specialty_id, [...(refFees.get(d.specialty_id) ?? []), fee]);
  }

  const rows = (apptRes.data ?? []) as unknown as Row[];
  const specs = (specRes.data ?? []) as { id: string; name: string; monthly_quota: number }[];
  const count = (list: Row[], status: string) => list.filter((r) => r.status === status).length;
  // O agendamento gera a cobrança: presente = concluído; ausente = faltou ou agendado que já passou
  // sem acontecer; a realizar = agendado para hoje em diante.
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const aberta = (r: Row) => r.status === "agendado" || r.status === "em_andamento";
  const isAusente = (r: Row) => r.status === "faltou" || (aberta(r) && r.scheduled_at.slice(0, 10) < hoje);
  const isARealizar = (r: Row) => aberta(r) && r.scheduled_at.slice(0, 10) >= hoje;
  const ausentesDe = (list: Row[]) => list.filter(isAusente).length;

  const especialidades = specs
    .map((s) => {
      const list = rows.filter((r) => r.specialty_id === s.id);
      const naoCancelados = list.filter((r) => r.status !== "cancelado").length;
      const realizados = count(list, "concluido");
      const faltas = ausentesDe(list);
      const aRealizar = list.filter(isARealizar).length;
      const ref = refFees.get(s.id);
      const fat = billing(
        month,
        list.filter((r) => r.status === "concluido").map((r) => toFee(r.contract_fee)),
        s.monthly_quota,
        ref?.length ? ref.reduce((a, b) => a + b, 0) / ref.length : null,
        faltas + aRealizar
      );
      return {
        id: s.id,
        name: s.name,
        cota: s.monthly_quota,
        valorConsulta: fat.valorMedio,
        semValor: fat.semValor,
        faturadas: fat.faturadas,
        valorReceber: fat.valor,
        regra: fat.rule,
        regraLabel: BILLING_RULE_LABEL[fat.rule],
        agendados: naoCancelados,
        usoCota: pct(naoCancelados, s.monthly_quota),
        realizados,
        faltas,
        aRealizar,
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
      const faltas = ausentesDe(list);
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
  const faltas = ausentesDe(rows);
  const totais = {
    agendamentos: rows.filter((r) => r.status !== "cancelado").length,
    realizados,
    faltas,
    aRealizar: rows.filter(isARealizar).length,
    cancelados: count(rows, "cancelado"),
    taxaFaltas: faltaTaxa(realizados, faltas),
    pacientesAtendidos: new Set(rows.filter((r) => r.status === "concluido").map((r) => r.patient_id)).size,
    duracaoMedia: avg(rows.map(duration).filter((m): m is number => m !== null)),
    cotaTotal: especialidades.reduce((a, s) => a + s.cota, 0),
    // Valor final a receber da prefeitura no mês (soma das especialidades com valor cadastrado).
    valorReceber: Math.round(especialidades.reduce((a, s) => a + (s.valorReceber ?? 0), 0) * 100) / 100,
    especialidadesSemValor: especialidades.filter((s) => s.regra === "sem_valor").length,
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

  // Lista por paciente (presentes x ausentes) — só sai para quem pode ver pacientes.
  const detalhe = rows
    .filter((r) => r.status !== "cancelado")
    .map((r) => ({
      date: r.scheduled_at.slice(0, 10),
      patient: r.patients?.full_name ?? "—",
      specialty: r.specialties?.name ?? "—",
      doctor: r.doctors?.name ?? null,
      situacao: r.status === "concluido" ? "presente" : isAusente(r) ? "ausente" : "a_realizar",
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.patient.localeCompare(b.patient));

  return {
    month,
    totais,
    especialidades,
    medicos,
    faltososRecorrentes,
    detalhe,
    faturamento: {
      disponivel: valorDisponivel,
      inicioContrato: CONTRACT_START_MONTH,
      primeiroMes: month === CONTRACT_START_MONTH,
      antesDoContrato: month < CONTRACT_START_MONTH,
    },
  };
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
