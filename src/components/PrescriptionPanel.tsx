"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SIGNING_CHANGED_EVENT } from "@/lib/signingEvents";
import { searchExams, findExam, type ExamHit } from "@/lib/examSearch";
import { EXAM_PACKAGES } from "@/data/exames";

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
  accountEmail?: string;
}

type Credentials = { email: string; password: string };
type CredChoice = Credentials | null | "cancel";
const SIGN_EMAIL_KEY = "facilitta_sign_email";

const KIND_LABELS: Record<Kind, string> = {
  receita: "Receita",
  exame: "Pedido de exame",
  atestado: "Atestado",
};

const EMPTY_ITEM: Item = { name: "", quantity: "", instructions: "" };
const POLL_MS = 3000;
const APPROVAL_TIMEOUT_MS = 3 * 60 * 1000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  // Avisa o selo do topo (tempo restante da assinatura) quando a sessão muda.
  useEffect(() => {
    if (signing) window.dispatchEvent(new Event(SIGNING_CHANGED_EVENT));
  }, [signing?.status, signing?.expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("receita");
  const [items, setItems] = useState<Item[]>([{ ...EMPTY_ITEM }]);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<
    "edit" | "credentials" | "authorizing" | "emitting"
  >("edit");
  const [signEmail, setSignEmail] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [credError, setCredError] = useState<string | null>(null);
  const credResolver = useRef<((choice: CredChoice) => void) | null>(null);
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
    // Renovação feita pelo selo do topo ou por outra tela: recarrega o estado.
    const onChanged = () => {
      fetch("/api/doctor/signing-session")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setSigning(data))
        .catch(() => {});
    };
    window.addEventListener(SIGNING_CHANGED_EVENT, onChanged);
    return () => {
      clearTimeout(t);
      window.removeEventListener(SIGNING_CHANGED_EVENT, onChanged);
    };
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
    credResolver.current?.("cancel");
    credResolver.current = null;
    setOpen(false);
    setPhase("edit");
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  /** Garante sessão de assinatura ativa: dispara o push no VIDaaS e espera a aprovação. */
  async function ensureAuthorized(): Promise<boolean> {
    const current = await loadSigning();
    if (current?.status === "active") return true;

    let state = current;
    if (!state || state.status !== "awaiting_approval") {
      // Passo 1 (tela 7): conta de assinatura (CRM na assinatura) ou só VIDaaS.
      let savedEmail = "";
      try {
        savedEmail = localStorage.getItem(SIGN_EMAIL_KEY) ?? "";
      } catch {
        // sem armazenamento local: usa o e-mail do login
      }
      setSignEmail(savedEmail || current?.accountEmail || "");
      setSignPassword("");
      setCredError(null);

      for (;;) {
        setPhase("credentials");
        const choice = await new Promise<CredChoice>((resolve) => {
          credResolver.current = resolve;
        });
        credResolver.current = null;
        if (choice === "cancel" || cancelledRef.current) {
          setPhase("edit");
          return false;
        }

        setPhase("authorizing");
        const res = await fetch("/api/doctor/signing-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(choice ?? {}),
        }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        setSignPassword("");
        if (!res?.ok) {
          if (choice && res?.status === 401) {
            setCredError(
              data.error ?? "E-mail ou senha da conta de assinatura inválidos.",
            );
            continue; // volta pro passo 1
          }
          setError(
            data.error ?? "Não foi possível pedir a autorização no VIDaaS.",
          );
          setPhase("edit");
          return false;
        }
        if (choice) {
          try {
            localStorage.setItem(SIGN_EMAIL_KEY, choice.email);
          } catch {
            // ignora
          }
        }
        state = data as SigningState;
        setSigning(state);
        if (state.status === "active") return true;
        break;
      }
    } else {
      setPhase("authorizing");
    }

    const started = Date.now();
    while (
      !cancelledRef.current &&
      Date.now() - started < APPROVAL_TIMEOUT_MS
    ) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const s = await loadSigning();
      if (s?.status === "active") return true;
      if (!s || s.status === "expired" || s.status === "none") {
        setError(
          s?.message ??
            "A autorização não foi aprovada a tempo. Tente de novo.",
        );
        setPhase("edit");
        return false;
      }
    }
    if (!cancelledRef.current)
      setError("A autorização não foi aprovada a tempo. Tente de novo.");
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
            : "Inclua pelo menos um exame.",
      );
      return;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!(await ensureAuthorized())) return;
      if (cancelledRef.current) return;

      setPhase("emitting");
      const res = await fetch(
        `/api/doctor/appointments/${appointmentId}/prescription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            items: kind === "atestado" ? [] : cleanItems,
            notes,
          }),
        },
      ).catch(() => null);
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
      setError(
        data.error ?? "Falha ao emitir. Verifique a conexão e tente de novo.",
      );
      setPhase("edit");
      return;
    }
  }

  /** Adiciona os exames do pacote que ainda não estão no pedido (aproveita linhas vazias). */
  function addExamPackage(names: string[]) {
    setItems((prev) => {
      const have = new Set(prev.map((it) => it.name.trim().toLowerCase()));
      const kept = prev.filter(
        (it) => it.name.trim() || it.instructions.trim(),
      );
      const added = names
        .filter((n) => !have.has(n.toLowerCase()))
        .map((n) => ({
          ...EMPTY_ITEM,
          name: n,
          instructions: findExam(n)?.prep ?? "",
        }));
      const next = [...kept, ...added];
      return next.length > 0 ? next : [{ ...EMPTY_ITEM }];
    });
  }

  const statusLine =
    signing?.status === "active" && signing.expiresAt
      ? `Assinatura ativa até ${formatTime(signing.expiresAt)}`
      : signing && !signing.ready
        ? `Falta no cadastro: ${signing.missing.join(", ")}`
        : "Assinatura inativa · aprova no VIDaaS ao emitir";

  const last = issued[issued.length - 1];
  const btn =
    "flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors";

  return (
    <div className="border-b border-zinc-200 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
          Emitir documento
        </span>
        <span
          className={`truncate text-[10px] font-medium ${
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
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => openModal("receita")}
          className={`${btn} bg-brand-navy text-white hover:opacity-90`}
        >
          Receita
        </button>
        <button
          type="button"
          onClick={() => openModal("exame")}
          className={`${btn} border border-zinc-300 text-brand-navy hover:bg-zinc-50`}
        >
          Pedido de exame
        </button>
        <button
          type="button"
          onClick={() => openModal("atestado")}
          className={`${btn} border border-zinc-300 text-brand-navy hover:bg-zinc-50`}
        >
          Atestado
        </button>
      </div>
      {last && (
        <p className="mt-2 flex items-center justify-between gap-2 rounded-md bg-brand-teal/10 px-2.5 py-1.5 text-[11px] text-brand-navy">
          <span className="truncate">
            <strong>{KIND_LABELS[last.kind ?? "receita"]}</strong> emitido às{" "}
            {formatTime(last.uploaded_at)} · foi pra impressão
          </span>
          {last.url && (
            <a
              href={last.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-semibold text-brand-teal-dark underline"
            >
              Ver PDF
            </a>
          )}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/55 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
              <div>
                <p className="text-base font-semibold text-brand-navy">
                  Novo documento
                </p>
                <p className="text-[11px] text-zinc-500">
                  {patientName} · assinado com seu certificado ICP-Brasil
                  (VIDaaS) · vai pro cadastro da paciente
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

            {phase === "credentials" ? (
              <div className="grid gap-0 md:grid-cols-2">
                <form
                  className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-6 md:border-b-0 md:border-r"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!signPassword) return;
                    credResolver.current?.({
                      email: signEmail.trim(),
                      password: signPassword,
                    });
                  }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand-teal-dark">
                    Autorizar assinatura de hoje · vale até 8 horas
                  </p>
                  <p className="text-base font-semibold text-brand-navy">
                    1. Entrar na conta de assinatura
                  </p>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-zinc-600">
                      E-mail da conta
                    </span>
                    <input
                      type="email"
                      value={signEmail}
                      onChange={(e) => setSignEmail(e.target.value)}
                      autoComplete="username"
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand-teal-dark"
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block font-medium text-zinc-600">
                      Senha da conta de assinatura
                    </span>
                    <input
                      type="password"
                      value={signPassword}
                      onChange={(e) => setSignPassword(e.target.value)}
                      autoComplete="current-password"
                      autoFocus
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand-teal-dark"
                    />
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Com a conta, o seu CRM vai gravado dentro da assinatura. A
                    senha não fica guardada no sistema.
                  </p>
                  {credError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      {credError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!signPassword || !signEmail.trim()}
                    className="mt-1 rounded-md bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Continuar
                  </button>
                </form>
                <div className="flex flex-col gap-3 bg-zinc-50 px-6 py-6">
                  <p className="text-base font-semibold text-zinc-600">
                    2. Aprovar no app VIDaaS
                  </p>
                  <p className="text-sm text-zinc-600">
                    Depois do passo 1, chega o pedido no celular. Toque em
                    Autorizar e pronto.
                  </p>
                  <div className="mt-auto rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                    <p className="font-semibold text-brand-navy">
                      Sem conta de assinatura?
                    </p>
                    <p className="mt-1">
                      Dá para seguir só com o VIDaaS: a receita continua com
                      validade legal, só sem o CRM gravado dentro da assinatura.
                      Crie a conta em <strong>Minha assinatura</strong>, no
                      menu.
                    </p>
                    <button
                      type="button"
                      onClick={() => credResolver.current?.(null)}
                      className="mt-2 font-semibold text-brand-teal-dark underline"
                    >
                      Pular e usar só o VIDaaS
                    </button>
                  </div>
                </div>
              </div>
            ) : phase === "authorizing" ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <span className="h-10 w-10 animate-spin rounded-full border-4 border-brand-teal/30 border-t-brand-teal-dark" />
                <p className="text-lg font-semibold text-brand-navy">
                  Confirme a assinatura no seu celular
                </p>
                <p className="max-w-md text-sm text-zinc-600">
                  Enviamos um pedido para o app <strong>VIDaaS</strong>. Toque
                  em Autorizar. Essa autorização vale por até 8 horas: nas
                  próximas receitas de hoje não vai precisar de novo.
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
                        kind === k
                          ? "bg-brand-navy text-white"
                          : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {KIND_LABELS[k]}
                    </button>
                  ))}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {kind === "atestado" ? (
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-zinc-600">
                        Texto do atestado
                      </span>
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
                      {kind === "exame" && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-zinc-500">
                            Pacotes:
                          </span>
                          {EXAM_PACKAGES.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => addExamPackage(p.exams)}
                              className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-[11px] font-medium text-brand-navy hover:border-brand-teal-dark hover:bg-brand-teal/10"
                            >
                              + {p.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {items.map((it, i) => (
                        <div
                          key={i}
                          className={
                            kind === "exame"
                              ? "rounded-lg border border-zinc-200 px-3 py-2"
                              : "rounded-lg border border-zinc-200 p-3"
                          }
                        >
                          <div className="flex gap-2">
                            <label className="flex-1 text-xs">
                              <span
                                className={`mb-1 block font-medium text-zinc-600 ${kind === "exame" && i > 0 ? "sr-only" : ""}`}
                              >
                                {kind === "receita"
                                  ? `Medicamento ${i + 1}`
                                  : "Exame"}
                              </span>
                              {kind === "receita" ? (
                                <MedicationInput
                                  value={it.name}
                                  onChange={(name) => updateItem(i, { name })}
                                />
                              ) : (
                                <ExamInput
                                  value={it.name}
                                  onChange={(name) => updateItem(i, { name })}
                                  onPick={(hit) =>
                                    updateItem(i, {
                                      name: hit.name,
                                      ...(hit.prep && !it.instructions.trim()
                                        ? { instructions: hit.prep }
                                        : {}),
                                    })
                                  }
                                />
                              )}
                            </label>
                            {kind === "receita" && (
                              <label className="w-40 text-xs">
                                <span className="mb-1 block font-medium text-zinc-600">
                                  Quantidade
                                </span>
                                <input
                                  value={it.quantity}
                                  onChange={(e) =>
                                    updateItem(i, { quantity: e.target.value })
                                  }
                                  placeholder="30 comprimidos"
                                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                                />
                              </label>
                            )}
                            {kind === "exame" && (
                              <label className="w-44 shrink-0 text-xs">
                                <span
                                  className={`mb-1 block font-medium text-zinc-600 ${i > 0 ? "sr-only" : ""}`}
                                >
                                  Observação
                                </span>
                                <input
                                  value={it.instructions}
                                  onChange={(e) =>
                                    updateItem(i, {
                                      instructions: e.target.value,
                                    })
                                  }
                                  placeholder="opcional"
                                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                                />
                              </label>
                            )}
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setItems((prev) =>
                                    prev.filter((_, j) => j !== i),
                                  )
                                }
                                className={`${kind === "exame" && i > 0 ? "" : "mt-5"} h-8 shrink-0 self-end rounded-md px-2 text-[11px] text-red-600 hover:bg-red-50`}
                                title="Remover"
                              >
                                Remover
                              </button>
                            )}
                          </div>
                          {kind === "receita" && (
                            <label className="mt-2 block text-xs">
                              <span className="mb-1 block font-medium text-zinc-600">
                                Posologia
                              </span>
                              <input
                                value={it.instructions}
                                onChange={(e) =>
                                  updateItem(i, {
                                    instructions: e.target.value,
                                  })
                                }
                                placeholder="Uso oral. Tomar 1 comprimido pela manhã."
                                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                              />
                            </label>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) => [...prev, { ...EMPTY_ITEM }])
                        }
                        className="rounded-md bg-brand-teal/15 px-3 py-1.5 text-xs font-medium text-brand-teal-dark hover:bg-brand-teal/25"
                      >
                        + Adicionar{" "}
                        {kind === "receita" ? "medicamento" : "exame"}
                      </button>
                      <label className="block text-xs">
                        <span className="mb-1 block font-medium text-zinc-600">
                          Observações (opcional)
                        </span>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-brand-teal-dark"
                        />
                      </label>
                    </>
                  )}
                  {error && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3">
                  <span className="text-[11px] text-zinc-500">
                    Não é enviado nada à paciente — a atendente imprime pelo
                    cadastro.
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
                      disabled={
                        phase === "emitting" ||
                        (signing ? !signing.ready : false)
                      }
                      className="rounded-md bg-brand-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {phase === "emitting"
                        ? "Assinando..."
                        : "Assinar e emitir"}
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

/**
 * Campo de medicamento com sugestões do catálogo CMED/Anvisa enquanto o
 * médico digita. Continua aceitando texto livre (remédio fora da lista).
 */
function MedicationInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const lastPicked = useRef<string | null>(null);
  const listId = useId();

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3 || q === lastPicked.current) {
      const t0 = setTimeout(() => setSuggestions([]), 0);
      return () => clearTimeout(t0);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/doctor/medications?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => {
          setSuggestions(d.results ?? []);
          setActive(-1);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  function pick(name: string) {
    lastPicked.current = name;
    onChange(name);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          lastPicked.current = null;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Digite o nome ou o princípio ativo (ex: dipirona)"
        autoComplete="off"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((sug, idx) => (
            <li key={sug} role="option" aria-selected={idx === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(sug);
                }}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  idx === active ? "bg-brand-teal/15" : "hover:bg-zinc-50"
                }`}
              >
                {sug}
              </button>
            </li>
          ))}
          <li className="border-t border-zinc-100 px-3 py-1.5 text-[10px] text-zinc-400">
            Lista CMED/Anvisa · se não encontrar, digite o nome livremente
          </li>
        </ul>
      )}
    </div>
  );
}

const GROUP_TONE: Record<string, string> = {
  Laboratório: "bg-sky-50 text-sky-700",
  Imagem: "bg-violet-50 text-violet-700",
  Cardiologia: "bg-rose-50 text-rose-700",
  Outros: "bg-zinc-100 text-zinc-600",
};

/** Campo de exame com sugestões na hora (siglas como HMG, EAS, TSH, RX, USG). */
function ExamInput({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (hit: ExamHit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const listId = useId();
  const suggestions =
    value.trim() && value !== picked ? searchExams(value, 8) : [];

  function pick(hit: ExamHit) {
    setPicked(hit.name);
    onPick(hit);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          setPicked(null);
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[active >= 0 ? active : 0]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Digite o nome ou a sigla (ex: hmg, eas, tsh, rx tórax)"
        autoComplete="off"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((sug, idx) => (
            <li key={sug.name} role="option" aria-selected={idx === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(sug);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  idx === active ? "bg-brand-teal/15" : "hover:bg-zinc-50"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{sug.name}</span>
                  {(sug.matched || sug.prep) && (
                    <span className="block truncate text-[10px] text-zinc-500">
                      {sug.matched ? `“${sug.matched}”` : ""}
                      {sug.matched && sug.prep ? " · " : ""}
                      {sug.prep ?? ""}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${GROUP_TONE[sug.group]}`}
                >
                  {sug.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
