"use client";

import { useMemo, useState } from "react";
import { fmtDay, fmtMoney, monthLabel } from "./FinanceShared";

/**
 * Fluxo de caixa → DRE: entradas e saídas agrupadas, com os lançamentos de cada
 * linha ao clicar. O aporte entra como "Empréstimo (Aporte)" (fora da receita) e,
 * no mês seguinte, vira despesa financeira de aporte + 20%.
 */

interface Ev {
  key: string;
  date: string | null;
  kind: "entrada" | "saida";
  period: string;
  amount: number;
  status: "realizado" | "previsto" | "a_definir";
  notes?: string | null;
  tipo?: "recebimento" | "repasse" | "despesa";
  label?: string;
  categoria?: string;
  projetado?: boolean;
}
interface PlanLite {
  aporte: number;
  saldoMinimoEm: string;
  categorias: Record<string, string>;
}

const CUSTO_APORTE = 0.2;
const NAVY = "#15004d";

interface Item {
  date: string;
  text: string;
  note?: string;
  amount: number;
  previsto: boolean;
}
type Line = "receitas" | "repasses" | "aporte" | "financeira" | `cat:${string}`;

const cents = (v: number) => Math.round(v * 100) / 100;
function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}
function monthsBack(cur: string, n: number) {
  const [y, m] = cur.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = y * 12 + (m - 1) - i;
    out.push(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}
const isAporte = (e: Ev) => e.tipo === "recebimento" && /aporte/i.test(e.notes ?? "");

export default function CashFlowDre({ events, plan, today }: { events: Ev[]; plan: PlanLite; today: string }) {
  const [view, setView] = useState<"mes" | "consolidado">("mes");
  const [range, setRange] = useState<"3" | "12" | "tudo">("12");
  const [previsto, setPrevisto] = useState(false);
  const [open, setOpen] = useState<{ line: Line; month: string | "total" } | null>(null);

  const { cells, months, semData } = useMemo(() => {
    const cells = new Map<string, Item[]>(); // `${line}|${month}`
    const push = (line: Line, month: string, it: Item) => {
      const k = `${line}|${month}`;
      cells.set(k, [...(cells.get(k) ?? []), it]);
    };
    let semData = 0;
    const aportes: { month: string; amount: number }[] = [];
    for (const e of events) {
      if (e.status !== "realizado" && !previsto) continue;
      if (!e.date) {
        semData++;
        continue;
      }
      const month = e.date.slice(0, 7);
      const it: Item = { date: e.date, text: "", note: e.notes ?? undefined, amount: e.amount, previsto: e.status !== "realizado" };
      if (e.tipo === "despesa") {
        it.text = e.label ?? "Despesa";
        push(`cat:${e.categoria ?? "outras"}`, month, it);
      } else if (e.kind === "saida") {
        it.text = `Repasse às médicas · consultas de ${monthLabel(e.period)}`;
        push("repasses", month, it);
      } else if (isAporte(e)) {
        it.text = "Empréstimo (Aporte)";
        push("aporte", month, it);
        aportes.push({ month, amount: e.amount });
      } else {
        it.text = `Recebimento da prefeitura · consultas de ${monthLabel(e.period)}`;
        push("receitas", month, it);
      }
    }
    // Aporte que o plano indica como necessário (só na visão com previsão).
    if (previsto && plan.aporte > 0 && plan.saldoMinimoEm) {
      const month = plan.saldoMinimoEm.slice(0, 7);
      push("aporte", month, { date: plan.saldoMinimoEm, text: "Aporte necessário (projeção do plano)", amount: plan.aporte, previsto: true });
      aportes.push({ month, amount: plan.aporte });
    }
    // Aporte + 20% como despesa financeira no mês seguinte.
    for (const a of aportes) {
      const m = nextMonth(a.month);
      const date = `${m}-10`;
      const prev = date > today;
      if (prev && !previsto) continue;
      push("financeira", m, { date, text: `Devolução do aporte de ${monthLabel(a.month)}`, amount: a.amount, previsto: prev });
      push("financeira", m, { date, text: `Custo do empréstimo — ${Math.round(CUSTO_APORTE * 100)}% sobre ${fmtMoney(a.amount)}`, amount: cents(a.amount * CUSTO_APORTE), previsto: prev });
    }
    const all = [...new Set([...cells.keys()].map((k) => k.split("|")[1]))].sort();
    return { cells, months: all, semData };
  }, [events, previsto, plan, today]);

  const curMonth = today.slice(0, 7);
  const shown = useMemo(() => {
    const base = months.length ? months : [curMonth];
    if (range === "tudo") return base;
    const first = base[0];
    const win = monthsBack(curMonth, Number(range)).filter((m) => m >= first);
    // mantém meses futuros que tenham previsão
    return [...new Set([...win, ...base.filter((m) => m > curMonth && previsto)])].sort();
  }, [months, range, curMonth, previsto]);

  const sumLine = (line: Line, month: string) => cents((cells.get(`${line}|${month}`) ?? []).reduce((a, i) => a + i.amount, 0));
  const sumRange = (line: Line) => cents(shown.reduce((a, m) => a + sumLine(line, m), 0));
  const cats = useMemo(() => {
    const set = new Set<string>();
    for (const k of cells.keys()) if (k.startsWith("cat:")) set.add(k.slice(4).split("|")[0]);
    return [...set].sort((a, b) => (plan.categorias[a] ?? a).localeCompare(plan.categorias[b] ?? b));
  }, [cells, plan.categorias]);

  const cols = view === "mes" ? [...shown, "total" as const] : (["total"] as const);
  const val = (line: Line, c: string) => (c === "total" ? sumRange(line) : sumLine(line, c));
  const despesasTotal = (c: string) => cents(cats.reduce((a, k) => a + val(`cat:${k}`, c), 0));
  const margem = (c: string) => cents(val("receitas", c) - val("repasses", c));
  const operacional = (c: string) => cents(margem(c) - despesasTotal(c));
  const resultado = (c: string) => cents(operacional(c) - val("financeira", c));

  const detail = useMemo(() => {
    if (!open) return null;
    const ms = open.month === "total" ? shown : [open.month];
    const items = ms.flatMap((m) => cells.get(`${open.line}|${m}`) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const name = open.line.startsWith("cat:")
      ? plan.categorias[open.line.slice(4)] ?? open.line.slice(4)
      : { receitas: "Recebimentos da prefeitura", repasses: "Repasses às médicas", aporte: "Empréstimo (Aporte)", financeira: "Despesas financeiras" }[open.line as "receitas"];
    return { items, title: `${name} · ${open.month === "total" ? (view === "mes" ? "período" : "período selecionado") : monthLabel(open.month)}`, total: cents(items.reduce((a, i) => a + i.amount, 0)) };
  }, [open, cells, shown, plan.categorias, view]);

  const head = "px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
  const money = (n: number) => (n === 0 ? "—" : fmtMoney(n));
  const cell = (line: Line, c: string, cls = "") => {
    const n = val(line, c);
    const active = open?.line === line && open.month === c;
    return (
      <td key={c} className={`px-2 py-1.5 text-right ${cls}`}>
        {n === 0 ? (
          "—"
        ) : (
          <button type="button" onClick={() => setOpen(active ? null : { line, month: c })} className={`whitespace-nowrap rounded px-1 underline decoration-dotted underline-offset-2 ${active ? "bg-brand-teal/20 font-bold" : "hover:bg-zinc-100"}`}>
            {fmtMoney(n)}
          </button>
        )}
      </td>
    );
  };
  const groupRow = (label: string, value: (c: string) => number, tone = "") => (
    <tr className={tone || "bg-zinc-50"}>
      <td className="px-2 py-2 text-xs font-bold" style={tone ? undefined : { color: NAVY }}>{label}</td>
      {cols.map((c) => (
        <td key={c} className="whitespace-nowrap px-2 py-2 text-right text-xs font-bold">{value(c) < 0 ? <span className={tone ? "" : "text-red-600"}>−{fmtMoney(-value(c))}</span> : money(value(c))}</td>
      ))}
    </tr>
  );
  const total = (label: string, value: (c: string) => number) => (
    <tr style={{ background: NAVY }} className="text-white">
      <td className="px-2 py-2 text-xs font-extrabold">{label}</td>
      {cols.map((c) => (
        <td key={c} className="whitespace-nowrap px-2 py-2 text-right text-xs font-extrabold">{value(c) < 0 ? `−${fmtMoney(-value(c))}` : money(value(c))}</td>
      ))}
    </tr>
  );
  const seg = (on: boolean) => `px-3 py-1.5 text-xs ${on ? "bg-brand-navy font-semibold text-white" : "text-zinc-600 hover:bg-zinc-50"}`;
  const pctBase = val("receitas", "total");

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-bold text-brand-navy">DRE — demonstrativo de resultado</h2>
      <p className="mb-3 text-xs text-zinc-500">Entradas e saídas agrupadas. Clique em um valor para ver cada lançamento.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-zinc-300">
          <button type="button" className={seg(view === "consolidado")} onClick={() => { setView("consolidado"); setOpen(null); }}>Consolidado</button>
          <button type="button" className={seg(view === "mes")} onClick={() => { setView("mes"); setOpen(null); }}>Mês a mês</button>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-zinc-300">
          <button type="button" className={seg(range === "3")} onClick={() => setRange("3")}>Trimestre</button>
          <button type="button" className={seg(range === "12")} onClick={() => setRange("12")}>Ano</button>
          <button type="button" className={seg(range === "tudo")} onClick={() => setRange("tudo")}>Tudo</button>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-zinc-300">
          <button type="button" className={seg(!previsto)} onClick={() => setPrevisto(false)}>Realizado</button>
          <button type="button" className={seg(previsto)} onClick={() => setPrevisto(true)}>Realizado + previsto</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Descrição</th>
              {cols.map((c) => <th key={c} className={head}>{c === "total" ? (view === "mes" ? "Total" : "Valor") : monthLabel(c).replace(/ de /, "/")}</th>)}
              {view === "consolidado" && <th className={head}>% receita</th>}
            </tr>
          </thead>
          <tbody>
            {groupRow("(+) RECEITAS", (c) => val("receitas", c))}
            <tr className="border-b border-zinc-100"><td className="py-1.5 pl-6 pr-2">Recebimentos da prefeitura</td>{cols.map((c) => cell("receitas", c, "text-brand-teal-dark font-semibold"))}{view === "consolidado" && <td className="px-2 text-right text-xs text-zinc-500">{pctBase ? "100%" : "—"}</td>}</tr>
            {groupRow("(−) REPASSES ÀS MÉDICAS", (c) => val("repasses", c))}
            <tr className="border-b border-zinc-100"><td className="py-1.5 pl-6 pr-2">Honorários</td>{cols.map((c) => cell("repasses", c))}{view === "consolidado" && <td className="px-2 text-right text-xs text-zinc-500">{pctBase ? `${((val("repasses", "total") / pctBase) * 100).toFixed(1)}%` : "—"}</td>}</tr>
            {total("= MARGEM DE CONTRIBUIÇÃO", margem)}
            {groupRow("(−) DESPESAS OPERACIONAIS", despesasTotal)}
            {cats.map((k) => (
              <tr key={k} className="border-b border-zinc-100">
                <td className="py-1.5 pl-6 pr-2">{plan.categorias[k] ?? k}</td>
                {cols.map((c) => cell(`cat:${k}`, c))}
                {view === "consolidado" && <td className="px-2 text-right text-xs text-zinc-500">{pctBase ? `${((val(`cat:${k}`, "total") / pctBase) * 100).toFixed(1)}%` : "—"}</td>}
              </tr>
            ))}
            {cats.length === 0 && <tr><td colSpan={cols.length + 2} className="py-2 pl-6 text-xs text-zinc-400">Nenhuma despesa lançada no período.</td></tr>}
            {total("= RESULTADO OPERACIONAL", operacional)}
            {groupRow("(−) DESPESAS FINANCEIRAS", (c) => val("financeira", c))}
            <tr className="border-b border-zinc-100"><td className="py-1.5 pl-6 pr-2">Aporte + 20% (devolução no mês seguinte)</td>{cols.map((c) => cell("financeira", c, "text-red-700"))}{view === "consolidado" && <td />}</tr>
            {total("= RESULTADO DO PERÍODO", resultado)}
            <tr className="bg-amber-50">
              <td className="px-2 py-2 text-xs font-bold text-amber-800">ENTRADA DE CAIXA FORA DO RESULTADO</td>
              <td colSpan={cols.length + (view === "consolidado" ? 1 : 0)} />
            </tr>
            <tr>
              <td className="py-1.5 pl-6 pr-2">Empréstimo (Aporte) <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">não é receita</span></td>
              {cols.map((c) => cell("aporte", c))}
              {view === "consolidado" && <td />}
            </tr>
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="mt-3 rounded-lg border border-brand-teal/40 bg-brand-teal/5 p-3">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-navy">{detail.title} — {fmtMoney(detail.total)}</h3>
            <button type="button" onClick={() => setOpen(null)} className="text-xs text-zinc-500 hover:underline">Fechar</button>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {detail.items.map((i, n) => (
                <tr key={n} className="border-b border-zinc-100 last:border-0">
                  <td className="w-16 whitespace-nowrap py-1.5 text-zinc-500">{fmtDay(i.date)}</td>
                  <td className="py-1.5">
                    {i.text}
                    {i.previsto && <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">previsto</span>}
                    {i.note && <span className="block text-zinc-400">{i.note}</span>}
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-right font-semibold">{fmtMoney(i.amount)}</td>
                </tr>
              ))}
              {detail.items.length === 0 && <tr><td className="py-2 text-zinc-400">Sem lançamentos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-zinc-500">
        Regime de caixa: cada valor entra no mês da data do recebimento ou pagamento.{" "}
        {semData > 0 && `${semData} lançamento(s) sem data ficam de fora até receberem uma data. `}
        O aporte não é receita: no mês seguinte ele volta como despesa financeira (valor + {Math.round(CUSTO_APORTE * 100)}%).
      </p>
    </section>
  );
}
