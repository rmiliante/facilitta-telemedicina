"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import TipoConsultaBadge from "./TipoConsultaBadge";

/**
 * Admin → Histórico de atendimentos: filtros, 4 quadros com os totais do
 * período (realizados, minutos, média, rotina × retorno) e a lista, com
 * exportação em planilha (CSV que abre no Excel).
 */

interface Item {
  id: string;
  scheduled_at: string;
  status: string;
  called_at: string | null;
  finished_at: string | null;
  duration: number | null;
  tipo_consulta: string | null;
  patient: { id: string; full_name: string; cpf: string | null } | null;
  doctor: string | null;
  specialty: string | null;
}

interface Summary {
  realizados: number;
  realizadosAnterior: number;
  faltas: number;
  cancelados: number;
  totalMinutes: number;
  comDuracao: number;
  mediaMinutes: number | null;
  menorMinutes: number | null;
  maiorMinutes: number | null;
  rotina: number;
  retorno: number;
  semTipo: number;
  periodoDias: number;
}

interface Option {
  id: string;
  name: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  agendado: { label: "Agendado", cls: "bg-sky-50 text-sky-700" },
  em_andamento: { label: "Em andamento", cls: "bg-amber-50 text-amber-700" },
  concluido: { label: "Concluído", cls: "bg-brand-teal/15 text-brand-teal-dark" },
  cancelado: { label: "Cancelado", cls: "bg-zinc-100 text-zinc-500" },
  faltou: { label: "Faltou", cls: "bg-red-50 text-red-700" },
};

const PAGE_SIZE = 25;
const TZ = "America/Sao_Paulo";

/** Data de hoje (São Paulo) em YYYY-MM-DD, deslocada em N dias. */
function spDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function monthRange(offsetMonths: number): [string, string] {
  const [y, m] = spDate().split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  const last = new Date(Date.UTC(y, m + offsetMonths, 0));
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}

const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "hoje", label: "Hoje", range: () => [spDate(), spDate()] },
  { key: "7d", label: "7 dias", range: () => [spDate(-6), spDate()] },
  { key: "mes", label: "Este mês", range: () => [monthRange(0)[0], spDate()] },
  { key: "mespassado", label: "Mês passado", range: () => monthRange(-1) },
  { key: "90d", label: "90 dias", range: () => [spDate(-89), spDate()] },
];

function fmtDate(iso: string, withYear = false) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "—";
}

function fmtHours(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}min` : ""}` : `${m} min`;
}

function maskCpf(cpf: string | null) {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `•••.${d.slice(3, 6)}.•••-${d.slice(9)}` : "";
}

function formatCpf(cpf: string | null) {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf ?? "";
}

