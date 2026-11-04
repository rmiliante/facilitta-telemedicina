import { FinanceError, isMonthKey } from "@/lib/finance";

/**
 * Fluxo de caixa: despesas operacionais (licenças, receituários, etc.) e
 * projeção do contrato até o horizonte. Funções puras, sem acesso ao banco.
 */

/** Último dia projetado (30/06/2027). */
export const HORIZON = "2027-06-30";
/** Dia do repasse às médicas e do recebimento da prefeitura, no mês seguinte às consultas. */
const PAYOUT_DAY = 10;
const RECEIPT_DAY = 30;

export const CATEGORY_LABEL: Record<string, string> = {
  licencas: "Licenças",
  receituario: "Receituário",
  software: "Software e infraestrutura",
  pessoal: "Pessoal",
  impostos: "Impostos e taxas",
  marketing: "Marketing",
  outras: "Outras",
};

export type Recurrence = "unica" | "mensal" | "anual";

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  due_date: string;
  recurrence: Recurrence;
  ends_on: string | null;
  paid_at: string | null;
  notes: string | null;
}

/** Evento de caixa gerado aqui (compatível com CashEvent de cashflow.ts). */
export interface PlanEvent {
  key: string;
  date: string | null;
  kind: "entrada" | "saida";
  period: string;
  amount: number;
  status: "realizado" | "previsto" | "a_definir";
  tipo: "recebimento" | "repasse" | "despesa";
  label?: string;
  categoria?: string;
  projetado?: boolean;
  expenseId?: string;
  recorrente?: boolean;
  notes?: string | null;
  saldo: number | null;
}

export interface PlanSettings {
  saldoInicial: number;
  /** Mês (AAAA-MM) a partir do qual as cotas são realizadas por inteiro. */
  cheiaA: string;
  /** Consultas realizadas por mês, por especialidade, antes de cheiaA. */
  parcial: Record<string, number>;
}

export interface SpecPlan {
  id: string;
  name: string;
  quota: number;
  contractFee: number;
  doctorFee: number;
  /** Consultas concluídas por mês (AAAA-MM). */
  actual: Map<string, number>;
}

const pad = (n: number) => String(n).padStart(2, "0");
const cents = (v: number) => Math.round(v * 100) / 100;

