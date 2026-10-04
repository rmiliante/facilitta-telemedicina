"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Admin → Relatórios: relatório mensal para a prestação de contas à
 * prefeitura (cota por especialidade, comparecimento, faltas, produção
 * por médico) e lista de pacientes com faltas recorrentes. Exporta
 * planilha e imprime / salva em PDF pelo navegador.
 */

interface Report {
  month: string;
  totais: {
    agendamentos: number;
    realizados: number;
    faltas: number;
    cancelados: number;
    taxaFaltas: number | null;
    pacientesAtendidos: number;
    duracaoMedia: number | null;
    cotaTotal: number;
    valorReceber?: number;
    especialidadesSemValor?: number;
  };
  faturamento?: { disponivel: boolean; inicioContrato: string; primeiroMes: boolean; antesDoContrato: boolean };
  especialidades: {
    id: string;
    name: string;
    cota: number;
    agendados: number;
    usoCota: number | null;
    realizados: number;
    faltas: number;
    cancelados: number;
    taxaFaltas: number | null;
    duracaoMedia: number | null;
    valorConsulta?: number | null;
    semValor?: number;
    faturadas?: number;
    valorReceber?: number | null;
    regra?: string;
    regraLabel?: string;
  }[];
  medicos: { id: string; name: string; realizados: number; faltas: number; taxaFaltas: number | null; duracaoMedia: number | null }[];
  faltososRecorrentes: { id: string; name: string; phone: string | null; faltas: number; ultima: string }[];
}

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const p = (v: number | null) => (v === null ? "—" : `${v}%`);
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mins = (v: number | null) => (v === null ? "—" : `${v} min`);

/** Cor da barra de uso da cota: verde, amarelo a partir de 80%, vermelho no limite. */
export function quotaColor(uso: number | null) {
  if (uso === null) return "#d4d4d8";
  if (uso >= 100) return "#dc2626";
  if (uso >= 80) return "#f5b301";
  return "#00e2c3";
}

