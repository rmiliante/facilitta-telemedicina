"use client";

import { useState } from "react";
import { fmtDay, fmtMoney, Kpi, monthLabel } from "./FinanceShared";

/**
 * Fluxo de caixa → projeção até o horizonte (aporte necessário, saldo mês a
 * mês), despesas operacionais (licenças, receituários, etc.) e premissas.
 */

export interface PlanEvent {
  key: string;
  date: string | null;
  saldo: number | null;
  status: "realizado" | "previsto" | "a_definir";
  projetado?: boolean;
  expenseId?: string;
}
export interface PlanExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  due_date: string;
  recurrence: "unica" | "mensal" | "anual";
  ends_on: string | null;
  paid_at: string | null;
}
export interface PlanData {
  today: string;
  horizon: string;
  saldoHoje: number;
  saldoMinimo: number;
  saldoMinimoEm: string;
  aporte: number;
  saldoFinal: number;
  despesasPrevistas: number;
  mensal: { month: string; entradas: number; repasse: number; despesas: number; saldoFinal: number | null; projetado: boolean }[];
  premissas: { saldoInicial: number; cheiaA: string; especialidades: { id: string; name: string; quota: number; parcial: number }[] };
  despesas: PlanExpense[];
  categorias: Record<string, string>;
  migracaoDespesasPendente: boolean;
}

const NAVY = "#15004d";
const AMBER = "#b45309";
const REPEAT_LABEL = { unica: "Uma vez", mensal: "Todo mês", anual: "Todo ano" } as const;

const toNumber = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));
const dayNum = (d: string) => Date.parse(`${d}T12:00:00Z`) / 86_400_000;

function SaldoChart({ events, plan }: { events: PlanEvent[]; plan: PlanData }) {
  const pts = events.filter((e) => e.date && e.saldo !== null) as (PlanEvent & { date: string; saldo: number })[];
  if (pts.length < 2) return <p className="py-8 text-center text-sm text-zinc-400">Sem lançamentos suficientes para o gráfico.</p>;
  const W = 760, H = 220, L = 60, R = 16, T = 14, B = 26;
  const d0 = dayNum(pts[0].date), d1 = dayNum(pts[pts.length - 1].date);
  const vals = pts.map((p) => p.saldo);
  const top = Math.max(0, ...vals), bottom = Math.min(0, ...vals);
  const x = (d: string) => L + ((dayNum(d) - d0) / (d1 - d0 || 1)) * (W - L - R);
  const y = (v: number) => T + ((top - v) / (top - bottom || 1)) * (H - T - B);
  const real = pts.filter((p) => !p.projetado && p.status === "realizado");
  const lastReal = real[real.length - 1];
  const proj = lastReal ? [lastReal, ...pts.filter((p) => !real.includes(p))] : pts;
  const line = (list: typeof pts) => list.map((p) => `${x(p.date).toFixed(1)},${y(p.saldo).toFixed(1)}`).join(" ");
  const minPt = pts.find((p) => p.date === plan.saldoMinimoEm && p.saldo === plan.saldoMinimo);
  const monthTicks = pts.map((p) => p.date.slice(0, 7)).filter((m, i, a) => a.indexOf(m) === i && (i % 2 === 0));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Saldo de caixa projetado">
      {[bottom, 0, top].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#a1a1aa" : "#e4e4e7"} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#71717a">{Math.round(v).toLocaleString("pt-BR")}</text>
        </g>
      ))}
      {plan.today >= pts[0].date && plan.today <= pts[pts.length - 1].date && (
        <g>
          <line x1={x(plan.today)} x2={x(plan.today)} y1={T} y2={H - B} stroke="#00b8a0" strokeDasharray="3 3" />
          <text x={x(plan.today) + 4} y={T + 8} fontSize="10" fill="#009594">hoje</text>
        </g>
      )}
      {real.length > 1 && <polyline fill="none" stroke={NAVY} strokeWidth="2" strokeLinejoin="round" points={line(real)} />}
      <polyline fill="none" stroke={NAVY} strokeWidth="2" strokeDasharray="5 4" opacity="0.7" strokeLinejoin="round" points={line(proj)} />
      {minPt && plan.saldoMinimo < 0 && (
        <g>
          <circle cx={x(minPt.date)} cy={y(minPt.saldo)} r="5" fill={AMBER} />
          <text x={Math.min(x(minPt.date) + 8, W - 190)} y={y(minPt.saldo) + 14} fontSize="11" fill={AMBER}>
            {`menor saldo ${fmtMoney(plan.saldoMinimo)} (${fmtDay(plan.saldoMinimoEm).slice(0, 5)})`}
          </text>
        </g>
      )}
      {monthTicks.map((m) => (
        <text key={m} x={x(`${m}-15`)} y={H - 8} textAnchor="middle" fontSize="10" fill="#71717a">{monthLabel(m)}</text>
      ))}
    </svg>
  );
}