export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export function todaySP() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/** Soma n meses a uma data AAAA-MM-DD mantendo o dia (ajustado ao fim do mês). */
export function addMonths(day: string, n: number, anchorDay = Number(day.slice(8, 10))) {
  const [y, m] = day.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(anchorDay, dim))}`;
}

export function monthAfter(month: string, n = 1) {
  return addMonths(`${month}-01`, n, 1).slice(0, 7);
}

/** Datas de uma despesa até o horizonte (ou o fim da recorrência). */
export function expenseEvents(list: Expense[], today: string): PlanEvent[] {
  const out: PlanEvent[] = [];
  for (const x of list) {
    const base = { kind: "saida" as const, tipo: "despesa" as const, label: x.description, categoria: x.category, expenseId: x.id, notes: x.notes, saldo: null };
    if (x.recurrence === "unica") {
      const date = x.paid_at ?? x.due_date;
      out.push({ ...base, key: `saida-despesa-${x.id}`, date, period: date.slice(0, 7), amount: x.amount, status: x.paid_at ? "realizado" : "previsto" });
      continue;
    }
    const step = x.recurrence === "mensal" ? 1 : 12;
    const anchor = Number(x.due_date.slice(8, 10));
    const end = x.ends_on && x.ends_on < HORIZON ? x.ends_on : HORIZON;
    for (let i = 0; i < 240; i++) {
      const date = addMonths(x.due_date, i * step, anchor);
      if (date > end) break;
      out.push({ ...base, key: `saida-despesa-${x.id}-${date}`, date, period: date.slice(0, 7), amount: x.amount, status: date <= today ? "realizado" : "previsto", recorrente: true });
    }
  }
  return out;
}

export function defaultSettings(curMonth: string): PlanSettings {
  return { saldoInicial: 0, cheiaA: monthAfter(curMonth), parcial: {} };
}

export function parseSettings(raw: unknown, curMonth: string): PlanSettings {
  const d = defaultSettings(curMonth);
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const parcial: Record<string, number> = {};
  if (r.parcial && typeof r.parcial === "object") {
    for (const [k, v] of Object.entries(r.parcial as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) parcial[k] = Math.floor(n);
    }
  }
  return {
    saldoInicial: Number.isFinite(Number(r.saldoInicial)) ? Number(r.saldoInicial) : 0,
    cheiaA: isMonthKey(r.cheiaA) ? r.cheiaA : d.cheiaA,
    parcial,
  };
}

export function parseSettingsInput(body: Record<string, unknown>): PlanSettings {
  const saldo = Number(body.saldoInicial ?? 0);
  if (!Number.isFinite(saldo) || Math.abs(saldo) > 100_000_000) throw new FinanceError("Caixa de partida inválido", 400);
  if (!isMonthKey(body.cheiaA)) throw new FinanceError("Informe o mês em que as cotas ficam cheias", 400);
  const parcial: Record<string, number> = {};
  if (body.parcial && typeof body.parcial === "object") {
    for (const [k, v] of Object.entries(body.parcial as Record<string, unknown>)) {
      const n = Number(v);
      if (!/^[0-9a-f-]{36}$/i.test(k) || !Number.isFinite(n) || n < 0 || n > 10_000) throw new FinanceError("Consultas por mês inválidas", 400);
      parcial[k] = Math.floor(n);
    }
  }
  return { saldoInicial: cents(saldo), cheiaA: body.cheiaA, parcial };
}

export function parseExpenseInput(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || body.description !== undefined) {
    const d = typeof body.description === "string" ? body.description.trim() : "";
    if (!d) throw new FinanceError("Informe a descrição da despesa", 400);
    out.description = d.slice(0, 120);
  }
  if (!partial || body.category !== undefined) {
    const c = typeof body.category === "string" ? body.category : "outras";
    out.category = c in CATEGORY_LABEL ? c : "outras";
  }
  if (!partial || body.amount !== undefined) {
    const a = Number(body.amount);
    if (!Number.isFinite(a) || a <= 0 || a > 10_000_000) throw new FinanceError("Informe um valor maior que zero", 400);
    out.amount = cents(a);
  }
  if (!partial || body.date !== undefined) {
    if (!isDayKey(body.date)) throw new FinanceError("Informe a data da despesa", 400);
    out.due_date = body.date;
  }
  if (!partial || body.recurrence !== undefined) {
    const r = body.recurrence ?? "unica";
    if (r !== "unica" && r !== "mensal" && r !== "anual") throw new FinanceError("Repetição inválida", 400);
    out.recurrence = r;
  }
  for (const [field, col] of [["endsOn", "ends_on"], ["paidAt", "paid_at"]] as const) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === "") out[col] = null;
    else if (isDayKey(body[field])) out[col] = body[field];
    else throw new FinanceError("Data inválida", 400);
  }
  if (body.notes !== undefined) out.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : null;
  return out;
}

/**
 * Projeção do contrato a partir de startMonth: para cada mês de consulta, o
 * repasse (dia 10 do mês seguinte) e o recebimento (dia 30 do mês seguinte).
 * Cobrança = o maior entre realizadas e a cota (mínimo contratado).
 * realReceiptMonths: meses que já têm recebimento lançado (não projeta de novo).
 * paidMonths: meses cujo repasse já foi pago.
 */
export function projectedEvents(specs: SpecPlan[], settings: PlanSettings, startMonth: string, realReceiptMonths: Set<string>, paidMonths: Set<string>): PlanEvent[] {
  const out: PlanEvent[] = [];
  for (let month = startMonth, guard = 0; guard < 60; month = monthAfter(month), guard++) {
    const payDate = addMonths(`${month}-01`, 1, PAYOUT_DAY);
    const recDate = addMonths(`${month}-01`, 1, RECEIPT_DAY);
    if (payDate > HORIZON && recDate > HORIZON) break;
    let repasse = 0;
    let faturado = 0;
    for (const s of specs) {
      const base = month >= settings.cheiaA ? s.quota : settings.parcial[s.id] ?? s.quota;
      const realizadas = Math.max(base, s.actual.get(month) ?? 0);
      repasse += realizadas * s.doctorFee;
      faturado += Math.max(realizadas, s.quota) * s.contractFee;
    }
    const common = { period: month, status: "previsto" as const, projetado: true, saldo: null };
    if (payDate <= HORIZON && repasse > 0 && !paidMonths.has(month)) {
      out.push({ ...common, key: `proj-repasse-${month}`, date: payDate, kind: "saida", tipo: "repasse", amount: cents(repasse) });
    }
    if (recDate <= HORIZON && faturado > 0 && !realReceiptMonths.has(month)) {
      out.push({ ...common, key: `proj-receb-${month}`, date: recDate, kind: "entrada", tipo: "recebimento", amount: cents(faturado) });
    }
  }
  return out;
}

export interface PlanMonth {
  month: string;
  entradas: number;
  repasse: number;
  despesas: number;
  saldoFinal: number | null;
  projetado: boolean;
}

/** Resumo mês a mês dos eventos já ordenados e com saldo. */
export function monthlySummary(events: PlanEvent[]): PlanMonth[] {
  const map = new Map<string, PlanMonth>();
  for (const e of events) {
    if (!e.date) continue;
    const month = e.date.slice(0, 7);
    let m = map.get(month);
    if (!m) {
      m = { month, entradas: 0, repasse: 0, despesas: 0, saldoFinal: null, projetado: false };
      map.set(month, m);
    }
    if (e.kind === "entrada") m.entradas += e.amount;
    else if (e.tipo === "despesa") m.despesas += e.amount;
    else m.repasse += e.amount;
    m.saldoFinal = e.saldo;
    if (e.projetado || e.status !== "realizado") m.projetado = true;
  }
  return [...map.values()].map((m) => ({ ...m, entradas: cents(m.entradas), repasse: cents(m.repasse), despesas: cents(m.despesas) }));
}
