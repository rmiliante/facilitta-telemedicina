"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Receita digital na tela de consulta: o médico monta a receita / pedido
 * de exame / atestado aqui mesmo, autoriza a assinatura no app VIDaaS
 * (uma vez vale até 8h) e o PDF assinado vai direto pro cadastro do
 * paciente, marcado pra atendente imprimir. Nada é enviado ao paciente.
 */

type Kind = "receita" | "exame" | "atestado";

interface Item {
  name: string;
  quantity: string;
  instructions: string;
}

export interface IssuedDocument {
  path: string;
  name: string;
  uploaded_at: string;
  url: string | null;
  kind?: Kind;
  signed?: boolean;
}

interface SigningState {
  ready: boolean;
  missing: string[];
  status: "none" | "awaiting_approval" | "active" | "expired";
  expiresAt: string | null;
  message?: string;
  error?: string;
}

const KIND_LABELS: Record<Kind, string> = {
  receita: "Receita",
  exame: "Pedido de exame",
  atestado: "Atestado",
};

const EMPTY_ITEM: Item = { name: "", quantity: "", instructions: "" };
const POLL_MS = 3000;
const APPROVAL_TIMEOUT_MS = 3 * 60 * 1000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function PrescriptionPanel({
  appointmentId,
  patientName,
  onIssued,
}: {
  appointmentId: string;
  patientName: string;
  onIssued: (doc: IssuedDocument) => void;
}) {
  const [signing, setSigning] = useState<SigningState | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("receita");
  const [items, setItems] = useState<Item[]>([{ ...EMPTY_ITEM }]);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"edit" | "authorizing" | "emitting">("edit");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedDocument[]>([]);
  const cancelledRef = useRef(false);

  async function loadSigning(): Promise<SigningState | null> {
    const res = await fetch("/api/doctor/signing-session").catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok) {
      setSigning(null);
      if (data?.error) setError(data.error);
      return null;
    }
    setSigning(data);
    return data;
  }

  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/doctor/signing-session")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setSigning(data))
        .catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function openModal(k: Kind) {
    setKind(k);
    setItems([{ ...EMPTY_ITEM }]);
    setNotes("");
    setError(null);
    setPhase("edit");
    setOpen(true);
  }

  function closeModal() {
    cancelledRef.current = true;
    setOpen(false);
    setPhase("edit");
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  /** Garante sessão de assinatura ativa: dispara o push no VIDaaS e espera a aprovação. */
  async function ensureAuthorized(): Promise<boolean> {
    const current = await loadSigning();
    if (current?.status === "active") return true;

    setPhase("authorizing");
    let state = current;
    if (!state || state.status !== "awaiting_approval") {
      const res = await fetch("/api/doctor/signing-session", { method: "POST" }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) {
        setError(data.error ?? "Não foi possível pedir a autorização no VIDaaS.");
        setPhase("edit");
        return false;
      }
      state = data as SigningState;
      setSigning(state);
      if (state.status === "active") return true;
    }

    const started = Date.now();
    while (!cancelledRef.current && Date.now() - started < APPROVAL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const s = await loadSigning();
      if (s?.status === "active") return true;
      if (!s || s.status === "expired" || s.status === "none") {
        setError(s?.message ?? "A autorização não foi aprovada a tempo. Tente de novo.");
        setPhase("edit");
        return false;
      }
    }
    if (!cancelledRef.current) setError("A autorização não foi aprovada a tempo. Tente de novo.");
    setPhase("edit");
    return false;
  }

  async function handleEmit() {
    setError(null);
    cancelledRef.current = false;

    const cleanItems = items.filter((it) => it.name.trim());
    if (kind === "atestado" ? !notes.trim() : cleanItems.length === 0) {
      setError(
        kind === "atestado"
          ? "Escreva o texto do atestado."
          : kind === "receita"
            ? "Inclua pelo menos um medicamento."
            : "Inclua pelo menos um exame."
      );
      return;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!(await ensureAuthorized())) return;
      if (cancelledRef.current) return;

      setPhase("emitting");
      const res = await fetch(`/api/doctor/appointments/${appointmentId}/prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, items: kind === "atestado" ? [] : cleanItems, notes }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};

      if (res?.ok) {
        const doc = data.document as IssuedDocument;
        setIssued((prev) => [...prev, doc]);
        onIssued(doc);
        setOpen(false);
        setPhase("edit");
        return;
      }
      if (res?.status === 409 && data.needsSession && attempt === 0) {
        setSigning((s) => (s ? { ...s, status: "none" } : s));
        continue; // pede nova autorização e tenta de novo
      }
      setError(data.error ?? "Falha ao emitir. Verifique a conexão e tente de novo.");
      setPhase("edit");
      return;
    }
  }

  const statusLine =
    signing?.status === "active" && signing.expiresAt
      ? `VIDaaS autorizado até ${formatTime(signing.expiresAt)}`
      : signing && !signing.ready
        ? `Falta no cadastro: ${signing.missing.join(", ")}`
        : "Assinatura pelo VIDaaS no celular";

  return (
    <div className="border-t border-zinc-200 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-brand-navy">Receita digital</span>
        <span
          className={`text-[10px] font-medium ${
            signing?.status === "active"
              ? "text-brand-teal-dark"
              : signing && !signing.ready
                ? "text-amber-700"
                : "text-zinc-500"
          }`}
        >
          {statusLine}
        </span>
      </div>
      <button
        type="button"
        onClick={() => openModal("receita")}
        className="w-full rounded-md bg-brand-navy px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Prescrever
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => openModal("atestado")}
          className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-brand-navy hover:bg-zinc-50"
        >
          Atestado
        </button>
        <button
          type="button"
          onClick={() => openModal("exame")}
          className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-brand-navy hover:bg-zinc-50"
        >
          Pedido de exame
        </button>
      </div>

      {issued.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {issued.map((d) => (
            <li
              key={d.path}
              className="flex items-center justify-between gap-2 rounded-md bg-brand-teal/10 px-2.5 py-1.5 text-[11px]"
            >
              <span className="truncate text-brand-navy">
                <strong>{KIND_LABELS[d.kind ?? "receita"]}</strong> emitido às {formatTime(d.uploaded_at)} · salvo
                no cadastro pra atendente imprimir
              </span>
              {d.url && (
                <a href={d.url} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-brand-teal-dark underline">
                  Ver PDF
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/55 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
              <div>
                <p className="text-base font-semibold text-brand-navy">Novo documento</p>
                <p className="text-[11px] text-zinc-500">
                  {patientName} · assinado com seu certificado ICP-Brasil (VIDaaS) · vai pro cadastro da paciente
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fechar"
                className="h-10 w-10 rounded-md bg-zinc-100 text-lg text-brand-navy hover:bg-zinc-200"
              >
                ×
              </button>
            </div>

            {phase === "authorizing" ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand-teal/30 border-t-brand-teal-dark" />
                <p className="text-lg font-semibold text-brand-navy">Confirme a assinatura no seu celular</p>
                <p className="max-w-md text-sm text-zinc-600">
                  Enviamos um pedido para o app <strong>VIDaaS</strong>. Toque em Autorizar. Essa autorização vale
                  por até 8 horas: nas próximas receitas de hoje não vai precisar de novo.
                </p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-2 rounded-md border border-zinc-300 px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-1 border-b border-zinc-100 px-5 pt-3">
                  {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setKind(k);
                        setError(null);
                      }}
                      disabled={phase === "emitting"}
                      className={`rounded-t-md px-3 py-2 text-xs font-medium ${
                        kind === k ? "bg-brand-navy text-white" : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {KIND_LABELS[k]}
                    </button>
                  ))}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {kind === "atestado" ? (
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-zinc-600">Texto do atestado</span>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={8}
                        placeholder="Atesto, para os devidos fins, que o(a) paciente esteve em consulta nesta data e necessita de ___ dias de afastamento a partir de __/__/____."
                        className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-brand-teal-dark"
                      />
                    </label>
                  ) : (
                    <>
                      {items.map((it, i) => (
                        <div key={i} className="rounded-lg border border-zinc-200 p-3">
                          <div className="flex gap-2">
                            <label className="flex-1 text-xs">
                              <span className="mb-1 block font-medium text-zinc-600">
                                {kind === "receita" ? `Medicamento ${i + 1}` : `Exame ${i + 1}`}
                              </span>
                              <input
                                value={it.name}
                                onChange={(e) => updateItem(i, { name: e.target.value })}
                                placeholder={kind === "receita" ? "Ex: Losartana potássica 50 mg" : "Ex: Hemograma completo"}
                                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                              />
                            </label>
                            {kind === "receita" && (
                              <label className="w-40 text-xs">
                                <span className="mb-1 block font-medium text-zinc-600">Quantidade</span>
                                <input
                                  value={it.quantity}
                                  onChange={(e) => updateItem(i, { quantity: e.target.value })}
                                  placeholder="30 comprimidos"
                                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                                />
                              </label>
                            )}
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                                className="mt-5 h-8 shrink-0 rounded-md px-2 text-[11px] text-red-600 hover:bg-red-50"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          <label className="mt-2 block text-xs">
                            <span className="mb-1 block font-medium text-zinc-600">
                              {kind === "receita" ? "Posologia" : "Observação (opcional)"}
                            </span>
                            <input
                              value={it.instructions}
                              onChange={(e) => updateItem(i, { instructions: e.target.value })}
                              placeholder={kind === "receita" ? "Uso oral. Tomar 1 comprimido pela manhã." : "Ex: jejum de 8 horas"}
                              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                            />
                          </label>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                        className="rounded-md bg-brand-teal/15 px-3 py-1.5 text-xs font-medium text-brand-teal-dark hover:bg-brand-teal/25"
                      >
                        + Adicionar {kind === "receita" ? "medicamento" : "exame"}
                      </button>
                      <label className="block text-xs">
                        <span className="mb-1 block font-medium text-zinc-600">Observações (opcional)</span>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-brand-teal-dark"
                        />
                      </label>
                    </>
                  )}
                  {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3">
                  <span className="text-[11px] text-zinc-500">
                    Não é enviado nada à paciente — a atendente imprime pelo cadastro.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-brand-navy hover:bg-zinc-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleEmit}
                      disabled={phase === "emitting" || (signing ? !signing.ready : false)}
                      className="rounded-md bg-brand-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {phase === "emitting" ? "Assinando..." : "Assinar e emitir"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
