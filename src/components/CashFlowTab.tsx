"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDay, fmtMoney, Kpi, monthLabel, todayKey } from "./FinanceShared";

/**
 * Admin → Fluxo de caixa (contrato Bahia): entradas (recebimentos da
 * prefeitura), saídas (repasse às médicas) e saldo acumulado por data.
 * Quem edita (Master e Financeiro) lança recebimentos e marca como recebido.
 */

type Status = "realizado" | "previsto" | "a_definir";
interface Ev {
  key: string;
  date: string | null;
  kind: "entrada" | "saida";
  period: string;
  amount: number;
  status: Status;
  receiptId?: string;
  notes?: string | null;
  saldo: number | null;
}
interface Month {
  month: string;
  consultas: number;
  receber: number;
  pagar: number;
  recebido: number;
  previsto: number;
  semPrevisao: number;
  pago: number;
  aPagar: number;
}
interface Data {
  months: Month[];
  events: Ev[];
  totals: { receber: number; pagar: number; recebido: number; aReceber: number; pago: number; aPagar: number; semPrevisao: number };
}

const NAVY = "#15004d";
const TEAL = "#00b8a0";

function situacao(e: Ev, today: string) {
  if (e.status === "a_definir") return { text: "A definir", cls: "bg-zinc-100 text-zinc-600" };
  if (e.status === "realizado") return { text: e.kind === "entrada" ? "Recebido" : "Pago", cls: "bg-brand-teal/15 text-brand-teal-dark" };
  if (e.date && e.date < today) return { text: "Atrasado", cls: "bg-red-50 text-red-700" };
  return { text: e.kind === "entrada" ? "A receber" : "A pagar", cls: "bg-amber-50 text-amber-700" };
}

