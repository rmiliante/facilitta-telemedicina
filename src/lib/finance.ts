import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Financeiro: repasse aos médicos com fechamento mensal.
 *
 * - "Em aberto": consultas concluídas no mês que ainda não entraram em
 *   nenhum fechamento (appointments.payout_id vazio).
 * - "Fechamento" (doctor_payouts): congela essas consultas com o valor
 *   gravado em cada uma (doctor_fee, o valor da época). Consultas
 *   concluídas depois ficam em aberto e geram um fechamento complementar.
 * - "Pago": a administração registra data, forma e comprovante.
 */

export const FINANCE_BUCKET = "financeiro";
export const PAYMENT_METHODS = ["pix", "ted", "dinheiro", "outro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FINANCE_MIGRATION_WARNING =
  "O módulo financeiro precisa da atualização do banco: rode supabase/migration_financeiro.sql no Supabase.";

/** Tabela/coluna do financeiro ainda não criada (migração pendente). */
export function isFinanceMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    ((error.code === "42703" || error.code === "PGRST204") && /payout_id|doctor_payouts/.test(error.message ?? ""))
  );
}

export class FinanceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

/** Mês atual (YYYY-MM) no fuso de São Paulo. */
export function currentMonthSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(now);
}

/** Início e fim do mês no fuso de São Paulo, em ISO (UTC). */
export function monthRange(month: string): { start: string; end: string; period: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return {
    start: new Date(`${month}-01T00:00:00-03:00`).toISOString(),
    end: new Date(`${next}-01T00:00:00-03:00`).toISOString(),
    period: `${month}-01`,
  };
}

function toMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Soma em centavos pra não acumular erro de arredondamento. */
function sumMoney(values: number[]) {
  return values.reduce((cents, v) => cents + Math.round(v * 100), 0) / 100;
}

interface OpenRow {
  id: string;
  doctor_id: string;
  doctor_fee: number | string | null;
  doctors: { id: string; name: string; consult_fee: number | string | null; active?: boolean } | null;
}

export interface Payout {
  id: string;
  doctor_id: string;
  period: string;
  consultas: number;
  total: number;
  status: "a_pagar" | "pago";
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  closed_by: string | null;
  paid_by: string | null;
  created_at: string;
  doctors?: { name: string } | null;
}

const PAYOUT_COLUMNS =
  "id, doctor_id, period, consultas, total, status, paid_at, payment_method, notes, receipt_path, receipt_name, closed_by, paid_by, created_at, doctors(name)";

function normalizePayout(p: Record<string, unknown>): Payout {
  return { ...(p as unknown as Payout), total: toMoney(p.total) ?? 0 };
}

/**
 * Resumo do mês por médico (admin): o que está em aberto (consultas
 * concluídas ainda sem fechamento) e os fechamentos do mês.
 */
export async function monthOverview(month: string) {
  const supabase = getSupabaseAdmin();
  const { start, end, period } = monthRange(month);

  const [openRes, payoutsRes, doctorsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, doctor_id, doctor_fee, doctors(id, name, consult_fee)")
      .eq("status", "concluido")
      .is("payout_id", null)
      .not("doctor_id", "is", null)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end),
    supabase.from("doctor_payouts").select(PAYOUT_COLUMNS).eq("period", period).order("created_at", { ascending: true }),
    supabase.from("doctors").select("id, name, consult_fee, active").order("name", { ascending: true }),
  ]);
  for (const r of [openRes, payoutsRes, doctorsRes]) {
    if (isFinanceMissing(r.error)) throw new FinanceError(FINANCE_MIGRATION_WARNING, 503);
    if (r.error) throw r.error;
  }

  const open = new Map<string, { consultas: number; valores: number[]; semValor: number }>();
  for (const row of (openRes.data ?? []) as unknown as OpenRow[]) {
    const entry = open.get(row.doctor_id) ?? { consultas: 0, valores: [], semValor: 0 };
    entry.consultas += 1;
    const fee = toMoney(row.doctor_fee) ?? toMoney(row.doctors?.consult_fee);
    if (fee === null) entry.semValor += 1;
    else entry.valores.push(fee);
    open.set(row.doctor_id, entry);
  }

  const payouts = ((payoutsRes.data ?? []) as Record<string, unknown>[]).map(normalizePayout);
  const doctors = (doctorsRes.data ?? []) as { id: string; name: string; consult_fee: number | string | null; active: boolean }[];

  const rows = doctors
    .map((d) => {
      const o = open.get(d.id);
      const ps = payouts.filter((p) => p.doctor_id === d.id);
      return {
        doctorId: d.id,
        name: d.name,
        active: d.active,
        valorConsulta: toMoney(d.consult_fee),
        aberto: { consultas: o?.consultas ?? 0, total: o ? sumMoney(o.valores) : 0, semValor: o?.semValor ?? 0 },
        fechamentos: ps,
      };
    })
    // Mostra quem atendeu ou teve fechamento no mês, e os ativos (pra ver quem ficou zerado).
    .filter((r) => r.active || r.aberto.consultas > 0 || r.fechamentos.length > 0);

  const totals = {
    aberto: sumMoney(rows.map((r) => r.aberto.total)),
    aPagar: sumMoney(payouts.filter((p) => p.status === "a_pagar").map((p) => p.total)),
    pago: sumMoney(payouts.filter((p) => p.status === "pago").map((p) => p.total)),
  };
  return { month, rows, totals };
}

