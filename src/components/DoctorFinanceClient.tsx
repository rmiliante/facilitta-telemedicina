"use client";

import { useEffect, useState } from "react";
import {
  fmtDay,
  fmtMoney,
  Kpi,
  METHOD_LABEL,
  monthLabel,
  PayoutAppointments,
  StatusBadge,
  type Payout,
} from "./FinanceShared";

interface Statement {
  payouts: Payout[];
  emAberto: { month: string; consultas: number; total: number }[];
  totals: { aReceber: number; emAberto: number; recebidoNoAno: number };
}

/**
 * Médico → Financeiro: extrato do repasse. O que já foi fechado e está a
 * receber, o que ainda vai entrar no próximo fechamento e o que já foi
 * pago (com data, forma e comprovante).
 */
export default function DoctorFinanceClient() {
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/doctor/financeiro")
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(json.error ?? "Falha ao carregar o financeiro");
        else setData(json);
      })
      .catch(() => !cancelled && setError("Falha ao carregar o financeiro"));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function uploadInvoice(p: Payout, file: File) {
    setUploading(p.id);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/doctor/financeiro/${p.id}/nf`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) alert(json.error ?? "Não foi possível enviar a nota fiscal");
      setReload((n) => n + 1);
    } finally {
      setUploading(null);
    }
  }

  const year = new Date().getFullYear();
  const t = data?.totals;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-brand-navy">Financeiro</h2>
        <p className="text-sm text-zinc-500">
          Seu repasse: o que está a receber, o que ainda vai ser fechado e o que já foi pago. Anexe a nota fiscal de cada
          fechamento e mantenha a chave PIX atualizada em Meu cadastro.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="A receber" bar="#f5b301" value={t ? fmtMoney(t.aReceber) : "—"}>
          Já fechado, aguardando pagamento
        </Kpi>
        <Kpi label="Em aberto" bar="#8a7fd0" value={t ? fmtMoney(t.emAberto) : "—"}>
          Consultas concluídas que entram no próximo fechamento
        </Kpi>
        <Kpi label={`Recebido em ${year}`} bar="#00e2c3" value={t ? fmtMoney(t.recebidoNoAno) : "—"}>
          Pagamentos já feitos neste ano
        </Kpi>
      </div>

      {data && data.emAberto.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="mb-2 text-sm font-bold text-brand-navy">Em aberto (ainda não fechado)</p>
          <ul className="divide-y divide-zinc-100 text-sm">
            {data.emAberto.map((m) => (
              <li key={m.month} className="flex items-center justify-between py-1.5">
                <span className="text-zinc-600">{monthLabel(m.month)}</span>
                <span className="text-brand-navy">
                  {m.consultas} consulta{m.consultas === 1 ? "" : "s"} · <strong>{fmtMoney(m.total)}</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <p className="border-b border-zinc-100 px-4 py-3 text-sm font-bold text-brand-navy">Fechamentos</p>
        {!data && !error ? (
          <p className="p-4 text-sm text-zinc-400">Carregando...</p>
        ) : data && data.payouts.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">Nenhum fechamento ainda. Eles aparecem aqui quando a administração fecha o mês.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data?.payouts.map((p) => (
              <li key={p.id}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
                  <span className="min-w-[9rem] font-semibold text-brand-navy">{monthLabel(p.period)}</span>
                  <span className="text-zinc-600">
                    {p.consultas} consulta{p.consultas === 1 ? "" : "s"}
                  </span>
                  <strong className="text-brand-navy">{fmtMoney(p.total)}</strong>
                  <StatusBadge payout={p} />
                  {p.payment_method && <span className="text-xs text-zinc-500">{METHOD_LABEL[p.payment_method]}</span>}
                  <span className="flex-1" />
                  {p.invoice_url ? (
                    <a
                      href={p.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-brand-teal/15 px-2 py-0.5 text-[11px] font-semibold text-brand-teal-dark"
                    >
                      🧾 NF enviada
                    </a>
                  ) : null}
                  <label
                    className={`cursor-pointer rounded-md px-2 py-1 text-xs font-semibold ${
                      p.invoice_path ? "text-zinc-500 hover:bg-zinc-50" : "bg-brand-navy text-white hover:opacity-90"
                    }`}
                  >
                    {uploading === p.id ? "Enviando..." : p.invoice_path ? "Trocar NF" : "Anexar NF"}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      disabled={uploading !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadInvoice(p, f);
                      }}
                    />
                  </label>
                  {p.receipt_url && (
                    <a
                      href={p.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md px-2 py-1 text-xs font-semibold text-brand-teal-dark hover:bg-zinc-50"
                    >
                      📎 Comprovante
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === p.id ? null : p.id)}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-zinc-50"
                  >
                    {openId === p.id ? "Ocultar consultas" : "Ver consultas"}
                  </button>
                </div>
                {openId === p.id && (
                  <div className="border-t border-zinc-100 bg-zinc-50/50">
                    <PayoutAppointments endpoint={`/api/doctor/financeiro/${p.id}`} />
                    {p.notes && <p className="px-3 py-1.5 text-[11px] text-zinc-500">Observação: {p.notes}</p>}
                    {p.status === "pago" && (
                      <p className="px-3 py-1.5 text-[11px] text-zinc-400">Pago em {fmtDay(p.paid_at)}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
