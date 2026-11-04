import { getSupabaseAdmin } from "@/lib/supabase";
import { FINANCE_MIGRATION_WARNING, FinanceError, isFinanceMissing, isMonthKey } from "@/lib/finance";
import { monthlyReport } from "@/lib/reports";

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
  const [apptRes, payoutRes, receiptRes] = await Promise.all([
    supabase.from("appointments").select("scheduled_at, doctor_fee, contract_fee, payout_id").eq("status", "concluido").limit(20000),
    supabase.from("doctor_payouts").select("period, total, status, paid_at"),
    supabase.from("cash_receipts").select("id, period, amount, expected_at, received_at, notes").order("created_at", { ascending: true }),
  ]);
  for (const r of [apptRes, payoutRes, receiptRes]) {
    if (isFinanceMissing(r.error)) throw new FinanceError(FINANCE_MIGRATION_WARNING.replace("migration_financeiro", "migration_fluxo_caixa"), 503);
    if (r.error) throw r.error;
  }

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
  for (const a of apptRes.data ?? []) {
    const month = String(a.scheduled_at).slice(0, 7);
    if (!isMonthKey(month)) continue;
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
      const ev = paidGroups.get(key) ?? { key: `saida-pago-${key}`, date: p.paid_at, kind: "saida", period: month, amount: 0, status: "realizado", saldo: null };
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
    events.push({ key: `saida-previsto-${month}`, date: nextMonthDay10(month), kind: "saida", period: month, amount: cents(amount), status: "previsto", saldo: null });
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
      saldo: null,
    });
  }

  events.sort((a, b) => Number(a.date === null) - Number(b.date === null) || (a.date ?? "").localeCompare(b.date ?? "") || a.kind.localeCompare(b.kind));
  let acc = 0;
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

  const sum = (f: (e: CashEvent) => boolean) => cents(events.filter(f).reduce((a, e) => a + e.amount, 0));
  const totals = {
    receber: cents(list.reduce((a, m) => a + m.receber, 0)),
    pagar: cents(list.reduce((a, m) => a + m.pagar, 0)),
    recebido: sum((e) => e.kind === "entrada" && e.status === "realizado"),
    aReceber: sum((e) => e.kind === "entrada" && e.status !== "realizado"),
    pago: sum((e) => e.kind === "saida" && e.status === "realizado"),
    aPagar: sum((e) => e.kind === "saida" && e.status !== "realizado"),
    semPrevisao: cents(list.reduce((a, m) => a + m.semPrevisao, 0)),
  };
  return { months: list, events, totals };
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