/**
 * Fecha o mês do médico: liga as consultas concluídas ainda sem
 * fechamento a um novo fechamento e soma o valor gravado em cada uma.
 */
export async function closeMonth(doctorId: string, month: string, closedBy: string | null): Promise<Payout> {
  const supabase = getSupabaseAdmin();
  const { start, end, period } = monthRange(month);

  // Não deixa fechar com consulta sem valor (médico sem valor cadastrado).
  const { data: pending, error: pendingErr } = await supabase
    .from("appointments")
    .select("id, doctor_fee, doctors(consult_fee)")
    .eq("doctor_id", doctorId)
    .eq("status", "concluido")
    .is("payout_id", null)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end);
  if (isFinanceMissing(pendingErr)) throw new FinanceError(FINANCE_MIGRATION_WARNING, 503);
  if (pendingErr) throw pendingErr;
  const list = (pending ?? []) as unknown as { doctor_fee: unknown; doctors: { consult_fee: unknown } | null }[];
  if (list.length === 0) throw new FinanceError("Nenhuma consulta em aberto para fechar nesse mês.", 409);
  if (list.some((a) => toMoney(a.doctor_fee) === null && toMoney(a.doctors?.consult_fee) === null)) {
    throw new FinanceError("Há consultas sem valor: cadastre o valor por consulta do médico (Admin → Médicos) antes de fechar.", 409);
  }

  const { data: created, error: createErr } = await supabase
    .from("doctor_payouts")
    .insert({ doctor_id: doctorId, period, closed_by: closedBy })
    .select("id")
    .single();
  if (isFinanceMissing(createErr)) throw new FinanceError(FINANCE_MIGRATION_WARNING, 503);
  if (createErr || !created) throw createErr ?? new Error("Falha ao criar o fechamento");

  // Só pega quem ainda está sem fechamento (se dois cliques chegarem
  // juntos, cada consulta entra em um fechamento só). O gatilho do
  // banco grava o valor da época nas consultas que ainda não tinham.
  const { data: linked, error: linkErr } = await supabase
    .from("appointments")
    .update({ payout_id: created.id })
    .eq("doctor_id", doctorId)
    .eq("status", "concluido")
    .is("payout_id", null)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .select("id, doctor_fee");
  if (linkErr) {
    await supabase.from("doctor_payouts").delete().eq("id", created.id);
    throw linkErr;
  }
  const rows = (linked ?? []) as { doctor_fee: unknown }[];
  if (rows.length === 0) {
    await supabase.from("doctor_payouts").delete().eq("id", created.id);
    throw new FinanceError("Essas consultas acabaram de ser fechadas por outra pessoa. Atualize a tela.", 409);
  }

  const total = sumMoney(rows.map((r) => toMoney(r.doctor_fee) ?? 0));
  const { data: payout, error: updErr } = await supabase
    .from("doctor_payouts")
    .update({ consultas: rows.length, total })
    .eq("id", created.id)
    .select(PAYOUT_COLUMNS)
    .single();
  if (updErr || !payout) throw updErr ?? new Error("Falha ao salvar o fechamento");
  return normalizePayout(payout as Record<string, unknown>);
}

export async function getPayout(id: string): Promise<Payout | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("doctor_payouts").select(PAYOUT_COLUMNS).eq("id", id).maybeSingle();
  if (isFinanceMissing(error)) throw new FinanceError(FINANCE_MIGRATION_WARNING, 503);
  if (error) throw error;
  return data ? normalizePayout(data as Record<string, unknown>) : null;
}

/** Consultas de um fechamento (data, paciente, valor). */
export async function payoutAppointments(payoutId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_at, finished_at, doctor_fee, patients(full_name), specialties(name)")
    .eq("payout_id", payoutId)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as {
    id: string;
    scheduled_at: string;
    finished_at: string | null;
    doctor_fee: unknown;
    patients: { full_name: string } | null;
    specialties: { name: string } | null;
  }[]).map((a) => ({
    id: a.id,
    scheduled_at: a.scheduled_at,
    finished_at: a.finished_at,
    valor: toMoney(a.doctor_fee),
    patient: a.patients?.full_name ?? null,
    specialty: a.specialties?.name ?? null,
  }));
}

/** Desfaz um fechamento ainda não pago: as consultas voltam a ficar em aberto. */
export async function reopenPayout(id: string) {
  const payout = await getPayout(id);
  if (!payout) throw new FinanceError("Fechamento não encontrado", 404);
  if (payout.status === "pago") {
    throw new FinanceError("Esse fechamento já foi pago. Desmarque o pagamento antes de reabrir.", 409);
  }
  const supabase = getSupabaseAdmin();
  const { error: unlinkErr } = await supabase.from("appointments").update({ payout_id: null }).eq("payout_id", id);
  if (unlinkErr) throw unlinkErr;
  const { error } = await supabase.from("doctor_payouts").delete().eq("id", id).eq("status", "a_pagar");
  if (error) throw error;
}