function exportCsv(items: Item[], from: string, to: string) {
  const header = ["Data", "Paciente", "CPF", "Médico", "Especialidade", "Tipo", "Início", "Fim", "Duração (min)", "Status"];
  const cell = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = items.map((i) =>
    [
      fmtDate(i.scheduled_at, true),
      i.patient?.full_name ?? "",
      formatCpf(i.patient?.cpf ?? null),
      i.doctor ?? "",
      i.specialty ?? "",
      i.tipo_consulta === "rotina" ? "Rotina" : i.tipo_consulta === "retorno" ? "Retorno" : "",
      i.called_at ? fmtTime(i.called_at) : "",
      i.finished_at ? fmtTime(i.finished_at) : "",
      i.duration,
      STATUS[i.status]?.label ?? i.status,
    ]
      .map(cell)
      .join(";"),
  );
  // BOM + ";" para o Excel em português abrir com acentos e colunas certas.
  const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `atendimentos_${from}_a_${to}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Kpi({ label, bar, children }: { label: string; bar: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 pl-5">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: bar }} />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm text-brand-navy focus:border-brand-teal-dark focus:outline-none";

/**
 * `endpoint` padrão é o do admin. No painel do médico passa-se
 * `/api/doctor/historico` e `lockedDoctorName`: o filtro de médico some e
 * o servidor devolve só as consultas do médico logado.
 */
export default function AttendanceHistoryTab({
  endpoint = "/api/admin/historico",
  lockedDoctorName,
  renderPatientHistory,
  rowHref,
}: {
  endpoint?: string;
  lockedDoctorName?: string;
  renderPatientHistory?: (patientId: string) => React.ReactNode;
  rowHref?: (item: Item) => string;
}) {
  const locked = !!lockedDoctorName;
  const [from, setFrom] = useState(() => PRESETS[2].range()[0]);
  const [to, setTo] = useState(() => PRESETS[2].range()[1]);
  const [doctorId, setDoctorId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [sort, setSort] = useState<"recentes" | "antigos" | "duracao">("recentes");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<Option[]>([]);
  const [specialties, setSpecialties] = useState<Option[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (locked) return;
    Promise.all([fetch("/api/admin/doctors"), fetch("/api/admin/specialties")])
      .then(async ([d, s]) => {
        if (d.ok) setDoctors(((await d.json()).doctors ?? []) as Option[]);
        if (s.ok) setSpecialties(((await s.json()).specialties ?? []) as Option[]);
      })
      .catch(() => {});
  }, [locked]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ from, to });
    if (doctorId) params.set("doctorId", doctorId);
    if (specialtyId) params.set("specialtyId", specialtyId);
    if (tipo) params.set("tipo", tipo);
    if (status) params.set("status", status);
    if (qDebounced) params.set("q", qDebounced);
    try {
      const res = await fetch(`${endpoint}?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao carregar o histórico.");
        return;
      }
      setError(null);
      setItems(data.items ?? []);
      setSummary(data.summary ?? null);
      setTruncated(!!data.truncated);
      setPage(0);
      setOpenId(null);
    } catch {
      setError("Falha ao carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, from, to, doctorId, specialtyId, tipo, status, qDebounced]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === "antigos") list.reverse();
    if (sort === "duracao") list.sort((a, b) => (b.duration ?? -1) - (a.duration ?? -1));
    return list;
  }, [items, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const activePreset = PRESETS.find((p) => {
    const [a, b] = p.range();
    return a === from && b === to;
  })?.key;

  function clearFilters() {
    const [a, b] = PRESETS[2].range();
    setFrom(a);
    setTo(b);
    setDoctorId("");
    setSpecialtyId("");
    setTipo("");
    setStatus("");
    setQ("");
  }

  const s = summary;
  const variation =
    s && s.realizadosAnterior > 0
      ? Math.round(((s.realizados - s.realizadosAnterior) / s.realizadosAnterior) * 100)
      : null;
  const classificados = s ? s.rotina + s.retorno : 0;
  const pctRotina = s && classificados ? Math.round((s.rotina / classificados) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-brand-navy">Histórico de atendimentos</h2>
        <p className="text-sm text-zinc-500">
          {locked
            ? `Seus atendimentos, ${lockedDoctorName}, com filtros e os totais do período selecionado.`
            : "Todos os atendimentos com filtros e os totais do período selecionado."}
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            De
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Até
            <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          {locked ? (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
              Médico
              <p className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-sm normal-case tracking-normal text-brand-navy">
                🔒 {lockedDoctorName}
              </p>
            </div>
          ) : (
            <>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Médico
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">Todos</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Especialidade
            <select value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">Todas</option>
              {specialties.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </label>
            </>
          )}
          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">Rotina e retorno</option>
              <option value="rotina">Rotina</option>
              <option value="retorno">Retorno</option>
              <option value="sem">Sem tipo</option>
            </select>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">Todos</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Buscar paciente por nome ou CPF"
            className={`${inputCls} min-w-[220px] max-w-xs flex-1`}
          />
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                const [a, b] = p.range();
                setFrom(a);
                setTo(b);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                activePreset === p.key
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-zinc-300 bg-white text-brand-navy hover:bg-zinc-50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="flex-1" />
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-zinc-50"
          >
            Limpar
          </button>
          <button
            type="button"
            disabled={!items.length}
            onClick={() => exportCsv(sorted, from, to)}
            className="rounded-md bg-brand-teal px-3 py-2 text-xs font-bold text-brand-navy hover:opacity-90 disabled:opacity-40"
          >
            ⬇ Exportar planilha
          </button>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Quadros com os totais do período */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Atendimentos realizados" bar="#00e2c3">
          <p className="mt-1 text-3xl font-extrabold text-brand-navy">{s ? s.realizados : "—"}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {variation !== null && (
              <span className={`font-semibold ${variation >= 0 ? "text-brand-teal-dark" : "text-red-600"}`}>
                {variation >= 0 ? "▲" : "▼"} {Math.abs(variation)}%{" "}
              </span>
            )}
            {variation !== null && "vs. período anterior · "}
            {s ? `${s.faltas} falta${s.faltas === 1 ? "" : "s"} · ${s.cancelados} cancelado${s.cancelados === 1 ? "" : "s"}` : ""}
          </p>
        </Kpi>
        <Kpi label="Total em atendimento" bar="#15004d">
          <p className="mt-1 text-3xl font-extrabold text-brand-navy">
            {s ? s.totalMinutes.toLocaleString("pt-BR") : "—"} <span className="text-base font-bold text-zinc-500">min</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {s ? `= ${fmtHours(s.totalMinutes)} de consulta` : ""}
            {s && s.realizados > s.comDuracao ? ` · ${s.realizados - s.comDuracao} sem horário registrado` : ""}
          </p>
        </Kpi>
        <Kpi label="Média por atendimento" bar="#009594">
          <p className="mt-1 text-3xl font-extrabold text-brand-navy">
            {s?.mediaMinutes ?? "—"} <span className="text-base font-bold text-zinc-500">min</span>
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {s?.menorMinutes !== null && s?.menorMinutes !== undefined
              ? `Menor ${s.menorMinutes} min · Maior ${s.maiorMinutes} min`
              : "Sem atendimentos com duração"}
          </p>
        </Kpi>
        <Kpi label="Rotina × Retorno" bar="#8a7fd0">
          <p className="mt-1 text-3xl font-extrabold text-brand-navy">
            {s ? s.rotina : "—"} <span className="text-base font-bold text-zinc-500">/ {s ? s.retorno : "—"}</span>
          </p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-zinc-100">
            <div style={{ width: `${pctRotina}%`, background: "#00e2c3" }} />
            <div style={{ width: `${classificados ? 100 - pctRotina : 0}%`, background: "#8a7fd0" }} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {classificados ? `${pctRotina}% primeiro atendimento · ${100 - pctRotina}% retorno` : "Nenhum classificado"}
            {s && s.semTipo ? ` · ${s.semTipo} sem tipo` : ""}
          </p>
        </Kpi>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-brand-navy">
            {loading ? "Carregando..." : `${items.length} atendimento${items.length === 1 ? "" : "s"} encontrado${items.length === 1 ? "" : "s"}`}
          </p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600"
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="duracao">Maior duração</option>
          </select>
        </div>
        {truncated && (
          <p className="mb-2 text-xs text-amber-700">Período muito longo: mostrando os 5.000 atendimentos mais recentes.</p>
        )}

        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${locked ? "min-w-[680px]" : "min-w-[820px]"}`}>
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2 font-semibold">Data</th>
                <th className="px-2 py-2 font-semibold">Paciente</th>
                {!locked && <th className="px-2 py-2 font-semibold">Médico</th>}
                <th className="px-2 py-2 font-semibold">Especialidade</th>
                <th className="px-2 py-2 font-semibold">Tipo</th>
                <th className="px-2 py-2 font-semibold">Início</th>
                <th className="px-2 py-2 font-semibold">Fim</th>
                <th className="px-2 py-2 font-semibold">Duração</th>
                <th className="px-2 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={locked ? 8 : 9} className="px-2 py-8 text-center text-sm text-zinc-400">
                    Nenhum atendimento com esses filtros.
                  </td>
                </tr>
              )}
              {pageItems.map((i) => {
                const st = STATUS[i.status] ?? { label: i.status, cls: "bg-zinc-100 text-zinc-500" };
                const open = openId === i.id;
                return (
                  <Fragment key={i.id}>
                    <tr
                      onClick={() => {
                        if (rowHref) window.location.href = rowHref(i);
                        else if (i.patient && renderPatientHistory) setOpenId(open ? null : i.id);
                      }}
                      className={`cursor-pointer border-b border-zinc-100 text-brand-navy hover:bg-zinc-50 ${open ? "bg-brand-teal/5" : ""}`}
                    >
                      <td className="px-2 py-2.5">{fmtDate(i.scheduled_at)}</td>
                      <td className="px-2 py-2.5">
                        <p className="font-semibold">{i.patient?.full_name ?? "—"}</p>
                        <p className="text-xs text-zinc-400">{maskCpf(i.patient?.cpf ?? null)}</p>
                      </td>
                      {!locked && <td className="px-2 py-2.5">{i.doctor ?? "—"}</td>}
                      <td className="px-2 py-2.5">{i.specialty ?? "—"}</td>
                      <td className="px-2 py-2.5">
                        {i.tipo_consulta ? (
                          <TipoConsultaBadge tipo={i.tipo_consulta} />
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">Sem tipo</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">{fmtTime(i.called_at)}</td>
                      <td className="px-2 py-2.5">{fmtTime(i.finished_at)}</td>
                      <td className="px-2 py-2.5 font-semibold">{i.duration !== null ? `${i.duration} min` : <span className="text-zinc-300">—</span>}</td>
                      <td className="px-2 py-2.5">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                    {open && i.patient && renderPatientHistory && (
                      <tr className="border-b border-zinc-100 bg-zinc-50/60">
                        <td colSpan={locked ? 8 : 9} className="px-3 py-3">
                          <p className="mb-2 text-xs font-semibold text-zinc-500">Histórico de {i.patient.full_name}</p>
                          {renderPatientHistory(i.patient.id)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            {items.length > 0 &&
              `Mostrando ${page * PAGE_SIZE + 1}–${Math.min(items.length, (page + 1) * PAGE_SIZE)} de ${items.length} · ${rowHref ? "clique na linha para abrir a consulta" : "clique na linha para abrir o histórico do paciente"}`}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 font-semibold text-brand-navy disabled:opacity-40"
            >
              ‹ Anterior
            </button>
            <button
              type="button"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 font-semibold text-brand-navy disabled:opacity-40"
            >
              Próxima ›
            </button>
          </span>
        </div>
      </div>

      <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Duração = do médico chamar o paciente até concluir. Faltas e cancelados aparecem na lista, mas não entram em minutos
        nem na média.
      </p>
    </div>
  );
}
