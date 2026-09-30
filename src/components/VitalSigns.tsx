"use client";

import { useCallback, useEffect, useState } from "react";
import {
  VITAL_FIELDS,
  formatMeasuredAt,
  formatMeasuredDay,
  isAlert,
  nowLocalInput,
  recordedByLabel,
  vitalDelta,
  withUnit,
  type VitalKey,
  type VitalSign,
} from "@/lib/vitals";

type Values = Record<VitalKey, string>;
const EMPTY: Values = { spo2: "", bpm: "", pa: "", peso: "", hgt: "" };

/** Carrega, grava e remove aferições num endpoint (atendente/admin ou médico). */
export function useVitalSigns(endpoint: string) {
  const [items, setItems] = useState<VitalSign[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setItems(data.items ?? []);
        setWarning(data.warning ?? null);
      } else {
        setWarning(data.error ?? "Falha ao carregar aferições");
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(values: Values, measuredAt: string, appointmentId?: string) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, measuredAt, appointmentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Falha ao salvar aferição");
    setItems((prev) =>
      [data.item as VitalSign, ...prev].sort((a, b) => b.measured_at.localeCompare(a.measured_at)),
    );
  }

  async function remove(item: VitalSign) {
    const res = await fetch(`${endpoint}?vitalId=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Falha ao remover aferição");
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  return { items, loading, warning, add, remove, reload: load };
}

/** Formulário de nova aferição (data/hora + 5 campos). */
export function VitalForm({
  onSave,
  footer,
  onCancel,
  compact = false,
}: {
  onSave: (values: Values, measuredAt: string) => Promise<void>;
  footer?: React.ReactNode;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [measuredAt, setMeasuredAt] = useState(nowLocalInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = Object.values(values).some((v) => v.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!filled) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(values, measuredAt);
      setValues(EMPTY);
      setMeasuredAt(nowLocalInput());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar aferição");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-brand-teal/60 bg-brand-teal/5 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-brand-navy">Nova aferição</p>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          Data e hora
          <input
            type="datetime-local"
            value={measuredAt}
            max={nowLocalInput()}
            onChange={(e) => setMeasuredAt(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] text-zinc-700 outline-none focus:border-brand-teal-dark"
          />
        </label>
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-5"}`}>
        {VITAL_FIELDS.map((f) => (
          <label key={f.key} className="text-[10px] font-medium text-zinc-500">
            {f.label}
            <input
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              inputMode={f.key === "pa" ? "text" : "decimal"}
              className="mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-800 outline-none focus:border-brand-teal-dark"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 text-[10px] text-zinc-500">{footer}</div>
        <div className="flex shrink-0 gap-1.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          )}
          <button
            disabled={!filled || saving}
            className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar aferição"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Tabela com todas as aferições, uma linha por data/hora. */
export function VitalHistoryTable({
  items,
  onRemove,
  highlightFirst = true,
}: {
  items: VitalSign[];
  onRemove?: (item: VitalSign) => void;
  highlightFirst?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-zinc-400">Nenhuma aferição registrada ainda.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400">
            <th className="py-1 pr-2 font-semibold">Data</th>
            {VITAL_FIELDS.map((f) => (
              <th key={f.key} className="pr-2 font-semibold">
                {f.short}
              </th>
            ))}
            <th className="pr-2 font-semibold">Registrado por</th>
            {onRemove && <th />}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-zinc-700">
          {items.map((v, i) => (
            <tr key={v.id} className={i === 0 && highlightFirst ? "bg-brand-teal/5" : ""}>
              <td className={`whitespace-nowrap py-1.5 pr-2 ${i === 0 && highlightFirst ? "font-semibold" : ""}`}>
                {formatMeasuredAt(v.measured_at)}
              </td>
              {VITAL_FIELDS.map((f) => (
                <td
                  key={f.key}
                  className={`whitespace-nowrap pr-2 ${
                    !v[f.key] ? "text-zinc-300" : isAlert(f.key, v[f.key]) ? "font-semibold text-amber-600" : ""
                  }`}
                >
                  {v[f.key] || "—"}
                </td>
              ))}
              <td className="whitespace-nowrap pr-2 text-zinc-500">{recordedByLabel(v)}</td>
              {onRemove && (
                <td className="text-right">
                  {!v.id.startsWith("appt-") && (
                    <button
                      onClick={() => onRemove(v)}
                      title="Remover aferição lançada por engano"
                      className="rounded px-1 text-zinc-300 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Versão compacta (uma linha por aferição) para colunas estreitas. */
export function VitalHistoryList({ items }: { items: VitalSign[] }) {
  if (items.length === 0) return <p className="text-xs text-zinc-400">Nenhuma aferição registrada ainda.</p>;
  return (
    <ul className="space-y-1.5 text-[11px] text-zinc-600">
      {items.map((v) => (
        <li key={v.id}>
          <b className="text-zinc-800">{formatMeasuredAt(v.measured_at)}</b>
          {VITAL_FIELDS.filter((f) => v[f.key]).map((f) => (
            <span key={f.key} className={isAlert(f.key, v[f.key]) ? "font-semibold text-amber-600" : ""}>
              {" · "}
              {f.key === "peso" ? withUnit("peso", v.peso) : `${f.short} ${v[f.key]}`}
            </span>
          ))}
          <span className="text-zinc-400"> — {recordedByLabel(v)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Painel da atendente / admin no cadastro do paciente: nova aferição em
 * cima e o histórico completo embaixo.
 */
export default function VitalSignsPanel({
  patientId,
  appointmentId,
  appointmentLabel,
  onCountChange,
}: {
  patientId: string;
  appointmentId?: string;
  appointmentLabel?: string;
  onCountChange?: (n: number) => void;
}) {
  const { items, loading, warning, add, remove } = useVitalSigns(`/api/admin/patients/${patientId}/vitals`);

  useEffect(() => {
    if (!loading) onCountChange?.(items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, loading]);

  async function handleRemove(item: VitalSign) {
    if (!confirm(`Remover a aferição de ${formatMeasuredAt(item.measured_at)}?`)) return;
    try {
      await remove(item);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao remover");
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
      {warning && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{warning}</p>
      )}
      <VitalForm
        onSave={(values, measuredAt) => add(values, measuredAt, appointmentId)}
        footer={
          appointmentLabel
            ? `Vinculada à consulta: ${appointmentLabel}`
            : "Se o paciente tiver consulta no mesmo dia, a aferição fica vinculada a ela."
        }
      />
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Histórico de aferições{items.length > 0 ? ` (${items.length})` : ""}
        </p>
        {loading ? (
          <p className="text-xs text-zinc-400">Carregando...</p>
        ) : (
          <VitalHistoryTable items={items} onRemove={handleRemove} />
        )}
      </div>
    </div>
  );
}

/**
 * Card do médico: aferição atual × anterior, com a variação, e o
 * histórico completo ao clicar.
 */
export function VitalsCompare({ endpoint }: { endpoint: string }) {
  const { items, loading, warning, add } = useVitalSigns(endpoint);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const current = items[0];
  const previous = items[1];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Sinais vitais</p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] font-semibold text-brand-teal-dark hover:underline"
          >
            + Nova aferição
          </button>
        )}
      </div>

      {warning && (
        <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-800">
          {warning}
        </p>
      )}

      {adding && (
        <div className="mb-3">
          <VitalForm
            compact
            onSave={async (values, measuredAt) => {
              await add(values, measuredAt);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-xs text-zinc-400">Carregando...</p>
      ) : !current ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-center text-xs text-zinc-400">
          Nenhuma aferição registrada. A atendente registra no cadastro do paciente, ou use “+ Nova aferição”.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[64px_1fr_1fr] gap-x-2 px-2.5 pb-1 text-[10px] uppercase text-zinc-400">
            <span />
            <span>Atual · {formatMeasuredAt(current.measured_at, false)}</span>
            <span>{previous ? `Anterior · ${formatMeasuredDay(previous.measured_at)}` : "Anterior"}</span>
          </div>
          <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
            {VITAL_FIELDS.map((f) => {
              const cur = current[f.key];
              const prev = previous?.[f.key] ?? null;
              const alert = isAlert(f.key, cur);
              const delta = vitalDelta(f.key, cur, prev);
              return (
                <div
                  key={f.key}
                  className={`grid grid-cols-[64px_1fr_1fr] items-center gap-x-2 px-2.5 py-1.5 text-sm ${
                    alert ? "bg-amber-50" : ""
                  }`}
                >
                  <span className="text-[11px] text-zinc-500">{f.short}</span>
                  <span className={cur ? `font-semibold ${alert ? "text-amber-700" : "text-zinc-800"}` : "text-zinc-300"}>
                    {withUnit(f.key, cur)}
                    {delta && delta !== "=" && (
                      <span className={`ml-1 text-[10px] font-medium ${alert ? "" : "text-zinc-400"}`}>{delta}</span>
                    )}
                  </span>
                  <span className={prev ? "text-zinc-500" : "text-zinc-300"}>{withUnit(f.key, prev)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-400">
            Aferido por {recordedByLabel(current)}
            {items.length > 1 && (
              <>
                {" · "}
                <button
                  onClick={() => setShowAll((s) => !s)}
                  className="font-semibold text-brand-teal-dark hover:underline"
                >
                  {showAll ? "Ocultar aferições" : `Ver todas as aferições (${items.length}) ›`}
                </button>
              </>
            )}
          </p>
          {showAll && (
            <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2.5">
              <VitalHistoryList items={items} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
