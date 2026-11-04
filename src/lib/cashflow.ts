import { getSupabaseAdmin } from "@/lib/supabase";
import { FINANCE_MIGRATION_WARNING, FinanceError, isFinanceMissing, isMonthKey } from "@/lib/finance";
import { monthlyReport } from "@/lib/reports";
import {
  CATEGORY_LABEL,
  HORIZON,
  expenseEvents,
  monthAfter,
  monthlySummary,
  parseSettings,
  projectedEvents,
  todaySP,
  type Expense,
  type SpecPlan,
} from "@/lib/cashflowProjection";

/**
 * Fluxo de caixa do contrato (Bahia): entradas = recebimentos da prefeitura
 * (cash_receipts); saídas = repasse aos médicos (doctor_payouts + consultas
 * concluídas ainda em aberto, previstas para o dia 10 do mês seguinte).
 */

export type CashStatus = "realizado" | "previsto" | "a_definir";

export interface CashEvent {
  key: string;
  date: string | null; // YYYY-MM-DD; null = a definir
  kind: "entrada" | "saida";
  period: string; // YYYY-MM do mês das consultas
  amount: number;
  status: CashStatus;
  receiptId?: string;
  notes?: string | null;
  saldo: number | null; // saldo acumulado (só eventos com data)
  tipo?: "recebimento" | "repasse" | "despesa";
  label?: string; // descrição da despesa
  categoria?: string;
  projetado?: boolean; // gerado pela projeção (não é lançamento)
  expenseId?: string;
  recorrente?: boolean;
}