export interface PaymentInput {
  paidAt: string;
  method: PaymentMethod;
  notes: string | null;
}

export async function markPaid(id: string, input: PaymentInput, paidBy: string | null): Promise<Payout> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_payouts")
    .update({ status: "pago", paid_at: input.paidAt, payment_method: input.method, notes: input.notes, paid_by: paidBy })
    .eq("id", id)
    .select(PAYOUT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FinanceError("Fechamento não encontrado", 404);
  return normalizePayout(data as Record<string, unknown>);
}

/** Volta um fechamento pago para "a pagar" (pagamento lançado por engano). */
export async function unmarkPaid(id: string): Promise<Payout> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctor_payouts")
    .update({ status: "a_pagar", paid_at: null, payment_method: null, paid_by: null })
    .eq("id", id)
    .select(PAYOUT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new FinanceError("Fechamento não encontrado", 404);
  return normalizePayout(data as Record<string, unknown>);
}

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const RECEIPT_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp|heic|heif))$/i;

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

/** Anexa (ou troca) o comprovante do pagamento. */
export async function attachReceipt(id: string, file: File): Promise<Payout> {
  if (file.size === 0) throw new FinanceError("Arquivo vazio");
  if (file.size > MAX_RECEIPT_BYTES) throw new FinanceError("O comprovante deve ter no máximo 4 MB");
  if (!RECEIPT_TYPES.test(file.type)) throw new FinanceError("Envie o comprovante em PDF ou imagem (PNG/JPG)");

  const payout = await getPayout(id);
  if (!payout) throw new FinanceError("Fechamento não encontrado", 404);

  const supabase = getSupabaseAdmin();
  const path = `repasses/${id}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error: upErr } = await supabase.storage.from(FINANCE_BUCKET).upload(path, file, { contentType: file.type });
  if (upErr) throw new FinanceError(`Falha ao enviar o comprovante: ${upErr.message}`, 500);

  const { data, error } = await supabase
    .from("doctor_payouts")
    .update({ receipt_path: path, receipt_name: file.name.slice(0, 200) })
    .eq("id", id)
    .select(PAYOUT_COLUMNS)
    .single();
  if (error) throw error;
  if (payout.receipt_path) await supabase.storage.from(FINANCE_BUCKET).remove([payout.receipt_path]);
  return normalizePayout(data as Record<string, unknown>);
}

/** Link temporário (1h) pra abrir o comprovante. */
export async function receiptUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await getSupabaseAdmin().storage.from(FINANCE_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/**
 * Extrato do médico: fechamentos (mais recentes primeiro) e o que está
 * em aberto em cada mês (consultas concluídas ainda sem fechamento).
 */
export async function doctorStatement(doctorId: string) {
  const supabase = getSupabaseAdmin();
  const [payoutsRes, openRes, doctorRes] = await Promise.all([
    supabase.from("doctor_payouts").select(PAYOUT_COLUMNS).eq("doctor_id", doctorId).order("period", { ascending: false }).order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("scheduled_at, doctor_fee")
      .eq("doctor_id", doctorId)
      .eq("status", "concluido")
      .is("payout_id", null),
    supabase.from("doctors").select("consult_fee").eq("id", doctorId).maybeSingle(),
  ]);
  for (const r of [payoutsRes, openRes]) {
    if (isFinanceMissing(r.error)) throw new FinanceError(FINANCE_MIGRATION_WARNING, 503);
    if (r.error) throw r.error;
  }
  const currentFee = toMoney((doctorRes.data as { consult_fee?: unknown } | null)?.consult_fee);

  const openByMonth = new Map<string, number[]>();
  const openCount = new Map<string, number>();
  for (const a of (openRes.data ?? []) as { scheduled_at: string; doctor_fee: unknown }[]) {
    const month = currentMonthSaoPaulo(new Date(a.scheduled_at));
    openCount.set(month, (openCount.get(month) ?? 0) + 1);
    const fee = toMoney(a.doctor_fee) ?? currentFee;
    if (fee !== null) openByMonth.set(month, [...(openByMonth.get(month) ?? []), fee]);
  }
  const emAberto = [...openCount.entries()]
    .map(([month, consultas]) => ({ month, consultas, total: sumMoney(openByMonth.get(month) ?? []) }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const payouts = await Promise.all(
    ((payoutsRes.data ?? []) as Record<string, unknown>[]).map(async (p) => {
      const payout = normalizePayout(p);
      return { ...payout, receipt_url: await receiptUrl(payout.receipt_path) };
    })
  );

  const thisYear = currentMonthSaoPaulo().slice(0, 4);
  return {
    payouts,
    emAberto,
    totals: {
      aReceber: sumMoney(payouts.filter((p) => p.status === "a_pagar").map((p) => p.total)),
      emAberto: sumMoney(emAberto.map((m) => m.total)),
      recebidoNoAno: sumMoney(
        payouts.filter((p) => p.status === "pago" && (p.paid_at ?? "").startsWith(thisYear)).map((p) => p.total)
      ),
    },
  };
}
