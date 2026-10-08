"use client";

import { useCallback, useEffect, useState } from "react";

interface Item {
  label: string;
  count: number;
}
interface Report {
  from: string;
  to: string;
  funnel: { visits: number; started: number; signups: number };
  origins: { source: string; campaign: string; visits: number; started: number; signups: number }[];
  perDay: { date: string; count: number }[];
  specialties: Item[];
  care: Item[];
  rqe: { answered: number; yes: number };
  devices: Item[];
  shifts: Item[];
  states: Item[];
  avgConsult: number | null;
  avgShift: number | null;
  avgExperience: number | null;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1).replace(".", ",")}%` : "—");
const iso = (d: Date) => new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

const card = "rounded-xl border border-zinc-200 bg-white p-4";
const title = "mb-3 text-xs font-semibold text-zinc-900";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={card}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-brand-navy">{value}</p>
    </div>
  );
}

/** Linha padrão (rótulo, barra, valor): 4 por cartão, sempre alinhadas. */
function BarRow({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  return (
    <div className="grid h-8 grid-cols-[120px_1fr_48px] items-center gap-2.5 text-xs">
      <span className="truncate text-zinc-600">{label}</span>
      <span className="h-2 rounded bg-zinc-100">
        <span
          className="block h-2 rounded bg-brand-navy"
          style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%`, opacity: value > 0 ? 1 : 0 }}
        />
      </span>
      <span className="text-right font-semibold text-zinc-800">{text}</span>
    </div>
  );
}

function ListCard({ heading, rows }: { heading: string; rows: { label: string; value: number; text: string }[] }) {
  const filled = [...rows];
  while (filled.length < 4) filled.push({ label: "—", value: 0, text: "—" });
  const max = Math.max(...filled.map((r) => r.value), 0);
  return (
    <div className={card}>
      <h3 className={title}>{heading}</h3>
      {filled.slice(0, 4).map((r, i) => (
        <BarRow key={i} label={r.label} value={r.value} max={max} text={r.text} />
      ))}
    </div>
  );
}

function share(items: Item[], n: number): { label: string; value: number; text: string }[] {
  const total = items.reduce((s, i) => s + i.count, 0);
  return items.slice(0, n).map((i) => ({ label: i.label, value: i.count, text: pct(i.count, total) }));
}

