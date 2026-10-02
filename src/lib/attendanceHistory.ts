import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Histórico de atendimentos (admin e médico): filtros e totais do período.
 * Duração = do médico chamar (called_at) até concluir (finished_at); só
 * concluídos com as duas marcações entram em minutos e média.
 * Valor = consultas concluídas × valor por consulta do médico (cadastro).
 */

interface Row {
  id: string;
  scheduled_at: string;
  status: string;
  called_at: string | null;
  finished_at: string | null;
  tipo_consulta?: string | null;
  patients: { id: string; full_name: string; cpf: string | null } | null;
  doctors: { id: string; name: string; consult_fee?: number | string | null } | null;
  specialties: { id: string; name: string } | null;
}

const COLUMNS =
  "id, scheduled_at, status, called_at, finished_at, tipo_consulta, patients(id, full_name, cpf), doctors(id, name, consult_fee), specialties(id, name)";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 5000;

function spStart(date: string) {
  return new Date(`${date}T00:00:00-03:00`);
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

function durationMinutes(r: Pick<Row, "status" | "called_at" | "finished_at">): number | null {
  if (r.status !== "concluido" || !r.called_at || !r.finished_at) return null;
  const min = Math.round((new Date(r.finished_at).getTime() - new Date(r.called_at).getTime()) / 60000);
  // Descarta marcações inconsistentes (fim antes do início ou mais de 12h).
  return min >= 0 && min <= 720 ? min : null;
}

/** Valor por consulta do médico da linha (null = não cadastrado). */
function doctorFee(r: Row): number | null {
  const raw = r.doctors?.consult_fee;
  if (raw === null || raw === undefined || raw === "") return null;
  const fee = Number(raw);
  return Number.isFinite(fee) ? fee : null;
}

/** Soma em centavos pra não acumular erro de arredondamento. */
function sumMoney(values: number[]) {
  return values.reduce((cents, v) => cents + Math.round(v * 100), 0) / 100;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Valor dos atendimentos concluídos: total do período, quantos ficaram
 * sem valor (médico sem valor cadastrado) e o total de cada médico.
 */
function feeSummary(done: Row[]) {
  const byDoctor = new Map<string, { doctorId: string; name: string; realizados: number; valorConsulta: number | null; valores: number[] }>();
  for (const r of done) {
    const id = r.doctors?.id ?? "";
    let entry = byDoctor.get(id);
    if (!entry) {
      entry = { doctorId: id, name: r.doctors?.name ?? "Sem médico", realizados: 0, valorConsulta: doctorFee(r), valores: [] };
      byDoctor.set(id, entry);
    }
    entry.realizados += 1;
    const fee = doctorFee(r);
    if (fee !== null) entry.valores.push(fee);
  }
  const porMedico = [...byDoctor.values()]
    .map(({ valores, ...m }) => ({ ...m, total: valores.length ? sumMoney(valores) : null }))
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.name.localeCompare(b.name, "pt-BR"));
  const fees = done.map(doctorFee).filter((v): v is number => v !== null);
  return {
    valorTotal: sumMoney(fees),
    realizadosSemValor: done.length - fees.length,
    porMedico,
  };
}

/**
 * Monta o histórico com filtros e totais. `forcedDoctorId` (painel do
 * médico) ignora qualquer doctorId vindo da URL: o médico só enxerga as
 * consultas dele.
 */
export async function buildAttendanceHistory(sp: URLSearchParams, forcedDoctorId?: string) {
  if (forcedDoctorId !== undefined && !forcedDoctorId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "Informe o período (de/até)." }, { status: 400 });
  }
  const start = spStart(from);
  const end = addDays(spStart(to), 1);
  if (end <= start) return NextResponse.json({ error: "A data final é anterior à inicial." }, { status: 400 });

  const doctorId = forcedDoctorId ?? (sp.get("doctorId") || "");
  const specialtyId = sp.get("specialtyId") || "";
  const tipo = sp.get("tipo") || "";
  const status = sp.get("status") || "";
  const q = (sp.get("q") || "").trim();

  const supabase = getSupabaseAdmin();
  let hasTipo = true;
  let hasFee = true;
  const columns = () => {
    let cols = COLUMNS;
    if (!hasTipo) cols = cols.replace(", tipo_consulta", "");
    if (!hasFee) cols = cols.replace(", consult_fee", "");
    return cols;
  };

  const fetchRange = async (a: Date, b: Date) => {
    const run = (cols: string) => {
      let query = supabase
        .from("appointments")
        .select(cols)
        .gte("scheduled_at", a.toISOString())
        .lt("scheduled_at", b.toISOString())
        .order("scheduled_at", { ascending: false })
        .limit(MAX_ROWS);
      if (doctorId) query = query.eq("doctor_id", doctorId);
      if (specialtyId) query = query.eq("specialty_id", specialtyId);
      return query;
    };
    let { data, error } = await run(columns());
    // Colunas de migrações ainda não rodadas: tira a que faltar e tenta de novo.
    while (error?.code === "42703" && (hasFee || hasTipo)) {
      if (hasFee && (error.message ?? "").includes("consult_fee")) hasFee = false;
      else if (hasTipo) hasTipo = false;
      else hasFee = false;
      ({ data, error } = await run(columns()));
    }
    if (error) throw error;
    return (data ?? []) as unknown as Row[];
  };

  const qDigits = q.replace(/\D/g, "");
  const qText = normalize(q);
  const matches = (r: Row) => {
    if (tipo === "sem" ? r.tipo_consulta : tipo && r.tipo_consulta !== tipo) return false;
    if (status && r.status !== status) return false;
    if (q) {
      const name = normalize(r.patients?.full_name ?? "");
      const cpf = (r.patients?.cpf ?? "").replace(/\D/g, "");
      const byName = qText.length > 0 && name.includes(qText);
      const byCpf = qDigits.length >= 3 && cpf.includes(qDigits);
      if (!byName && !byCpf) return false;
    }
    return true;
  };

  try {
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    const [current, previous] = await Promise.all([
      fetchRange(start, end),
      fetchRange(addDays(start, -days), start),
    ]);

    const rows = current.filter(matches);
    const prevDone = previous.filter(matches).filter((r) => r.status === "concluido").length;

    const done = rows.filter((r) => r.status === "concluido");
    const durations = done.map(durationMinutes).filter((m): m is number => m !== null);
    const totalMinutes = durations.reduce((s, m) => s + m, 0);

    const summary = {
      realizados: done.length,
      realizadosAnterior: prevDone,
      faltas: rows.filter((r) => r.status === "faltou").length,
      cancelados: rows.filter((r) => r.status === "cancelado").length,
      totalMinutes,
      comDuracao: durations.length,
      mediaMinutes: durations.length ? Math.round(totalMinutes / durations.length) : null,
      menorMinutes: durations.length ? Math.min(...durations) : null,
      maiorMinutes: durations.length ? Math.max(...durations) : null,
      rotina: done.filter((r) => r.tipo_consulta === "rotina").length,
      retorno: done.filter((r) => r.tipo_consulta === "retorno").length,
      semTipo: done.filter((r) => !r.tipo_consulta).length,
      periodoDias: days,
      ...feeSummary(done),
    };

    const items = rows.map((r) => ({
      id: r.id,
      scheduled_at: r.scheduled_at,
      status: r.status,
      called_at: r.called_at,
      finished_at: r.finished_at,
      duration: durationMinutes(r),
      tipo_consulta: r.tipo_consulta ?? null,
      patient: r.patients ? { id: r.patients.id, full_name: r.patients.full_name, cpf: r.patients.cpf } : null,
      doctor: r.doctors?.name ?? null,
      specialty: r.specialties?.name ?? null,
      valor: r.status === "concluido" ? doctorFee(r) : null,
    }));

    return NextResponse.json({
      items,
      summary,
      truncated: current.length >= MAX_ROWS,
      tipoDisponivel: hasTipo,
      valorDisponivel: hasFee,
    });
  } catch (error) {
    console.error("Erro ao buscar histórico de atendimentos:", error);
    return NextResponse.json({ error: "Falha ao buscar o histórico de atendimentos" }, { status: 500 });
  }
}
