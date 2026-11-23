"use client";

import { useState } from "react";
import { fmtMoney } from "./FinanceShared";

/** Janelas de edição de um recebimento ou de uma despesa do Fluxo de caixa. */

export interface EditReceipt {
  kind: "receipt";
  id: string;
  month: string; // YYYY-MM do mês das consultas
  amount: number;
  expectedAt: string;
  receivedAt: string;
  notes: string;
}
export interface EditExpense {
  kind: "expense";
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  recurrence: "unica" | "mensal" | "anual";
  endsOn: string;
  paidAt: string;
  notes: string;
}
export type EditTarget = EditReceipt | EditExpense;

const REPEAT = { unica: "Uma vez", mensal: "Todo mês", anual: "Todo ano" } as const;
const toNumber = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));
const money = (n: number) => n.toFixed(2).replace(".", ",");
const inp = "mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900";
const lab = "block text-xs text-zinc-500";

export default function CashFlowEdit({
  target,
  categorias,
  busy,
  call,
  onError,
  onClose,
}: {
  target: EditTarget;
  categorias: Record<string, string>;
  busy: boolean;
  call: (url: string, init: RequestInit) => Promise<boolean>;
  onError: (msg: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>((): Record<string, string> =>
    target.kind === "receipt"
      ? { month: target.month, amount: money(target.amount), expectedAt: target.expectedAt, receivedAt: target.receivedAt, notes: target.notes }
      : { description: target.description, category: target.category, amount: money(target.amount), date: target.date, recurrence: target.recurrence as string, endsOn: target.endsOn, paidAt: target.paidAt, notes: target.notes },
  );
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = toNumber(v.amount);
    if (!amount || amount <= 0) return onError("Informe um valor maior que zero");
    if (target.kind === "receipt") {
      if (!v.month) return onError("Informe o mês das consultas");
      const body = { month: v.month, amount, expectedAt: v.expectedAt || null, receivedAt: v.receivedAt || null, notes: v.notes };
      if (await call(`/api/admin/fluxo-caixa/recebimentos/${target.id}`, { method: "PATCH", body: JSON.stringify(body) })) onClose();
    } else {
      if (!v.description.trim() || !v.date) return onError("Informe descrição e data da despesa");
      const body = {
        description: v.description,
        category: v.category,
        amount,
        date: v.date,
        recurrence: v.recurrence,
        endsOn: v.recurrence === "unica" ? null : v.endsOn || null,
        paidAt: v.recurrence === "unica" ? v.paidAt || null : null,
        notes: v.notes,
      };
      if (await call(`/api/admin/fluxo-caixa/despesas/${target.id}`, { method: "PATCH", body: JSON.stringify(body) })) onClose();
    }
  }

  const serie = target.kind === "expense" && target.recurrence !== "unica";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" role="dialog" aria-modal="true">
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="mb-3 text-base font-bold text-slate-900">{target.kind === "receipt" ? "Editar recebimento" : "Editar despesa"}</h2>
        {serie && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Despesa recorrente: a alteração vale para todas as repetições.
          </p>
        )}
        {target.kind === "receipt" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className={lab}>Mês das consultas<input type="month" value={v.month} onChange={(e) => set("month", e.target.value)} className={inp} /></label>
            <label className={lab}>Valor (R$)<input inputMode="decimal" value={v.amount} onChange={(e) => set("amount", e.target.value)} className={inp} /></label>
            <label className={lab}>Data prevista<input type="date" value={v.expectedAt} onChange={(e) => set("expectedAt", e.target.value)} className={inp} /></label>
            <label className={lab}>Data do recebimento<input type="date" value={v.receivedAt} onChange={(e) => set("receivedAt", e.target.value)} className={inp} /></label>
            <label className={`${lab} col-span-2`}>Observação<input value={v.notes} onChange={(e) => set("notes", e.target.value)} className={inp} /></label>
            <p className="col-span-2 text-[11px] text-zinc-400">Com a data do recebimento preenchida, o lançamento conta como recebido. Para contar como empréstimo no DRE, escreva &quot;Aporte&quot; na observação.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className={`${lab} col-span-2`}>Descrição<input value={v.description} onChange={(e) => set("description", e.target.value)} className={inp} /></label>
            <label className={lab}>Categoria
              <select value={v.category} onChange={(e) => set("category", e.target.value)} className={inp}>
                {Object.entries(categorias).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            <label className={lab}>Valor (R$)<input inputMode="decimal" value={v.amount} onChange={(e) => set("amount", e.target.value)} className={inp} /></label>
            <label className={lab}>{v.recurrence === "unica" ? "Data" : "Primeira data"}<input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} className={inp} /></label>
            <label className={lab}>Repete
              <select value={v.recurrence} onChange={(e) => set("recurrence", e.target.value)} className={inp}>
                {Object.entries(REPEAT).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            {v.recurrence === "unica" ? (
              <label className={`${lab} col-span-2`}>Data do pagamento (vazio = ainda não pago)<input type="date" value={v.paidAt} onChange={(e) => set("paidAt", e.target.value)} className={inp} /></label>
            ) : (
              <label className={`${lab} col-span-2`}>Repete até (opcional)<input type="date" value={v.endsOn} onChange={(e) => set("endsOn", e.target.value)} className={inp} /></label>
            )}
            <label className={`${lab} col-span-2`}>Observação<input value={v.notes} onChange={(e) => set("notes", e.target.value)} className={inp} /></label>
          </div>
        )}
        <p className="mt-3 text-[11px] text-zinc-400">Valor atual: {fmtMoney(target.amount)}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm">Cancelar</button>
          <button disabled={busy} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar</button>
        </div>
      </form>
    </div>
  );
}