export function QuotaBar({ uso }: { uso: number | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 print:border print:border-zinc-300">
      <div style={{ width: `${Math.min(uso ?? 0, 100)}%`, background: quotaColor(uso) }} className="h-full" />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 print:break-inside-avoid">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-brand-navy">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function exportCsv(r: Report) {
  const cell = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (cols: (string | number | null)[]) => cols.map(cell).join(";");
  const t = r.totais;
  const lines = [
    line([`Relatório de atendimentos — ${monthLabel(r.month)}`]),
    "",
    line(["Agendamentos", "Realizados", "Faltas", "Taxa de faltas (%)", "Cancelados", "Pacientes atendidos", "Duração média (min)", "Cota total"]),
    line([t.agendamentos, t.realizados, t.faltas, t.taxaFaltas, t.cancelados, t.pacientesAtendidos, t.duracaoMedia, t.cotaTotal]),
    "",
    line(["Especialidade", "Cota", "Agendados", "Uso da cota (%)", "Realizados", "Faltas", "Taxa de faltas (%)", "Cancelados", "Duração média (min)"]),
    ...r.especialidades.map((s) => line([s.name, s.cota, s.agendados, s.usoCota, s.realizados, s.faltas, s.taxaFaltas, s.cancelados, s.duracaoMedia])),
    "",
    line(["Faturamento — especialidade", "Realizadas", "Cota", "Consultas cobradas", "Valor médio por consulta (R$)", "Valor a receber (R$)", "Regra"]),
    ...r.especialidades.map((s) =>
      line([
        s.name,
        s.realizados,
        s.cota,
        s.faturadas ?? null,
        s.valorConsulta != null ? s.valorConsulta.toFixed(2).replace(".", ",") : null,
        s.valorReceber != null ? s.valorReceber.toFixed(2).replace(".", ",") : null,
        s.regraLabel ?? null,
      ])
    ),
    line(["Valor final a receber (R$)", "", "", "", "", t.valorReceber != null ? t.valorReceber.toFixed(2).replace(".", ",") : "", ""]),
    "",
    line(["Médico", "Realizados", "Faltas", "Taxa de faltas (%)", "Duração média (min)"]),
    ...r.medicos.map((m) => line([m.name, m.realizados, m.faltas, m.taxaFaltas, m.duracaoMedia])),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_atendimentos_${r.month}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportsTab() {
  const [month, setMonth] = useState(() => shiftMonth(currentMonth(), -1));
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/relatorios?month=${month}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Falha ao carregar o relatório");
        setData(null);
        return;
      }
      setError(null);
      setData(json);
    } catch {
      setError("Falha ao carregar o relatório");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const t = data?.totais;

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h2 className="text-lg font-bold text-brand-navy">Relatórios</h2>
        <p className="text-sm text-zinc-500">
          Relatório mensal para a prestação de contas: cota por especialidade, comparecimento, faltas e produção por médico.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 print:hidden">
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-brand-navy hover:bg-zinc-50" aria-label="Mês anterior">
          ‹
        </button>
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-brand-navy" />
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-brand-navy hover:bg-zinc-50" aria-label="Próximo mês">
          ›
        </button>
        <span className="ml-1 text-sm font-semibold text-brand-navy">{monthLabel(month)}</span>
        <span className="flex-1" />
        <button type="button" disabled={!data} onClick={() => window.print()} className="rounded-md border border-brand-navy px-3 py-2 text-xs font-bold text-brand-navy hover:bg-zinc-50 disabled:opacity-40">
          🖨 Imprimir / PDF
        </button>
        <button type="button" disabled={!data} onClick={() => data && exportCsv(data)} className="rounded-md bg-brand-teal px-3 py-2 text-xs font-bold text-brand-navy hover:opacity-90 disabled:opacity-40">
          ⬇ Exportar planilha
        </button>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && !data && <p className="text-sm text-zinc-400">Carregando...</p>}

      {data && t && (
        <div className="space-y-5">
          <div className="hidden print:block">
            <p className="text-xs text-zinc-500">Facilitta Saúde — Telemedicina</p>
            <h1 className="text-xl font-bold text-brand-navy">Relatório de atendimentos — {monthLabel(data.month)}</h1>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-3">
            <Stat label="Agendamentos" value={String(t.agendamentos)} sub={t.cotaTotal ? `de ${t.cotaTotal} contratados` : undefined} />
            <Stat label="Realizados" value={String(t.realizados)} />
            <Stat label="Faltas" value={String(t.faltas)} sub={`taxa de faltas ${p(t.taxaFaltas)}`} />
            <Stat label="Cancelados" value={String(t.cancelados)} />
            <Stat label="Pacientes atendidos" value={String(t.pacientesAtendidos)} sub="pessoas diferentes" />
            <Stat label="Duração média" value={mins(t.duracaoMedia)} sub="por atendimento" />
          </div>

          <section className="rounded-xl border-2 border-brand-teal-dark bg-white p-4 print:break-inside-avoid">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[16rem] flex-1">
                <p className="text-sm font-bold text-brand-navy">Faturamento do mês (prefeitura)</p>
                <p className="text-xs text-zinc-500">
                  {!data.faturamento?.disponivel
                    ? "Falta rodar a atualização do banco (migration_valor_contrato_medico.sql)."
                    : data.faturamento.antesDoContrato
                      ? "Mês anterior ao início do contrato: sem faturamento."
                      : data.faturamento.primeiroMes
                        ? "Primeiro mês do contrato: cobrado pelas consultas realizadas, cada uma pelo valor do médico que atendeu."
                        : "Mínimo da cota contratada por especialidade; acima da cota, cobra-se cada consulta realizada. Cada consulta vale o combinado com o médico que atendeu; as que completam a cota valem a média do mês."}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Valor final a receber</p>
                <p className="text-3xl font-extrabold text-brand-navy">
                  {data.faturamento?.disponivel ? money(t.valorReceber ?? 0) : "—"}
                </p>
                {!data.faturamento?.antesDoContrato && (t.especialidadesSemValor ?? 0) > 0 && (
                  <p className="text-[11px] text-amber-700">
                    {t.especialidadesSemValor} especialidade(s) sem valor no cadastro do médico — não entram no total
                  </p>
                )}
              </div>
            </div>
            {data.faturamento?.disponivel && !data.faturamento.antesDoContrato && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                      <th className="py-1.5 pr-3 font-semibold">Especialidade</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Realizadas</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Cota</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Cobradas</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Valor médio/consulta</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">A receber</th>
                      <th className="py-1.5 font-semibold">Regra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.especialidades.map((s) => (
                      <tr key={s.id} className="border-t border-zinc-100">
                        <td className="py-2 pr-3 text-brand-navy">{s.name}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{s.realizados}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{s.cota}</td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">{s.faturadas ?? "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {s.valorConsulta != null ? money(s.valorConsulta) : <span className="text-amber-700">sem valor</span>}
                          {(s.semValor ?? 0) > 0 && <span className="block text-[11px] text-amber-700">{s.semValor} consulta(s) sem valor</span>}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums text-brand-navy">
                          {s.valorReceber != null ? money(s.valorReceber) : "—"}
                        </td>
                        <td className="py-2 text-xs text-zinc-500">{s.regraLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200">
                      <td className="py-2 pr-3 font-bold text-brand-navy" colSpan={5}>
                        Total
                      </td>
                      <td className="py-2 pr-3 text-right font-extrabold tabular-nums text-brand-navy">{money(t.valorReceber ?? 0)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 print:break-inside-avoid">
            <p className="mb-3 text-sm font-bold text-brand-navy">Cota por especialidade</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="py-1.5 pr-3 font-semibold">Especialidade</th>
                    <th className="w-40 py-1.5 pr-3 font-semibold">Uso da cota</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Agendados / cota</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Realizados</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Faltas</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Cancelados</th>
                    <th className="py-1.5 text-right font-semibold">Duração média</th>
                  </tr>
                </thead>
                <tbody>
                  {data.especialidades.map((s) => (
                    <tr key={s.id} className="border-t border-zinc-100">
                      <td className="py-2 pr-3 text-brand-navy">{s.name}</td>
                      <td className="py-2 pr-3">
                        <QuotaBar uso={s.usoCota} />
                        <span className="text-[11px] text-zinc-500">{p(s.usoCota)}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {s.agendados} / {s.cota}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.realizados}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {s.faltas} <span className="text-[11px] text-zinc-400">({p(s.taxaFaltas)})</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.cancelados}</td>
                      <td className="py-2 text-right tabular-nums">{mins(s.duracaoMedia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 print:break-inside-avoid">
            <p className="mb-3 text-sm font-bold text-brand-navy">Produção por médico</p>
            {data.medicos.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum atendimento no mês.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="py-1.5 pr-3 font-semibold">Médico</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Realizados</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Faltas</th>
                    <th className="py-1.5 text-right font-semibold">Duração média</th>
                  </tr>
                </thead>
                <tbody>
                  {data.medicos.map((m) => (
                    <tr key={m.id} className="border-t border-zinc-100">
                      <td className="py-2 pr-3 text-brand-navy">{m.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{m.realizados}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {m.faltas} <span className="text-[11px] text-zinc-400">({p(m.taxaFaltas)})</span>
                      </td>
                      <td className="py-2 text-right tabular-nums">{mins(m.duracaoMedia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 print:hidden">
            <p className="text-sm font-bold text-brand-navy">Pacientes com faltas recorrentes</p>
            <p className="mb-3 text-xs text-zinc-500">2 ou mais faltas nos últimos 90 dias (até o fim do mês). Vale confirmar antes de agendar de novo.</p>
            {data.faltososRecorrentes.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum paciente com faltas recorrentes.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="py-1.5 pr-3 font-semibold">Paciente</th>
                    <th className="py-1.5 pr-3 font-semibold">Telefone</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Faltas</th>
                    <th className="py-1.5 text-right font-semibold">Última falta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.faltososRecorrentes.map((f) => (
                    <tr key={f.id} className="border-t border-zinc-100">
                      <td className="py-2 pr-3 text-brand-navy">{f.name}</td>
                      <td className="py-2 pr-3 text-zinc-600">{f.phone ?? "—"}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-red-700 tabular-nums">{f.faltas}</td>
                      <td className="py-2 text-right tabular-nums text-zinc-600">
                        {new Date(f.ultima).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
