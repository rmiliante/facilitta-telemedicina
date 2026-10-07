"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/** Dashboard > Pacientes: só estatísticas (nada clínico individual). */

interface Item {
  name: string;
  count: number;
}
interface PendingRow {
  id: string;
  name: string;
  cpf: string | null;
  city: string | null;
  createdAt: string;
  scheduledFor: string | null;
  specialty: string | null;
}
interface Stats {
  total: number;
  novos: number;
  novosLabel: string;
  atendidos: number;
  semConsulta: number;
  semConsultaPct: number;
  retornoPct: number | null;
  months: { key: string; label: string; count: number }[];
  bySpecialty: Item[];
  byCity: Item[];
  byAge: Item[];
  frequentes: { name: string; city: string | null; consultas: number; faltas: number }[];
  faltosos: { name: string; city: string | null; consultas: number; faltas: number }[];
  pending: PendingRow[];
  pendingTotal: number;
  cities: string[];
}
interface Filters {
  from: string;
  to: string;
  specialtyId: string;
  city: string;
  situacao: string;
}

const EMPTY: Filters = { from: "", to: "", specialtyId: "", city: "", situacao: "todos" };
const fieldCls =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-brand-teal-dark";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function br(day: string) {
  return day.split("-").reverse().join("/");
}

function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "teal" | "amber" }) {
  const color = tone === "teal" ? "text-brand-teal-dark" : tone === "amber" ? "text-amber-600" : "text-brand-navy";
  return (
    <div className={`rounded-lg border bg-white p-4 ${tone === "amber" ? "border-amber-300" : "border-zinc-200"}`}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

function Bars({ items, color = "bg-brand-teal" }: { items: Item[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) return <p className="text-xs text-zinc-400">Sem dados no período.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate text-zinc-700" title={i.name}>
            {i.name}
          </span>
          <span className="h-2.5 flex-1 rounded-full bg-zinc-100">
            <span
              className={`block h-2.5 rounded-full ${color}`}
              style={{ width: `${i.count ? Math.max(3, (i.count / max) * 100) : 0}%` }}
            />
          </span>
          <span className="w-10 text-right text-zinc-500">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PacientesDashboard() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (f.from) qs.set("from", f.from);
      if (f.to) qs.set("to", f.to);
      if (f.specialtyId) qs.set("specialtyId", f.specialtyId);
      if (f.city) qs.set("city", f.city);
      if (f.situacao !== "todos") qs.set("situacao", f.situacao);
      const res = await fetch(`/api/admin/dashboard-pacientes?${qs.toString()}`);
      if (res.status === 403) {
        setError("Este nível de acesso não vê estatísticas de pacientes.");
        return;
      }
      if (!res.ok) {
        setError("Falha ao carregar os dados.");
        return;
      }
      setData((await res.json()) as Stats);
    } catch {
      setError("Falha ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(applied), 0);
    return () => clearTimeout(t);
  }, [applied, load]);

  useEffect(() => {
    fetch("/api/admin/specialties")
      .then((r) => (r.ok ? r.json() : { specialties: [] }))
      .then((d) => setSpecialties(d.specialties ?? []))
      .catch(() => {});
  }, []);

  function shortcut(v: string) {
    const now = new Date(Date.now() - 3 * 3600 * 1000);
    if (v === "mes") {
      const a = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const b = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      setDraft((d) => ({ ...d, from: ymd(a), to: ymd(b) }));
    } else if (v === "30d") {
      setDraft((d) => ({ ...d, from: ymd(new Date(now.getTime() - 29 * 86400000)), to: ymd(now) }));
    } else if (v === "ano") {
      setDraft((d) => ({ ...d, from: `${now.getUTCFullYear()}-01-01`, to: `${now.getUTCFullYear()}-12-31` }));
    } else if (v === "tudo") {
      setDraft((d) => ({ ...d, from: "", to: "" }));
    }
  }

  function exportCsv() {
    if (!data) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      ["Paciente", "CPF", "Cidade", "Cadastro", "Situação", "Especialidade"].join(";"),
      ...data.pending.map((p) =>
        [
          esc(p.name),
          esc(p.cpf ?? ""),
          esc(p.city ?? ""),
          br(p.createdAt),
          esc(p.scheduledFor ? `Agendada ${br(p.scheduledFor)}` : "Sem agendamento"),
          esc(p.specialty ?? ""),
        ].join(";")
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pacientes-sem-consulta.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const monthMax = data ? Math.max(1, ...data.months.map((m) => m.count)) : 1;
  const rows = data ? (showAll ? data.pending : data.pending.slice(0, 15)) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-3">
        <label className="text-[11px] text-zinc-500">
          De
          <input type="date" className={`${fieldCls} mt-0.5 block`} value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
        </label>
        <label className="text-[11px] text-zinc-500">
          Até
          <input type="date" className={`${fieldCls} mt-0.5 block`} value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
        </label>
        <label className="text-[11px] text-zinc-500">
          Atalho
          <select className={`${fieldCls} mt-0.5 block`} value="" onChange={(e) => shortcut(e.target.value)}>
            <option value="">Escolher…</option>
            <option value="mes">Este mês</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="ano">Este ano</option>
            <option value="tudo">Todo o período</option>
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">
          Especialidade
          <select className={`${fieldCls} mt-0.5 block`} value={draft.specialtyId} onChange={(e) => setDraft((d) => ({ ...d, specialtyId: e.target.value }))}>
            <option value="">Todas</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">
          Cidade
          <select className={`${fieldCls} mt-0.5 block`} value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}>
            <option value="">Todas</option>
            {(data?.cities ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">
          Situação (lista sem consulta)
          <select className={`${fieldCls} mt-0.5 block`} value={draft.situacao} onChange={(e) => setDraft((d) => ({ ...d, situacao: e.target.value }))}>
            <option value="todos">Todos</option>
            <option value="agendada">Já agendada</option>
            <option value="sem_agendamento">Sem agendamento</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setShowAll(false);
            setApplied(draft);
          }}
          className="rounded-md bg-brand-teal-dark px-4 py-1.5 text-xs font-semibold text-white"
        >
          Aplicar
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(EMPTY);
            setShowAll(false);
            setApplied(EMPTY);
          }}
          className="px-2 py-1.5 text-xs text-zinc-600 underline"
        >
          Limpar
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!data && loading && <p className="text-xs text-zinc-400">Carregando...</p>}

      {data && (
        <div className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Total de pacientes" value={data.total} />
            <Kpi label="Novos cadastros" value={data.novos} tone="teal" hint={data.novosLabel} />
            <Kpi label="Pacientes atendidos" value={data.atendidos} hint="consulta concluída no período" />
            <Kpi label="Cadastrados sem consulta realizada" value={data.semConsulta} tone="amber" hint={`${data.semConsultaPct}% do total`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card title="Novos cadastros por mês (12 meses)">
              <div className="flex gap-1">
                {data.months.map((m) => (
                  <div key={m.key} className="flex-1 text-center text-[10px] text-zinc-500" title={`${m.label}: ${m.count}`}>
                    <div className="flex h-28 items-end justify-center">
                      <div className="w-3/5 rounded-t bg-brand-navy" style={{ height: `${(m.count / monthMax) * 100}%`, minHeight: m.count ? 2 : 0 }} />
                    </div>
                    {m.count}
                    <br />
                    {m.label}
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Rotina x Retorno">
              {data.retornoPct == null ? (
                <p className="text-xs text-zinc-400">Sem consultas classificadas no período.</p>
              ) : (
                <div className="space-y-2 text-xs text-zinc-700">
                  <p className="text-2xl font-semibold text-brand-navy">
                    {100 - data.retornoPct}% <span className="text-sm font-medium text-zinc-500">rotina</span>
                  </p>
                  <p className="text-2xl font-semibold text-brand-teal-dark">
                    {data.retornoPct}% <span className="text-sm font-medium text-zinc-500">retorno</span>
                  </p>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Atendidos por especialidade">
              <Bars items={data.bySpecialty} />
            </Card>
            <Card title="Pacientes por cidade">
              <Bars items={data.byCity} />
            </Card>
            <Card title="Faixa etária">
              <Bars items={data.byAge} color="bg-brand-navy" />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Mais consultas realizadas">
              <MiniTable rows={data.frequentes} col="consultas" label="Consultas" />
            </Card>
            <Card title="Mais faltas">
              <MiniTable rows={data.faltosos} col="faltas" label="Faltas" />
            </Card>
          </div>

          <Card title={`Pacientes que ainda não realizaram consulta (${data.pendingTotal})`}>
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={exportCsv} className="text-xs font-semibold text-brand-navy underline">
                Exportar lista (CSV)
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="text-xs text-zinc-400">Nenhum paciente nessa condição.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-[10.5px] uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="pb-2 pr-3 font-semibold">Paciente</th>
                      <th className="pb-2 pr-3 font-semibold">Cidade</th>
                      <th className="pb-2 pr-3 font-semibold">Cadastro</th>
                      <th className="pb-2 pr-3 font-semibold">Situação</th>
                      <th className="pb-2 font-semibold">Especialidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id} className="border-t border-zinc-100 text-zinc-700">
                        <td className="py-2 pr-3 font-medium text-brand-navy">{p.name}</td>
                        <td className="py-2 pr-3">{p.city ?? "—"}</td>
                        <td className="py-2 pr-3">{br(p.createdAt)}</td>
                        <td className="py-2 pr-3">
                          {p.scheduledFor ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                              Agendada {br(p.scheduledFor)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
                              Sem agendamento
                            </span>
                          )}
                        </td>
                        <td className="py-2">{p.specialty ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.pending.length > 15 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-zinc-600 underline">
                {showAll ? "Mostrar menos" : `Mostrar todos (${data.pending.length})`}
              </button>
            )}
            <p className="mt-2 text-[11px] text-zinc-500">
              Respeita os filtros: com período, mostra quem foi cadastrado nele; com especialidade, quem ainda não fez consulta nela.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function MiniTable({
  rows,
  col,
  label,
}: {
  rows: { name: string; city: string | null; consultas: number; faltas: number }[];
  col: "consultas" | "faltas";
  label: string;
}) {
  if (rows.length === 0) return <p className="text-xs text-zinc-400">Sem dados no período.</p>;
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-[10.5px] uppercase tracking-wide text-zinc-400">
        <tr>
          <th className="pb-2 font-semibold">Paciente</th>
          <th className="pb-2 font-semibold">Cidade</th>
          <th className="pb-2 text-right font-semibold">{label}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`} className="border-t border-zinc-100 text-zinc-700">
            <td className="py-1.5 pr-2 font-medium text-brand-navy">{r.name}</td>
            <td className="py-1.5 pr-2">{r.city ?? "—"}</td>
            <td className="py-1.5 text-right">{r[col]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
