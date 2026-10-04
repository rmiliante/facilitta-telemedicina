"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fmtDateTime,
  fmtDay,
  fmtMoney,
  Kpi,
  METHOD_LABEL,
  monthLabel,
  StatusBadge,
  todayKey,
  PayoutAppointments,
  CopyButton,
  type PaymentMethod,
  type Payout,
} from "./FinanceShared";

/**
 * Admin → Financeiro: repasse aos médicos com fechamento mensal.
 * Escolhe o mês, fecha as consultas concluídas de cada médico, registra
 * o pagamento (data, forma, comprovante) e exporta a planilha do mês.
 */

interface Row {
  doctorId: string;
  name: string;
  active: boolean;
  valorConsulta: number | null;
  pixKey: string | null;
  aberto: { consultas: number; total: number; semValor: number };
  fechamentos: Payout[];
}

interface Overview {
  month: string;
  rows: Row[];
  totals: { aberto: number; aPagar: number; pago: number };
}

function currentMonth() {
  return todayKey().slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function exportCsv(data: Overview) {
  const header = ["Médico", "Fechamento", "Consultas", "Valor (R$)", "Situação", "Pago em", "Forma", "Observação"];
  const cell = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const money = (v: number) => v.toFixed(2).replace(".", ",");
  const lines: string[] = [];
  for (const r of data.rows) {
    r.fechamentos.forEach((p, i) =>
      lines.push(
        [r.name, `${i + 1}º`, p.consultas, money(p.total), p.status === "pago" ? "Pago" : "A pagar", p.paid_at ? fmtDay(p.paid_at) : "",
          p.payment_method ? METHOD_LABEL[p.payment_method] : "", p.notes ?? ""].map(cell).join(";")
      )
    );
    if (r.aberto.consultas > 0) {
      lines.push([r.name, "Em aberto", r.aberto.consultas, money(r.aberto.total), "Não fechado", "", "", ""].map(cell).join(";"));
    }
  }
  // BOM + ";" para o Excel em português abrir com acentos e colunas certas.
  const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `repasse_medicos_${data.month}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** readOnly: nível Gestor — vê tudo, mas não fecha, não paga e não anexa. */
export default function FinanceTab({ readOnly = false }: { readOnly?: boolean }) {
  const [month, setMonth] = useState(() => shiftMonth(currentMonth(), -1));
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [paying, setPaying] = useState<Payout | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/financeiro?month=${month}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Falha ao carregar o financeiro");
        setData(null);
        return;
      }
      setError(null);
      setData(json);
    } catch {
      setError("Falha ao carregar o financeiro");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act(key: string, fn: () => Promise<Response>) {
    setBusy(key);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) alert(json.error ?? "Não foi possível concluir");
      await load();
    } finally {
      setBusy(null);
    }
  }

  function closeMonth(r: Row) {
    if (!confirm(`Fechar ${monthLabel(month)} de ${r.name}: ${r.aberto.consultas} consulta(s), ${fmtMoney(r.aberto.total)}?`)) return;
    act(`close-${r.doctorId}`, () =>
      fetch("/api/admin/financeiro/fechamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: r.doctorId, month }),
      })
    );
  }

  function reopen(p: Payout, name: string) {
    if (!confirm(`Reabrir o fechamento de ${name} (${fmtMoney(p.total)})? As consultas voltam a ficar em aberto.`)) return;
    act(`reopen-${p.id}`, () => fetch(`/api/admin/financeiro/fechamentos/${p.id}`, { method: "DELETE" }));
  }

  function undoPayment(p: Payout) {
    if (!confirm("Desfazer o registro de pagamento? O fechamento volta para \"a pagar\".")) return;
    act(`undo-${p.id}`, () =>
      fetch(`/api/admin/financeiro/fechamentos/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "desfazer_pagamento" }),
      })
    );
  }

  function uploadReceipt(p: Payout, file: File) {
    const form = new FormData();
    form.append("file", file);
    act(`receipt-${p.id}`, () => fetch(`/api/admin/financeiro/fechamentos/${p.id}/comprovante`, { method: "POST", body: form }));
  }

  function uploadInvoice(p: Payout, file: File) {
    const form = new FormData();
    form.append("file", file);
    act(`nf-${p.id}`, () => fetch(`/api/admin/financeiro/fechamentos/${p.id}/nf`, { method: "POST", body: form }));
  }

  async function openFile(p: Payout, kind: "receipt_url" | "invoice_url") {
    // Abre a aba antes do fetch: navegador bloqueia pop-up aberto depois de esperar a rede.
    const win = window.open("", "_blank");
    const res = await fetch(`/api/admin/financeiro/fechamentos/${p.id}`);
    const json = await res.json().catch(() => ({}));
    const url = json.payout?.[kind];
    if (url && win) win.location.href = url;
    else {
      win?.close();
      alert("Não foi possível abrir o arquivo.");
    }
  }

  const t = data?.totals;
  const isFuture = month > currentMonth();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-brand-navy">Financeiro — repasse aos médicos</h2>
        <p className="text-sm text-zinc-500">
          Feche o mês de cada médico (consultas concluídas × valor da época), registre o pagamento e anexe o comprovante.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-brand-navy hover:bg-zinc-50"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-brand-navy"
        />
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-brand-navy hover:bg-zinc-50"
          aria-label="Próximo mês"
        >
          ›
        </button>
        <span className="ml-1 text-sm font-semibold text-brand-navy">{monthLabel(month)}</span>
        <span className="flex-1" />
        <button
          type="button"
          disabled={!data || data.rows.length === 0}
          onClick={() => data && exportCsv(data)}
          className="rounded-md bg-brand-teal px-3 py-2 text-xs font-bold text-brand-navy hover:opacity-90 disabled:opacity-40"
        >
          ⬇ Exportar planilha
        </button>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Em aberto (não fechado)" bar="#8a7fd0" value={t ? fmtMoney(t.aberto) : "—"}>
          Consultas concluídas que ainda não entraram em fechamento
        </Kpi>
        <Kpi label="Fechado a pagar" bar="#f5b301" value={t ? fmtMoney(t.aPagar) : "—"}>
          Fechamentos aguardando pagamento
        </Kpi>
        <Kpi label="Pago" bar="#00e2c3" value={t ? fmtMoney(t.pago) : "—"}>
          Fechamentos deste mês já pagos
        </Kpi>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        {loading && !data ? (
          <p className="p-4 text-sm text-zinc-400">Carregando...</p>
        ) : !data || data.rows.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">Nenhum médico com atendimentos neste mês.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.rows.map((r) => {
              const canClose = r.aberto.consultas > 0 && r.aberto.semValor === 0 && !isFuture;
              return (
                <li key={r.doctorId} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-navy">{r.name}</p>
                      <p className="text-xs text-zinc-500">
                        {r.valorConsulta !== null ? `${fmtMoney(r.valorConsulta)} por consulta (atual)` : (
                          <span className="text-amber-700">{readOnly ? "Sem valor por consulta" : "Sem valor por consulta — cadastre em Médicos"}</span>
                        )}
                      </p>
                      <p className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                        {r.pixKey ? (
                          <>
                            PIX: <span className="font-medium text-brand-navy">{r.pixKey}</span>
                            <CopyButton text={r.pixKey} />
                          </>
                        ) : (
                          <span className="text-amber-700">Sem chave PIX cadastrada</span>
                        )}
                      </p>
                    </div>
                    {readOnly ? (
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Em aberto</p>
                        <p className="text-sm font-semibold text-brand-navy">
                          {r.aberto.consultas} consulta{r.aberto.consultas === 1 ? "" : "s"} · {fmtMoney(r.aberto.total)}
                        </p>
                      </div>
                    ) : r.aberto.consultas === 0 && r.fechamentos.length > 0 ? (
                      <span className="rounded-full bg-brand-teal/15 px-2.5 py-1 text-xs font-semibold text-brand-teal-dark">
                        ✓ Tudo fechado
                      </span>
                    ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Em aberto</p>
                        <p className="text-sm font-semibold text-brand-navy">
                          {r.aberto.consultas} consulta{r.aberto.consultas === 1 ? "" : "s"} · {fmtMoney(r.aberto.total)}
                        </p>
                        {r.aberto.semValor > 0 && (
                          <p className="text-[11px] text-amber-700">{r.aberto.semValor} sem valor cadastrado</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!canClose || busy !== null}
                        onClick={() => closeMonth(r)}
                        title={
                          isFuture
                            ? "Mês ainda não começou"
                            : r.aberto.semValor > 0
                              ? "Cadastre o valor por consulta do médico antes de fechar"
                              : r.aberto.consultas === 0
                                ? "Nada em aberto neste mês"
                                : r.fechamentos.length > 0
                                  ? "Fecha as consultas concluídas depois do último fechamento"
                                  : "Fecha as consultas concluídas do mês"
                        }
                        className="rounded-md bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {busy === `close-${r.doctorId}` ? "Fechando..." : r.fechamentos.length > 0 ? "Fechar complementar" : "Fechar mês"}
                      </button>
                    </div>
                    )}
                  </div>

                  {r.fechamentos.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {r.fechamentos.map((p, i) => (
                        <li key={p.id} className="rounded-lg border border-zinc-200 bg-zinc-50/60">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
                            <span className="text-xs font-semibold text-zinc-500">
                              {r.fechamentos.length > 1 ? `${i + 1}º fechamento` : "Fechamento"}
                            </span>
                            <span className="text-brand-navy">
                              {p.consultas} consulta{p.consultas === 1 ? "" : "s"} · <strong>{fmtMoney(p.total)}</strong>
                            </span>
                            <StatusBadge payout={p} />
                            {p.payment_method && <span className="text-xs text-zinc-500">{METHOD_LABEL[p.payment_method]}</span>}
                            {p.notes && <span className="truncate text-xs text-zinc-500" title={p.notes}>“{p.notes}”</span>}
                            {p.invoice_path ? (
                              <button
                                type="button"
                                onClick={() => openFile(p, "invoice_url")}
                                title={`Enviada por ${p.invoice_uploaded_by ?? "—"}${p.invoice_uploaded_at ? ` em ${fmtDateTime(p.invoice_uploaded_at)}` : ""}`}
                                className="rounded-full bg-brand-teal/15 px-2 py-0.5 text-[11px] font-semibold text-brand-teal-dark hover:bg-brand-teal/25"
                              >
                                🧾 NF recebida
                              </button>
                            ) : readOnly ? (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">🧾 NF pendente</span>
                            ) : (
                              <label className="cursor-pointer rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-200" title="Aguardando o médico enviar a nota fiscal. Clique para anexar você mesmo.">
                                {busy === `nf-${p.id}` ? "Enviando NF..." : "🧾 NF pendente"}
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  className="hidden"
                                  disabled={busy !== null}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) uploadInvoice(p, f);
                                  }}
                                />
                              </label>
                            )}
                            <span className="flex-1" />
                            <button
                              type="button"
                              onClick={() => setOpenDetail(openDetail === p.id ? null : p.id)}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-white"
                            >
                              {openDetail === p.id ? "Ocultar consultas" : "Ver consultas"}
                            </button>
                            {p.receipt_path ? (
                              <button
                                type="button"
                                onClick={() => openFile(p, "receipt_url")}
                                className="rounded-md px-2 py-1 text-xs font-semibold text-brand-teal-dark hover:bg-white"
                              >
                                📎 Comprovante
                              </button>
                            ) : null}
                            {!readOnly && (
                            <label className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-brand-teal-dark hover:bg-white">
                              {busy === `receipt-${p.id}` ? "Enviando..." : p.receipt_path ? "Trocar" : "Anexar comprovante"}
                              <input
                                type="file"
                                accept="application/pdf,image/*"
                                className="hidden"
                                disabled={busy !== null}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.target.value = "";
                                  if (f) uploadReceipt(p, f);
                                }}
                              />
                            </label>
                            )}
                            {readOnly ? null : p.status === "a_pagar" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => setPaying(p)}
                                  className="rounded-md bg-brand-teal px-2.5 py-1 text-xs font-bold text-brand-navy disabled:opacity-40"
                                >
                                  Registrar pagamento
                                </button>
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => reopen(p, r.name)}
                                  className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-white disabled:opacity-40"
                                >
                                  Reabrir
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => undoPayment(p)}
                                className="rounded-md px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-white disabled:opacity-40"
                              >
                                Desfazer pagamento
                              </button>
                            )}
                          </div>
                          {openDetail === p.id && (
                            <div className="border-t border-zinc-200 bg-white">
                              <PayoutAppointments endpoint={`/api/admin/financeiro/fechamentos/${p.id}`} />
                              <p className="px-3 py-1.5 text-[11px] text-zinc-400">
                                Fechado por {p.closed_by ?? "—"} em {fmtDateTime(p.created_at)}
                                {p.paid_by ? ` · pagamento registrado por ${p.paid_by}` : ""}
                              </p>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        O fechamento congela as consultas e o valor de cada uma. Consultas concluídas depois ficam em aberto e entram num
        fechamento complementar. Só dá para reabrir um fechamento que ainda não foi pago.
      </p>

      {paying && (
        <PaymentDialog
          payout={paying}
          doctorName={data?.rows.find((r) => r.doctorId === paying.doctor_id)?.name ?? ""}
          pixKey={data?.rows.find((r) => r.doctorId === paying.doctor_id)?.pixKey ?? null}
          onClose={() => setPaying(null)}
          onSaved={async () => {
            setPaying(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function PaymentDialog({
  payout,
  doctorName,
  pixKey,
  onClose,
  onSaved,
}: {
  payout: Payout;
  doctorName: string;
  pixKey: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paidAt, setPaidAt] = useState(todayKey());
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/financeiro/fechamentos/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pagar", paidAt, method, notes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Falha ao registrar o pagamento");
        return;
      }
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const up = await fetch(`/api/admin/financeiro/fechamentos/${payout.id}/comprovante`, { method: "POST", body: form });
        if (!up.ok) {
          const upJson = await up.json().catch(() => ({}));
          alert(`Pagamento registrado, mas o comprovante não foi enviado: ${upJson.error ?? "erro"}. Anexe de novo pela lista.`);
        }
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl"
      >
        <div>
          <h3 className="text-base font-bold text-brand-navy">Registrar pagamento</h3>
          <p className="text-sm text-zinc-500">
            {doctorName} · {monthLabel(payout.period)} · <strong className="text-brand-navy">{fmtMoney(payout.total)}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-zinc-50 px-3 py-2 text-xs">
          {pixKey ? (
            <>
              <span className="text-zinc-500">Chave PIX:</span>
              <span className="font-semibold text-brand-navy">{pixKey}</span>
              <CopyButton text={pixKey} />
            </>
          ) : (
            <span className="text-amber-700">O médico ainda não cadastrou a chave PIX.</span>
          )}
          <span className="w-full text-zinc-500">
            {payout.invoice_path ? "🧾 Nota fiscal recebida." : "🧾 Nota fiscal ainda não enviada pelo médico."}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-zinc-600">Data do pagamento</span>
            <input type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={input} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-zinc-600">Forma</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={input}>
              {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Observação (opcional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="ex: ID da transação" className={input} />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Comprovante (opcional, PDF ou imagem até 4 MB)</span>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        </label>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600">
            Cancelar
          </button>
          <button disabled={saving} className="rounded-md bg-brand-navy px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Salvando..." : "Confirmar pagamento"}
          </button>
        </div>
      </form>
    </div>
  );
}
