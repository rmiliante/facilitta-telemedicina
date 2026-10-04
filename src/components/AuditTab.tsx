"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Admin → Auditoria (LGPD): quem abriu ou alterou dados de pacientes,
 * consultas, documentos, cadastros e financeiro, quando e de onde.
 */

interface AuditItem {
  id: string;
  at: string;
  actor_type: string;
  actor_name: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
}

const ACTOR_LABEL: Record<string, string> = {
  admin: "Master",
  master: "Master",
  gestor: "Gestor",
  financeiro: "Financeiro",
  prefeitura: "Prefeitura",
  atendente: "Atendente",
  admin_recuperacao: "Master (recuperação)",
  medico: "Médico",
  anonimo: "Não identificado",
};

const TZ = "America/Sao_Paulo";

function spDate(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + offsetDays * 86400000)
  );
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Detalhes em texto curto (sem expor nada sensível — só o que a rota registrou). */
function fmtDetails(d: Record<string, unknown> | null) {
  if (!d) return "";
  return Object.entries(d)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm text-brand-navy focus:border-brand-teal-dark focus:outline-none";

export default function AuditTab() {
  const [from, setFrom] = useState(() => spDate(-6));
  const [to, setTo] = useState(() => spDate());
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams({ from, to });
      if (action) params.set("action", action);
      if (qDebounced) params.set("q", qDebounced);
      if (before) params.set("before", before);
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/auditoria?${params}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error ?? "Falha ao carregar a auditoria");
          return;
        }
        setError(null);
        setActions(json.actions ?? {});
        setItems((prev) => (before ? [...prev, ...(json.items ?? [])] : json.items ?? []));
        setHasMore(!!json.hasMore);
      } catch {
        setError("Falha ao carregar a auditoria");
      } finally {
        setLoading(false);
      }
    },
    [from, to, action, qDebounced]
  );

  useEffect(() => {
    const t = setTimeout(() => fetchPage(), 0);
    return () => clearTimeout(t);
  }, [fetchPage]);

  function exportCsv() {
    const header = ["Data/hora", "Quem", "Perfil", "Ação", "Paciente", "Detalhes", "IP"];
    const cell = (v: string | null) => {
      const s = v ?? "";
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = items.map((i) =>
      [fmtWhen(i.at), i.actor_name, ACTOR_LABEL[i.actor_type] ?? i.actor_type, actions[i.action] ?? i.action, i.patient_name, fmtDetails(i.details), i.ip]
        .map(cell)
        .join(";")
    );
    const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${from}_a_${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-brand-navy">Auditoria</h2>
        <p className="text-sm text-zinc-500">
          Quem abriu ou alterou dados de pacientes, consultas, documentos, cadastros e financeiro — com data, hora e IP (LGPD).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-4">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          De
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Até
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Ação
          <select value={action} onChange={(e) => setAction(e.target.value)} className={`mt-1 ${inputCls}`}>
            <option value="">Todas</option>
            {Object.entries(actions).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Quem ou paciente
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 nome" className={`mt-1 ${inputCls}`} />
        </label>
        <div className="col-span-2 flex justify-end sm:col-span-4">
          <button
            type="button"
            disabled={!items.length}
            onClick={exportCsv}
            className="rounded-md bg-brand-teal px-3 py-2 text-xs font-bold text-brand-navy hover:opacity-90 disabled:opacity-40"
          >
            ⬇ Exportar planilha
          </button>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2 font-semibold">Quando</th>
              <th className="px-3 py-2 font-semibold">Quem</th>
              <th className="px-3 py-2 font-semibold">Ação</th>
              <th className="px-3 py-2 font-semibold">Paciente</th>
              <th className="px-3 py-2 font-semibold">Detalhes</th>
              <th className="px-3 py-2 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-zinc-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-600">{fmtWhen(i.at)}</td>
                <td className="px-3 py-2">
                  <p className="text-brand-navy">{i.actor_name}</p>
                  <p className="text-[11px] text-zinc-400">{ACTOR_LABEL[i.actor_type] ?? i.actor_type}</p>
                </td>
                <td className={`px-3 py-2 ${i.action.startsWith("login_falhou") || i.action === "login_bloqueado" || i.action.startsWith("excluir") ? "text-red-700" : "text-brand-navy"}`}>
                  {actions[i.action] ?? i.action}
                </td>
                <td className="px-3 py-2 text-brand-navy">{i.patient_name ?? "—"}</td>
                <td className="max-w-xs px-3 py-2 text-xs text-zinc-500">{fmtDetails(i.details)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-zinc-400">{i.ip ?? "—"}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-zinc-400">
                  Nenhum registro com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex justify-center border-t border-zinc-100 p-3">
          {loading ? (
            <span className="text-xs text-zinc-400">Carregando...</span>
          ) : hasMore ? (
            <button
              type="button"
              onClick={() => fetchPage(items[items.length - 1]?.at)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-zinc-50"
            >
              Carregar mais
            </button>
          ) : (
            items.length > 0 && <span className="text-xs text-zinc-400">Fim dos registros do período.</span>
          )}
        </div>
      </div>
    </div>
  );
}