export interface CashMonth {
  month: string;
  consultas: number;
  receber: number; // contract_fee das concluídas
  pagar: number; // doctor_fee das concluídas
  recebido: number; // já recebido
  previsto: number; // recebimentos previstos (com ou sem data)
  semPrevisao: number; // receber − recebido − previsto
  pago: number; // repasse já pago
  aPagar: number; // repasse fechado + em aberto
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const cents = (v: number) => Math.round(v * 100) / 100;

function nextMonthDay10(month: string) {
  const [y, m] = month.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-10`;
}

export async function cashflowOverview() {
  const supabase = getSupabaseAdmin();
  const [apptRes, payoutRes, receiptRes, specRes, docRes, expRes, setRes] = await Promise.all([
    supabase.from("appointments").select("scheduled_at, doctor_fee, contract_fee, payout_id, specialty_id").eq("status", "concluido").limit(20000),
    supabase.from("doctor_payouts").select("period, total, status, paid_at"),
    supabase.from("cash_receipts").select("id, period, amount, expected_at, received_at, notes").order("created_at", { ascending: true }),
    supabase.from("specialties").select("id, name, monthly_quota"),
    supabase.from("doctors").select("specialty_id, contract_fee").eq("active", true),
    supabase.from("cash_expenses").select("id, description, category, amount, due_date, recurrence, ends_on, paid_at, notes").order("due_date", { ascending: true }),
    supabase.from("cash_settings").select("key, value").eq("key", "projecao"),
  ]);
  for (const r of [apptRes, payoutRes, receiptRes]) {
    if (isFinanceMissing(r.error)) throw new FinanceError(FINANCE_MIGRATION_WARNING.replace("migration_financeiro", "migration_fluxo_caixa"), 503);
    if (r.error) throw r.error;
  }

  // Despesas e premissas são opcionais: sem a migração, o fluxo funciona sem elas.
  const expensesMissing = isFinanceMissing(expRes.error) || isFinanceMissing(setRes.error);
  if (!expensesMissing && (expRes.error || setRes.error)) throw expRes.error ?? setRes.error;
  const today = todaySP();
  const curMonth = today.slice(0, 7);
  const settings = parseSettings(expensesMissing ? null : setRes.data?.[0]?.value, curMonth);
  const expenses: Expense[] = expensesMissing
    ? []
    : (expRes.data ?? []).map((x) => ({ ...x, amount: num(x.amount) }) as Expense);

  const months = new Map<string, CashMonth>();
  const get = (month: string) => {
    let m = months.get(month);
    if (!m) {
      m = { month, consultas: 0, receber: 0, pagar: 0, recebido: 0, previsto: 0, semPrevisao: 0, pago: 0, aPagar: 0 };
      months.set(month, m);
    }
    return m;
  };

  const openByMonth = new Map<string, number>();
  const specAgg = new Map<string, { n: number; cNum: number; cSum: number; dSum: number; actual: Map<string, number> }>();
  for (const a of apptRes.data ?? []) {
    const month = String(a.scheduled_at).slice(0, 7);
    if (!isMonthKey(month)) continue;
    if (a.specialty_id) {
      const g = specAgg.get(a.specialty_id) ?? { n: 0, cNum: 0, cSum: 0, dSum: 0, actual: new Map<string, number>() };
      g.n += 1;
      g.dSum += num(a.doctor_fee);
      if (a.contract_fee !== null && a.contract_fee !== undefined) {
        g.cNum += 1;
        g.cSum += num(a.contract_fee);
      }
      g.actual.set(month, (g.actual.get(month) ?? 0) + 1);
      specAgg.set(a.specialty_id, g);
    }
    const m = get(month);
    m.consultas += 1;
    m.receber += num(a.contract_fee);
    m.pagar += num(a.doctor_fee);
    if (!a.payout_id) openByMonth.set(month, (openByMonth.get(month) ?? 0) + num(a.doctor_fee));
  }

  // A cobrança do contrato segue a regra do relatório (mínimo da cota; proporcional quando a
  // especialidade começou no meio do mês), não só as consultas concluídas.
  const keys = [...months.keys()];
  const reports = await Promise.all(keys.map((k) => monthlyReport(k).catch(() => null)));
  keys.forEach((k, i) => {
    const esp = reports[i]?.especialidades;
    if (esp && esp.length && esp.every((e) => e.valorReceber !== null)) get(k).receber = esp.reduce((a, e) => a + (e.valorReceber ?? 0), 0);
  });

  const events: CashEvent[] = [];

  // Saídas: repasses pagos (agrupados por data) e repasse a pagar por mês.
  const paidGroups = new Map<string, CashEvent>();
  const toPay = new Map<string, number>();
  for (const p of payoutRes.data ?? []) {
    const month = String(p.period).slice(0, 7);
    const m = get(month);
    if (p.status === "pago" && p.paid_at) {
      m.pago += num(p.total);
      const key = `${month}|${p.paid_at}`;
      const ev = paidGroups.get(key) ?? { key: `saida-pago-${key}`, date: p.paid_at, kind: "saida", period: month, amount: 0, status: "realizado", tipo: "repasse", saldo: null };
      ev.amount += num(p.total);
      paidGroups.set(key, ev);
    } else {
      toPay.set(month, (toPay.get(month) ?? 0) + num(p.total));
    }
  }
  for (const [month, open] of openByMonth) toPay.set(month, (toPay.get(month) ?? 0) + open);
  events.push(...paidGroups.values());
  for (const [month, amount] of toPay) {
    if (amount <= 0) continue;
    get(month).aPagar = cents(amount);
    events.push({ key: `saida-previsto-${month}`, date: nextMonthDay10(month), kind: "saida", period: month, amount: cents(amount), status: "previsto", tipo: "repasse", saldo: null });
  }

  // Entradas: recebimentos lançados.
  for (const r of receiptRes.data ?? []) {
    const month = String(r.period).slice(0, 7);
    const m = get(month);
    const amount = num(r.amount);
    if (r.received_at) m.recebido += amount;
    else m.previsto += amount;
    events.push({
      key: `entrada-${r.id}`,
      date: r.received_at ?? r.expected_at ?? null,
      kind: "entrada",
      period: month,
      amount,
      status: r.received_at ? "realizado" : r.expected_at ? "previsto" : "a_definir",
      receiptId: r.id,
      notes: r.notes,
      tipo: "recebimento",
      saldo: null,
    });
  }

  // Despesas operacionais lançadas (únicas e recorrentes).
  events.push(...(expenseEvents(expenses, today) as CashEvent[]));

  // Projeção do contrato: meses ainda sem recebimento lançado, até o horizonte.
  const receiptMonths = new Set((receiptRes.data ?? []).map((r) => String(r.period).slice(0, 7)));
  const lastReceipt = [...receiptMonths].sort().pop();
  const startMonth = lastReceipt ? monthAfter(lastReceipt) : curMonth;
  const paidMonths = new Set(events.filter((e) => e.tipo === "repasse" && e.status === "realizado").map((e) => e.period));
  const feeFromDoctors = new Map<string, { s: number; n: number }>();
  for (const d of docRes.data ?? []) {
    if (!d.specialty_id || d.contract_fee === null || d.contract_fee === undefined) continue;
    const g = feeFromDoctors.get(d.specialty_id) ?? { s: 0, n: 0 };
    g.s += num(d.contract_fee);
    g.n += 1;
    feeFromDoctors.set(d.specialty_id, g);
  }
  const specs: SpecPlan[] = [];
  for (const sp of specRes.data ?? []) {
    const g = specAgg.get(sp.id);
    if (!g || !(sp.monthly_quota > 0)) continue; // só especialidades que já atendem no contrato
    const ref = feeFromDoctors.get(sp.id);
    const contractFee = g.cNum ? g.cSum / g.cNum : ref?.n ? ref.s / ref.n : 0;
    specs.push({ id: sp.id, name: sp.name, quota: sp.monthly_quota, contractFee, doctorFee: g.n ? g.dSum / g.n : 0, actual: g.actual });
  }
  const projected = projectedEvents(specs, settings, startMonth, receiptMonths, paidMonths) as CashEvent[];
  // O repasse projetado substitui o "a pagar" parcial do mês (só consultas já feitas).
  const projectedPay = new Map(projected.filter((e) => e.tipo === "repasse").map((e) => [e.period, e]));
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    const p = e.tipo === "repasse" && e.status === "previsto" ? projectedPay.get(e.period) : undefined;
    if (p) {
      p.amount = Math.max(p.amount, e.amount);
      events.splice(i, 1);
    }
  }
  events.push(...projected);

  events.sort((a, b) => Number(a.date === null) - Number(b.date === null) || (a.date ?? "").localeCompare(b.date ?? "") || a.kind.localeCompare(b.kind));
  let acc = settings.saldoInicial;
  for (const e of events) {
    if (!e.date) continue;
    acc += e.kind === "entrada" ? e.amount : -e.amount;
    e.saldo = cents(acc);
  }

  const list = [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      ...m,
      receber: cents(m.receber),
      pagar: cents(m.pagar),
      recebido: cents(m.recebido),
      previsto: cents(m.previsto),
      pago: cents(m.pago),
      semPrevisao: cents(Math.max(0, m.receber - m.recebido - m.previsto)),
    }));

  // Totais do contrato: só lançamentos e repasses reais (sem projeção nem despesas).
  const sum = (f: (e: CashEvent) => boolean) => cents(events.filter((e) => !e.projetado && e.tipo !== "despesa").filter(f).reduce((a, e) => a + e.amount, 0));
  const totals = {
    receber: cents(list.reduce((a, m) => a + m.receber, 0)),
    pagar: cents(list.reduce((a, m) => a + m.pagar, 0)),
    recebido: sum((e) => e.kind === "entrada" && e.status === "realizado"),
    aReceber: sum((e) => e.kind === "entrada" && e.status !== "realizado"),
    pago: sum((e) => e.kind === "saida" && e.status === "realizado"),
    aPagar: sum((e) => e.kind === "saida" && e.status !== "realizado"),
    semPrevisao: cents(list.reduce((a, m) => a + m.semPrevisao, 0)),
  };

  // Aporte: quanto precisa entrar para o saldo nunca ficar negativo daqui para frente.
  const dated = events.filter((e) => e.date && e.saldo !== null);
  const upToday = dated.filter((e) => (e.date as string) <= today);
  const saldoHoje = upToday.length ? (upToday[upToday.length - 1].saldo as number) : settings.saldoInicial;
  let minSaldo = saldoHoje;
  let minDate = today;
  for (const e of dated) {
    if ((e.date as string) > today && (e.saldo as number) < minSaldo) {
      minSaldo = e.saldo as number;
      minDate = e.date as string;
    }
  }
  const plan = {
    today,
    horizon: HORIZON,
    saldoHoje: cents(saldoHoje),
    saldoMinimo: cents(minSaldo),
    saldoMinimoEm: minDate,
    aporte: cents(Math.max(0, -minSaldo)),
    saldoFinal: dated.length ? (dated[dated.length - 1].saldo as number) : settings.saldoInicial,
    despesasPrevistas: cents(events.filter((e) => e.tipo === "despesa" && e.date && e.date > today).reduce((a, e) => a + e.amount, 0)),
    mensal: monthlySummary(events as never).map((m) => ({ ...m, saldoFinal: m.saldoFinal === null ? null : cents(m.saldoFinal) })),
    premissas: {
      saldoInicial: settings.saldoInicial,
      cheiaA: settings.cheiaA,
      especialidades: specs.map((s) => ({ id: s.id, name: s.name, quota: s.quota, parcial: settings.parcial[s.id] ?? s.quota })),
    },
    despesas: expenses,
    categorias: CATEGORY_LABEL,
    migracaoDespesasPendente: expensesMissing,
  };
  return { months: list, events, totals, plan };
}

export function isDay(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export function parseReceiptInput(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || body.month !== undefined) {
    if (!isMonthKey(body.month)) throw new FinanceError("Informe o mês das consultas", 400);
    out.period = `${body.month}-01`;
  }
  if (!partial || body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new FinanceError("Informe um valor maior que zero", 400);
    out.amount = cents(amount);
  }
  for (const [field, col] of [["expectedAt", "expected_at"], ["receivedAt", "received_at"]] as const) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === "") out[col] = null;
    else if (isDay(body[field])) out[col] = body[field];
    else throw new FinanceError("Data inválida", 400);
  }
  if (body.notes !== undefined) out.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : null;
  return out;
}
