"use client";

import { useEffect, useState } from "react";

/** Peças comuns do financeiro (admin e médico). */

export type PaymentMethod = "pix" | "ted" | "dinheiro" | "outro";

export interface Payout {
  id: string;
  doctor_id: string;
  period: string;
  consultas: number;
  total: number;
  status: "a_pagar" | "pago";
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
  closed_by: string | null;
  paid_by: string | null;
  created_at: string;
  receipt_url?: string | null;
  doctors?: { name: string } | null;
}

export interface PayoutAppointment {
  id: string;
  scheduled_at: string;
  finished_at: string | null;
  valor: number | null;
  patient: string | null;
  specialty: string | null;
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  ted: "TED / transferência",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

const TZ = "America/Sao_Paulo";

export function fmtMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-09" ou "2026-09-01" → "setembro de 2026". */
export function monthLabel(monthOrPeriod: string) {
  const [y, m] = monthOrPeriod.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "2026-10-05" → "05/10/2026" (sem mexer com fuso). */
export function fmtDay(day: string | null) {
  if (!day) return "—";
  const [y, m, d] = day.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function Kpi({ label, bar, value, children }: { label: string; bar: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="@container relative min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 pl-5">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: bar }} />
      <p className="text-[11px] font-semibold uppercase leading-snug tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 whitespace-nowrap text-xl font-extrabold text-brand-navy @[13rem]:text-2xl @[16rem]:text-3xl">{value}</p>
      {children && <p className="mt-0.5 text-xs text-zinc-500">{children}</p>}
    </div>
  );
}

export function StatusBadge({ payout }: { payout: Pick<Payout, "status" | "paid_at"> }) {
  return payout.status === "pago" ? (
    <span className="whitespace-nowrap rounded-full bg-brand-teal/15 px-2 py-0.5 text-[11px] font-semibold text-brand-teal-dark">
      Pago em {fmtDay(payout.paid_at)}
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">A pagar</span>
  );
}

/** Lista das consultas de um fechamento (carrega ao abrir). */
export function PayoutAppointments({ endpoint }: { endpoint: string }) {
  const [items, setItems] = useState<PayoutAppointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Falha ao carregar as consultas");
        else setItems(data.appointments ?? []);
      })
      .catch(() => !cancelled && setError("Falha ao carregar as consultas"));
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (error) return <p className="px-3 py-2 text-xs text-red-600">{error}</p>;
  if (!items) return <p className="px-3 py-2 text-xs text-zinc-400">Carregando consultas...</p>;
  if (items.length === 0) return <p className="px-3 py-2 text-xs text-zinc-400">Nenhuma consulta neste fechamento.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400">
            <th className="px-3 py-1.5 font-semibold">Data</th>
            <th className="px-3 py-1.5 font-semibold">Paciente</th>
            <th className="px-3 py-1.5 font-semibold">Especialidade</th>
            <th className="px-3 py-1.5 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-zinc-100">
              <td className="px-3 py-1.5 tabular-nums">{fmtDateTime(a.scheduled_at)}</td>
              <td className="px-3 py-1.5 text-brand-navy">{a.patient ?? "—"}</td>
              <td className="px-3 py-1.5 text-zinc-500">{a.specialty ?? "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{a.valor !== null ? fmtMoney(a.valor) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