export default function CashFlowPlan({
  plan,
  events,
  readOnly,
  busy,
  call,
  onError,
}: {
  plan: PlanData;
  events: PlanEvent[];
  readOnly: boolean;
  busy: boolean;
  call: (url: string, init: RequestInit) => Promise<boolean>;
  onError: (msg: string) => void;
}) {
  const [exp, setExp] = useState({ description: "", category: "licencas", amount: "", date: "", recurrence: "mensal", endsOn: "" });
  const [setup, setSetup] = useState<{ saldo: string; cheiaA: string; parcial: Record<string, string> } | null>(null);
  const prem = plan.premissas;
  const form = setup ?? {
    saldo: String(prem.saldoInicial).replace(".", ","),
    cheiaA: prem.cheiaA,
    parcial: Object.fromEntries(prem.especialidades.map((s) => [s.id, String(s.parcial)])),
  };

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = toNumber(exp.amount);
    if (!exp.description.trim() || !amount || !exp.date) return onError("Informe descrição, valor e data da despesa");
    if (!confirm(`Lançar despesa de ${fmtMoney(amount)} (${REPEAT_LABEL[exp.recurrence as keyof typeof REPEAT_LABEL].toLowerCase()}) a partir de ${fmtDay(exp.date)}?`)) return;
    const body = { description: exp.description, category: exp.category, amount, date: exp.date, recurrence: exp.recurrence, endsOn: exp.recurrence === "unica" ? null : exp.endsOn || null };
    if (await call("/api/admin/fluxo-caixa/despesas", { method: "POST", body: JSON.stringify(body) })) setExp({ ...exp, description: "", amount: "", date: "", endsOn: "" });
  }

  function markPaid(x: PlanExpense) {
    const day = prompt("Data em que pagou (AAAA-MM-DD):", plan.today);
    if (!day) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return onError("Use a data no formato AAAA-MM-DD");
    void call(`/api/admin/fluxo-caixa/despesas/${x.id}`, { method: "PATCH", body: JSON.stringify({ paidAt: day }) });
  }

  function removeExpense(x: PlanExpense) {
    if (!confirm(`Excluir "${x.description}"${x.recurrence === "unica" ? "" : " e todas as repetições"}?`)) return;
    void call(`/api/admin/fluxo-caixa/despesas/${x.id}`, { method: "DELETE" });
  }

  async function saveSetup(e: React.FormEvent) {
    e.preventDefault();
    const saldo = form.saldo.trim() === "" ? 0 : toNumber(form.saldo);
    if (!Number.isFinite(saldo)) return onError("Caixa de partida inválido");
    const parcial = Object.fromEntries(Object.entries(form.parcial).map(([k, v]) => [k, Number(v)]));
    if (!form.cheiaA) return onError("Informe o mês em que as cotas ficam cheias");
    if (await call("/api/admin/fluxo-caixa/config", { method: "PUT", body: JSON.stringify({ saldoInicial: saldo, cheiaA: form.cheiaA, parcial }) })) setSetup(null);
  }

  const nextDate = (x: PlanExpense) => {
    const ds = events.filter((e) => e.expenseId === x.id && e.date).map((e) => e.date as string).sort();
    return ds.find((d) => d >= plan.today) ?? ds[ds.length - 1] ?? x.due_date;
  };

  return (
    <div className="space-y-5">
      {plan.migracaoDespesasPendente && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Para lançar despesas, rode a migração <code>supabase/migration_fluxo_despesas.sql</code> no Supabase.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={plan.aporte > 0 ? "rounded-xl ring-2 ring-amber-300" : ""}>
          <Kpi label="Aporte necessário" bar="#f5b301" value={fmtMoney(plan.aporte)}>
            {plan.aporte > 0 ? `menor saldo em ${fmtDay(plan.saldoMinimoEm)}` : "o caixa não fica negativo"}
          </Kpi>
        </div>
        <Kpi label="Saldo hoje" bar="#009594" value={fmtMoney(plan.saldoHoje)}>{fmtDay(plan.today)}</Kpi>
        <Kpi label="Despesas previstas" bar="#8a7fd0" value={fmtMoney(plan.despesasPrevistas)}>até {fmtDay(plan.horizon)}</Kpi>
        <Kpi label={`Saldo em ${fmtDay(plan.horizon)}`} bar="#15004d" value={fmtMoney(plan.saldoFinal)}>projeção</Kpi>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold text-brand-navy">Saldo projetado</h2>
        <p className="mb-2 text-xs text-zinc-500">Linha cheia = realizado; tracejada = previsto e projetado. Inclui repasses, recebimentos e despesas.</p>
        <SaldoChart events={events} plan={plan} />
      </section>

      {!readOnly && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={addExpense} className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold text-brand-navy">Lançar despesa</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-zinc-500 sm:col-span-2">Descrição
                <input value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} placeholder="Licença do sistema de prescrição" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
              </label>
              <label className="text-xs text-zinc-500">Categoria
                <select value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900">
                  {Object.entries(plan.categorias).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="text-xs text-zinc-500">Valor (R$)
                <input inputMode="decimal" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} placeholder="600,00" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
              </label>
              <label className="text-xs text-zinc-500">Data (1º vencimento)
                <input type="date" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
              </label>
              <label className="text-xs text-zinc-500">Repete
                <select value={exp.recurrence} onChange={(e) => setExp({ ...exp, recurrence: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900">
                  <option value="unica">Uma vez</option>
                  <option value="mensal">Todo mês</option>
                  <option value="anual">Todo ano</option>
                </select>
              </label>
              {exp.recurrence !== "unica" && (
                <label className="text-xs text-zinc-500">Até (opcional)
                  <input type="date" value={exp.endsOn} onChange={(e) => setExp({ ...exp, endsOn: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
                </label>
              )}
            </div>
            <button disabled={busy} className="mt-3 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Lançar despesa</button>
          </form>

          <form onSubmit={saveSetup} className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-1 text-sm font-bold text-brand-navy">Premissas da projeção</h2>
            <p className="mb-3 text-xs text-zinc-500">Cobrança = mínimo da cota por especialidade. O repasse segue as consultas realizadas.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-zinc-500">Caixa de partida (R$)
                <input inputMode="decimal" value={form.saldo} onChange={(e) => setSetup({ ...form, saldo: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
              </label>
              <label className="text-xs text-zinc-500">Cotas cheias a partir de
                <input type="month" value={form.cheiaA} onChange={(e) => setSetup({ ...form, cheiaA: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
              </label>
              {prem.especialidades.map((s) => (
                <label key={s.id} className="text-xs text-zinc-500">{s.name} · consultas/mês antes disso
                  <input type="number" min={0} value={form.parcial[s.id] ?? ""} onChange={(e) => setSetup({ ...form, parcial: { ...form.parcial, [s.id]: e.target.value } })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
                </label>
              ))}
            </div>
            <button disabled={busy} className="mt-3 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar premissas</button>
          </form>
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-bold text-brand-navy">Despesas operacionais</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="py-2 pr-3">Descrição</th><th className="pr-3">Categoria</th><th className="pr-3">Repete</th>
                <th className="pr-3 text-right">Valor</th><th className="pr-3">Próxima</th>{!readOnly && <th />}
              </tr>
            </thead>
            <tbody>
              {plan.despesas.map((x) => (
                <tr key={x.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">{x.description}</td>
                  <td className="pr-3">{plan.categorias[x.category] ?? x.category}</td>
                  <td className="whitespace-nowrap pr-3">{REPEAT_LABEL[x.recurrence]}{x.ends_on ? ` até ${fmtDay(x.ends_on)}` : ""}</td>
                  <td className="whitespace-nowrap pr-3 text-right">{fmtMoney(x.amount)}</td>
                  <td className="whitespace-nowrap pr-3">{x.recurrence === "unica" && x.paid_at ? `Pago em ${fmtDay(x.paid_at)}` : fmtDay(nextDate(x))}</td>
                  {!readOnly && (
                    <td className="whitespace-nowrap text-right">
                      {x.recurrence === "unica" && !x.paid_at && (
                        <button disabled={busy} onClick={() => markPaid(x)} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-brand-teal-dark hover:bg-brand-teal/10">Paguei</button>
                      )}
                      <button disabled={busy} onClick={() => removeExpense(x)} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50">Excluir</button>
                    </td>
                  )}
                </tr>
              ))}
              {plan.despesas.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-zinc-400">Nenhuma despesa lançada.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Despesas que se repetem contam como pagas na data do vencimento; as de uma vez só ficam previstas até você marcar como paga.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-bold text-brand-navy">Projeção mês a mês</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="py-2 pr-3">Mês</th><th className="pr-3 text-right">Recebimentos</th><th className="pr-3 text-right">Repasse médicas</th>
                <th className="pr-3 text-right">Despesas</th><th className="pr-3 text-right">Saldo final</th><th />
              </tr>
            </thead>
            <tbody>
              {plan.mensal.map((m) => {
                const tag = m.month < plan.today.slice(0, 7) ? ["realizado", "bg-zinc-100 text-zinc-600"] : m.month === plan.today.slice(0, 7) ? ["em andamento", "bg-brand-teal/15 text-brand-teal-dark"] : ["projetado", "bg-amber-50 text-amber-700"];
                return (
                  <tr key={m.month} className="border-b border-zinc-100">
                    <td className="whitespace-nowrap py-2 pr-3">{monthLabel(m.month)}</td>
                    <td className="whitespace-nowrap pr-3 text-right">{fmtMoney(m.entradas)}</td>
                    <td className="whitespace-nowrap pr-3 text-right text-red-700">{m.repasse ? `−${fmtMoney(m.repasse)}` : "—"}</td>
                    <td className="whitespace-nowrap pr-3 text-right text-red-700">{m.despesas ? `−${fmtMoney(m.despesas)}` : "—"}</td>
                    <td className={`whitespace-nowrap pr-3 text-right font-semibold ${m.saldoFinal !== null && m.saldoFinal < 0 ? "text-red-600" : ""}`}>{m.saldoFinal === null ? "—" : fmtMoney(m.saldoFinal)}</td>
                    <td><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tag[1]}`}>{tag[0]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