export default function CaptacaoRelatorio() {
  const [to, setTo] = useState(() => iso(new Date()));
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86400000)));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [invest, setInvest] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/captacao-relatorio?from=${from}&to=${to}`);
      if (!res.ok) throw new Error();
      setReport(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function preset(days: number) {
    setTo(iso(new Date()));
    setFrom(iso(new Date(Date.now() - (days - 1) * 86400000)));
  }

  const investNum = Number(invest.replace(/\./g, "").replace(",", "."));
  const hasInvest = invest.trim() !== "" && Number.isFinite(investNum) && investNum > 0;

  function exportCsv() {
    if (!report) return;
    const lines: string[][] = [
      ["Período", `${report.from} a ${report.to}`],
      ["Visitas", String(report.funnel.visits)],
      ["Começaram a preencher", String(report.funnel.started)],
      ["Cadastros enviados", String(report.funnel.signups)],
      [],
      ["Origem", "Campanha", "Visitas", "Começaram", "Cadastros", "Conversão"],
      ...report.origins.map((o) => [o.source, o.campaign, String(o.visits), String(o.started), String(o.signups), pct(o.signups, o.visits)]),
      [],
      ["Dia", "Cadastros"],
      ...report.perDay.map((d) => [d.date, String(d.count)]),
    ];
    const csv = lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-captacao-${report.from}_${report.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chip = "rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50";
  const input = "rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-teal-dark";

  const f = report?.funnel;
  const maxDay = Math.max(1, ...(report?.perDay.map((d) => d.count) ?? [0]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip} onClick={() => preset(7)}>7 dias</button>
        <button type="button" className={chip} onClick={() => preset(30)}>30 dias</button>
        <button type="button" className={chip} onClick={() => preset(90)}>90 dias</button>
        <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={input} />
        <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={input} />
        <span className="flex-1" />
        <input
          value={invest}
          onChange={(e) => setInvest(e.target.value)}
          inputMode="decimal"
          placeholder="Investimento em anúncios (R$)"
          className={`${input} w-56`}
        />
        <button type="button" onClick={exportCsv} disabled={!report} className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          Exportar CSV
        </button>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">Não foi possível carregar o relatório.</p>}

      {report && f && (
        <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Visitas" value={f.visits.toLocaleString("pt-BR")} />
            <Kpi label="Começaram a preencher" value={f.started.toLocaleString("pt-BR")} />
            <Kpi label="Cadastros enviados" value={f.signups.toLocaleString("pt-BR")} />
            <Kpi label="Custo por cadastro" value={hasInvest && f.signups > 0 ? brl(investNum / f.signups) : "—"} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className={card}>
              <h3 className={title}>Funil do formulário</h3>
              {[
                { label: "Visitas", v: f.visits, p: 100 },
                { label: "Começaram", v: f.started, p: f.visits ? (f.started / f.visits) * 100 : 0 },
                { label: "Enviaram", v: f.signups, p: f.visits ? (f.signups / f.visits) * 100 : 0 },
              ].map((r, i) => (
                <div key={r.label} className="grid h-9 grid-cols-[90px_1fr_56px] items-center gap-2.5 text-xs">
                  <span className="text-zinc-600">{r.label}</span>
                  <span className="h-6 rounded bg-zinc-100">
                    <span
                      className={`flex h-6 items-center rounded px-2 text-[11px] font-semibold ${i === 2 ? "bg-brand-teal text-brand-navy" : "bg-brand-navy text-white"}`}
                      style={{ width: `${Math.max(r.v > 0 ? 8 : 0, Math.min(100, r.p))}%` }}
                    >
                      {r.v > 0 ? pct(r.v, f.visits) : ""}
                    </span>
                  </span>
                  <span className="text-right font-semibold text-zinc-800">{r.v.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
            <div className={card}>
              <h3 className={title}>Cadastros por dia</h3>
              <div className="flex h-[108px] items-end gap-[3px]">
                {report.perDay.map((d) => (
                  <span
                    key={d.date}
                    title={`${d.date.split("-").reverse().join("/")}: ${d.count}`}
                    className="flex-1 rounded-t bg-brand-teal"
                    style={{ height: `${d.count > 0 ? Math.max(6, (d.count / maxDay) * 100) : 2}%`, opacity: d.count > 0 ? 1 : 0.35 }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={`${card} overflow-x-auto`}>
            <h3 className={title}>Por origem e campanha</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] text-zinc-500">
                  <th className="py-1.5">Origem</th>
                  <th className="py-1.5">Campanha</th>
                  <th className="py-1.5 text-right">Visitas</th>
                  <th className="py-1.5 text-right">Começaram</th>
                  <th className="py-1.5 text-right">Cadastros</th>
                  <th className="py-1.5 text-right">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {report.origins.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-center text-zinc-400">Sem dados no período</td>
                  </tr>
                )}
                {report.origins.map((o) => (
                  <tr key={`${o.source}-${o.campaign}`} className="border-b border-zinc-100">
                    <td className="py-2">{o.source}</td>
                    <td className="py-2">{o.campaign}</td>
                    <td className="py-2 text-right">{o.visits}</td>
                    <td className="py-2 text-right">{o.started}</td>
                    <td className="py-2 text-right font-semibold">{o.signups}</td>
                    <td className="py-2 text-right">{pct(o.signups, o.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ListCard heading="Especialidades" rows={share(report.specialties, 4).map((r, i) => ({ ...r, text: String(report.specialties[i].count) }))} />
            <ListCard
              heading="Preferência de atuação"
              rows={[
                ...["Por consulta", "Plantão", "Ambos"].map((l) => {
                  const c = report.care.find((x) => x.label === l)?.count ?? 0;
                  return { label: l, value: c, text: String(c) };
                }),
                {
                  label: "Com RQE",
                  value: report.rqe.yes,
                  text: report.rqe.answered ? pct(report.rqe.yes, report.rqe.answered) : "—",
                },
              ]}
            />
            <ListCard
              heading="Dispositivo e turno"
              rows={[
                ...["celular", "computador", "tablet"].map((l) => {
                  const total = report.devices.reduce((s, d) => s + d.count, 0);
                  const c = report.devices.find((x) => x.label === l)?.count ?? 0;
                  return { label: l.charAt(0).toUpperCase() + l.slice(1), value: c, text: pct(c, total) };
                }),
                {
                  label: report.shifts[0] ? `Turno: ${report.shifts[0].label}` : "Turno",
                  value: report.shifts[0]?.count ?? 0,
                  text: report.shifts[0] ? String(report.shifts[0].count) : "—",
                },
              ]}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Valor médio por consulta" value={report.avgConsult != null ? brl(report.avgConsult) : "—"} />
            <Kpi label="Valor médio por plantão" value={report.avgShift != null ? brl(report.avgShift) : "—"} />
            <Kpi label="Experiência média" value={report.avgExperience != null ? `${Math.round(report.avgExperience)} anos` : "—"} />
          </div>
        </div>
      )}
      {loading && !report && <p className="text-xs text-zinc-500">Carregando...</p>}
    </div>
  );
}