function Chart({ events }: { events: Ev[] }) {
  const dated = events.filter((e) => e.date);
  if (dated.length === 0) return null;
  const W = 640, H = 230, L = 56, R = 16, T = 12, B = 34;
  const maxBar = Math.max(...dated.map((e) => e.amount));
  const saldos = dated.map((e) => e.saldo ?? 0);
  const top = Math.max(maxBar, ...saldos, 1);
  const bottom = Math.min(0, ...saldos);
  const y = (v: number) => T + ((top - v) / (top - bottom || 1)) * (H - T - B);
  const slot = (W - L - R) / dated.length;
  const bw = Math.min(34, slot * 0.5);
  const cx = (i: number) => L + slot * i + slot / 2;
  const ticks = [bottom, 0, top].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Entradas, saídas e saldo acumulado por data">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e4e4e7" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#71717a">
            {Math.round(v).toLocaleString("pt-BR")}
          </text>
        </g>
      ))}
      {dated.map((e, i) => (
        <g key={e.key}>
          <rect
            x={cx(i) - bw / 2}
            y={Math.min(y(0), y(e.amount))}
            width={bw}
            height={Math.abs(y(0) - y(e.amount))}
            rx="3"
            fill={e.kind === "entrada" ? TEAL : NAVY}
            opacity={e.status === "realizado" ? 1 : 0.45}
          >
            <title>{`${fmtDay(e.date)} · ${e.kind === "entrada" ? "Entrada" : "Saída"} ${fmtMoney(e.amount)}`}</title>
          </rect>
          <text x={cx(i)} y={H - 16} textAnchor="middle" fontSize="10" fill="#71717a">
            {fmtDay(e.date).slice(0, 5)}
          </text>
        </g>
      ))}
      <polyline fill="none" stroke="#f5b301" strokeWidth="2" strokeLinejoin="round" points={dated.map((e, i) => `${cx(i)},${y(e.saldo ?? 0)}`).join(" ")} />
      {dated.map((e, i) => (
        <circle key={e.key} cx={cx(i)} cy={y(e.saldo ?? 0)} r="3.5" fill="#f5b301">
          <title>{`Saldo em ${fmtDay(e.date)}: ${fmtMoney(e.saldo ?? 0)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function CashFlowTab({ readOnly = false }: { readOnly?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ month: "", amount: "", date: "", received: false, notes: "" });
  const today = todayKey();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/fluxo-caixa");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Falha ao carregar o fluxo de caixa");
        return;
      }
      setError(null);
      setData(json);
    } catch {
      setError("Falha ao carregar o fluxo de caixa");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Não foi possível salvar");
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function addReceipt(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount.replace(/\./g, "").replace(",", "."));
    if (!form.month || !amount) return setError("Informe o mês e o valor");
    if (!confirm(`Lançar ${fmtMoney(amount)} de ${monthLabel(form.month)} como ${form.received ? "recebido" : "previsto"}?`)) return;
    const body = { month: form.month, amount, notes: form.notes, ...(form.received ? { receivedAt: form.date || today } : { expectedAt: form.date || null }) };
    if (await call("/api/admin/fluxo-caixa/recebimentos", { method: "POST", body: JSON.stringify(body) })) setForm({ month: "", amount: "", date: "", received: false, notes: "" });
  }

  function markReceived(ev: Ev) {
    const day = prompt("Data em que recebeu (AAAA-MM-DD):", today);
    if (!day) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return setError("Use a data no formato AAAA-MM-DD");
    if (!confirm(`Marcar ${fmtMoney(ev.amount)} como recebido em ${fmtDay(day)}?`)) return;
    void call(`/api/admin/fluxo-caixa/recebimentos/${ev.receiptId}`, { method: "PATCH", body: JSON.stringify({ receivedAt: day }) });
  }

  function setExpected(ev: Ev) {
    const day = prompt("Nova data prevista (AAAA-MM-DD, vazio = a definir):", ev.date ?? "");
    if (day === null) return;
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return setError("Use a data no formato AAAA-MM-DD");
    void call(`/api/admin/fluxo-caixa/recebimentos/${ev.receiptId}`, { method: "PATCH", body: JSON.stringify({ expectedAt: day || null }) });
  }

  function remove(ev: Ev) {
    if (!confirm(`Excluir o lançamento de ${fmtMoney(ev.amount)} (${monthLabel(ev.period)})?`)) return;
    void call(`/api/admin/fluxo-caixa/recebimentos/${ev.receiptId}`, { method: "DELETE" });
  }

  const t = data?.totals;
  const saldoFinal = data ? [...data.events].reverse().find((e) => e.saldo !== null)?.saldo ?? 0 : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-brand-navy">Fluxo de caixa</h1>
        <p className="text-sm text-zinc-500">Contrato da prefeitura: o que entra, o que sai para as médicas e o saldo, por data.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Recebido" bar="#00e2c3" value={t ? fmtMoney(t.recebido) : "—"}>entradas já no caixa</Kpi>
        <Kpi label="A receber" bar="#8a7fd0" value={t ? fmtMoney(t.aReceber) : "—"}>previsto ou sem data</Kpi>
        <Kpi label="Pago às médicas" bar="#15004d" value={t ? fmtMoney(t.pago) : "—"}>repasses pagos</Kpi>
        <Kpi label="A pagar às médicas" bar="#f5b301" value={t ? fmtMoney(t.aPagar) : "—"}>fechado ou em aberto</Kpi>
        <Kpi label="Saldo projetado" bar="#009594" value={saldoFinal === null ? "—" : fmtMoney(saldoFinal)}>só lançamentos com data</Kpi>
      </div>

      {t && t.semPrevisao > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {fmtMoney(t.semPrevisao)} de consultas concluídas ainda não têm recebimento lançado. Lance abaixo (recebido ou previsto).
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold text-brand-navy">Entradas, saídas e saldo por data</h2>
        <p className="mb-2 text-xs text-zinc-500">
          <span style={{ color: TEAL }}>■</span> entrada &nbsp;<span style={{ color: NAVY }}>■</span> saída &nbsp;<span style={{ color: "#f5b301" }}>●</span> saldo acumulado. Barras claras são previsões.
        </p>
        {data ? <Chart events={data.events} /> : <p className="py-10 text-center text-sm text-zinc-400">Carregando…</p>}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-bold text-brand-navy">Calendário de caixa</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="py-2 pr-3">Data</th><th className="pr-3">Movimento</th><th className="pr-3">Situação</th>
                <th className="pr-3 text-right">Entrada</th><th className="pr-3 text-right">Saída</th><th className="pr-3 text-right">Saldo</th>
                {!readOnly && <th />}
              </tr>
            </thead>
            <tbody>
              {(data?.events ?? []).map((e) => {
                const s = situacao(e, today);
                return (
                  <tr key={e.key} className="border-b border-zinc-100">
                    <td className="whitespace-nowrap py-2 pr-3">{e.date ? fmtDay(e.date) : "A definir"}</td>
                    <td className="pr-3">
                      {e.kind === "entrada" ? "Recebimento" : "Repasse às médicas"} · {monthLabel(e.period)}
                      {e.notes && <span className="block text-xs text-zinc-400">{e.notes}</span>}
                    </td>
                    <td className="pr-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.text}</span></td>
                    <td className="whitespace-nowrap pr-3 text-right font-semibold text-brand-teal-dark">{e.kind === "entrada" ? fmtMoney(e.amount) : "—"}</td>
                    <td className="whitespace-nowrap pr-3 text-right">{e.kind === "saida" ? fmtMoney(e.amount) : "—"}</td>
                    <td className={`whitespace-nowrap pr-3 text-right ${e.saldo !== null && e.saldo < 0 ? "text-red-600" : ""}`}>{e.saldo === null ? "—" : fmtMoney(e.saldo)}</td>
                    {!readOnly && (
                      <td className="whitespace-nowrap text-right">
                        {e.receiptId && (
                          <>
                            {e.status !== "realizado" && (
                              <button disabled={busy} onClick={() => markReceived(e)} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-brand-teal-dark hover:bg-brand-teal/10">Recebi</button>
                            )}
                            {e.status !== "realizado" && (
                              <button disabled={busy} onClick={() => setExpected(e)} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100">Data</button>
                            )}
                            <button disabled={busy} onClick={() => remove(e)} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50">Excluir</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {data && data.events.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-zinc-400">Nenhum lançamento ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Repasses pagos usam a data registrada no Financeiro; os demais ficam previstos para o dia 10 do mês seguinte à consulta.
        </p>
      </section>

      {!readOnly && (
        <form onSubmit={addReceipt} className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-brand-navy">Lançar recebimento</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs text-zinc-500">Mês das consultas
              <input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
            </label>
            <label className="text-xs text-zinc-500">Valor (R$)
              <input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="2550,00" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
            </label>
            <label className="text-xs text-zinc-500">{form.received ? "Data do recebimento" : "Data prevista"}
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
            </label>
            <label className="text-xs text-zinc-500">Observação
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700">
              <input type="checkbox" checked={form.received} onChange={(e) => setForm({ ...form, received: e.target.checked })} /> Já recebido
            </label>
          </div>
          <button disabled={busy} className="mt-3 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Lançar</button>
        </form>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-bold text-brand-navy">Fechamento por mês de consulta</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th className="py-2 pr-3">Mês</th><th className="pr-3 text-right">Consultas</th><th className="pr-3 text-right">Contrato</th>
                <th className="pr-3 text-right">Recebido</th><th className="pr-3 text-right">Previsto</th><th className="pr-3 text-right">Sem lançamento</th>
                <th className="pr-3 text-right">Honorários</th><th className="pr-3 text-right">Pago</th><th className="text-right">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {(data?.months ?? []).map((m) => (
                <tr key={m.month} className="border-b border-zinc-100">
                  <td className="whitespace-nowrap py-2 pr-3">{monthLabel(m.month)}</td>
                  <td className="pr-3 text-right">{m.consultas}</td>
                  <td className="whitespace-nowrap pr-3 text-right">{fmtMoney(m.receber)}</td>
                  <td className="whitespace-nowrap pr-3 text-right">{fmtMoney(m.recebido)}</td>
                  <td className="whitespace-nowrap pr-3 text-right">{fmtMoney(m.previsto)}</td>
                  <td className={`whitespace-nowrap pr-3 text-right ${m.semPrevisao > 0 ? "font-semibold text-amber-700" : ""}`}>{fmtMoney(m.semPrevisao)}</td>
                  <td className="whitespace-nowrap pr-3 text-right">{fmtMoney(m.pagar)}</td>
                  <td className="whitespace-nowrap pr-3 text-right">{fmtMoney(m.pago)}</td>
                  <td className="whitespace-nowrap text-right">{fmtMoney(m.aPagar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Contrato = valor recebido por consulta concluída. Honorários = o que se paga às médicas por essas consultas.</p>
      </section>
    </div>
  );
}
