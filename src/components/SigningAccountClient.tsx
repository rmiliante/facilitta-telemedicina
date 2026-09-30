"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SIGNING_CHANGED_EVENT } from "./SigningSessionBadge";

interface AccountInfo {
  name: string;
  cpf: string | null;
  crm: string | null;
  crmUf: string | null;
  rqe?: string | null;
  email: string;
  certificate: { status: string; providers: string[] };
}

const DONE_KEY = "facilitta_sign_account";
const CONFIRMED_KEY = "facilitta_sign_confirmed";

function formatCpf(cpf: string | null) {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf ?? "—";
}

/**
 * Tela "Minha assinatura digital" (uma vez só): cria a conta de assinatura
 * do médico com os dados do cadastro, pra o CRM ir gravado dentro da
 * assinatura das receitas. A Prescreve manda um e-mail de confirmação.
 */
export default function SigningAccountClient() {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [shiftUntil, setShiftUntil] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(CONFIRMED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const markConfirmed = useCallback(() => {
    try {
      localStorage.setItem(CONFIRMED_KEY, "1");
    } catch {
      // ignora
    }
    setConfirmed(true);
  }, []);

  function load() {
    return fetch("/api/doctor/signing-account")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Falha ao carregar");
        return d as AccountInfo;
      })
      .then((d) => {
        setInfo(d);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(DONE_KEY);
        } catch {
          // sem armazenamento local
        }
        setEmail(saved || d.email || "");
        if (saved) setSentTo(saved);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Falha ao carregar"));
  }

  useEffect(() => {
    load();
  }, []);

  async function recheck() {
    setChecking(true);
    await load();
    setChecking(false);
  }

  function resetAccount() {
    try {
      localStorage.removeItem(DONE_KEY);
      localStorage.removeItem(CONFIRMED_KEY);
    } catch {
      // ignora
    }
    setSentTo(null);
    setConfirmed(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setSaving(true);
    try {
      const res = await fetch("/api/doctor/signing-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.alreadyExists) {
        setError(data.error ?? "Falha ao ativar. Tente de novo.");
        return;
      }
      if (data.alreadyExists) setError(data.error);
      const target = data.email ?? email;
      try {
        localStorage.setItem(DONE_KEY, target);
        localStorage.setItem("facilitta_sign_email", target);
      } catch {
        // ignora
      }
      setSentTo(target);
      setPassword("");
      setConfirm("");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!info) return <p className="text-xs text-zinc-400">Carregando...</p>;

  const missing = !info.cpf || !info.crm || !info.crmUf;
  const certOk = info.certificate.status === "ok";
  const provider = info.certificate.providers
    .map((p) => (p === "vidaas" ? "VIDaaS" : p === "birdid" ? "BirdID" : p))
    .join(" + ");
  const conselho =
    info.crm && info.crmUf
      ? [`CRM-${info.crmUf} ${info.crm}`, info.rqe ? `RQE ${info.rqe}` : null].filter(Boolean).join(" · ")
      : "—";

  const base = "h-11 w-full rounded-md border px-3 text-sm outline-none";
  const field = `${base} border-zinc-300 focus:border-brand-teal-dark`;
  const box = "flex min-w-0 flex-col gap-1.5 text-xs";
  const lbl = "truncate font-medium text-zinc-600";

  const step1 = certOk ? "done" : "todo";
  const step2 = confirmed ? "done" : sentTo ? "wait" : "todo";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-brand-navy">Minha assinatura digital</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Assine receitas, pedidos de exame e atestados com o seu certificado digital, aqui mesmo na plataforma. Os
          passos 1 e 2 são feitos <strong>uma vez só</strong>.
        </p>
        <ol className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-medium">
          <Progress n={1} label="Certificado" state={step1} />
          <Progress n={2} label="Ativar com CRM" state={step2} />
          <Progress n={3} label="Ativar no plantão" state={shiftUntil ? "done" : "todo"} />
        </ol>
      </header>

      {/* Passo 1 */}
      <Step n={1} title="Certificado VIDaaS no seu celular" state={step1}>
        {certOk ? (
          <p className="text-sm text-zinc-600">
            Encontramos o seu certificado <strong>{provider}</strong> no CPF <strong>{formatCpf(info.cpf)}</strong>.
            Nada a fazer aqui.
          </p>
        ) : (
          <div className="flex flex-col gap-3 text-sm text-zinc-600">
            <p>
              {info.certificate.status === "sem_cpf"
                ? "O seu CPF ainda não está no cadastro. Peça para a administração completar."
                : "Ainda não encontramos um certificado em nuvem no seu CPF."}
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Instale o app <strong>VIDaaS</strong> (Valid) no celular.</li>
              <li>Ative o seu certificado digital no app, com o mesmo CPF do cadastro.</li>
              <li>Volte aqui e clique em verificar.</li>
            </ol>
            <button
              type="button"
              onClick={recheck}
              disabled={checking}
              className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-brand-navy hover:bg-zinc-50 disabled:opacity-50"
            >
              {checking ? "Verificando..." : "Verificar de novo"}
            </button>
          </div>
        )}
      </Step>

      {/* Passo 2 */}
      <Step
        n={2}
        title="Ative a assinatura com o seu CRM"
        state={step2}
        hint="Recomendado: o seu CRM vai gravado dentro de cada assinatura."
      >
        <div className="mb-4 grid gap-2 rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-600 sm:grid-cols-3">
          <Data label="Nome" value={info.name} />
          <Data label="CPF" value={formatCpf(info.cpf)} />
          <Data label="Conselho" value={conselho} />
        </div>

        {confirmed ? (
          <p className="text-sm text-zinc-600">
            Conta de assinatura ativa. O seu CRM vai gravado nas assinaturas quando você ativa o plantão com e-mail e
            senha.
          </p>
        ) : sentTo ? (
          <div className="flex flex-col gap-2 text-sm text-zinc-600">
            <p>
              Conta criada. Enviamos um link de confirmação para <strong>{sentTo}</strong>. Abra o e-mail e clique em
              confirmar. É o único passo fora da plataforma.
            </p>
            <p>Na hora de assinar, use esse e-mail e a senha que você criou.</p>
            {error && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}
            <button type="button" onClick={resetAccount} className="self-start text-xs text-zinc-500 underline">
              Usar outro e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <label className={`${box} sm:col-span-2`}>
                <span className={lbl}>Seu e-mail (vai receber a confirmação)</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={field} />
              </label>
              <label className={box}>
                <span className={lbl}>Crie uma senha</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="mín. 8 caracteres"
                  className={field}
                />
              </label>
              <label className={box}>
                <span className={lbl}>Repita a senha</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className={field}
                />
              </label>
            </div>
            <p className="text-[11px] text-zinc-500">
              A senha serve só para autorizar as assinaturas e não fica guardada na plataforma. Dados do cadastro
              errados? Peça para a administração corrigir.
            </p>
            {missing && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Falta CPF, CRM ou UF no seu cadastro. Peça para a administração completar antes de ativar.
              </p>
            )}
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={saving || missing || !password || !confirm}
              className="self-end rounded-md bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Ativando..." : "Ativar assinatura"}
            </button>
          </form>
        )}
      </Step>

      {/* Passo 3 */}
      <Step
        n={3}
        title="No início do plantão: ative a assinatura"
        state={shiftUntil ? "done" : "todo"}
        badgeText={shiftUntil ? `Ativa até ${shiftUntil}` : "Ative antes de prescrever"}
        hint="Aprove uma vez no app VIDaaS e assine tudo por 8 horas, sem aprovar de novo."
      >
        <ShiftActivation defaultEmail={sentTo || email} onActive={setShiftUntil} onAccountOk={markConfirmed} />
        <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Depois, em cada consulta</p>
        <ol className="grid gap-2 sm:grid-cols-3">
          <Flow n="a" title="Clique em Prescrever" text="Monte a receita, o pedido de exame ou o atestado." />
          <Flow n="b" title="Emita o documento" text="Com a assinatura ativa, ele sai assinado na hora." />
          <Flow n="c" title="A atendente imprime" text="O documento assinado vai para o cadastro do paciente." />
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          Se as 8 horas acabarem no meio do plantão, o sistema pede uma nova aprovação no app na hora de emitir. Nada é
          enviado ao paciente.
        </p>
      </Step>
    </div>
  );
}

type StepState = "done" | "wait" | "todo" | "info";

const BADGE: Record<StepState, { text: string; cls: string }> = {
  done: { text: "Pronto", cls: "bg-brand-teal/15 text-brand-teal-dark" },
  wait: { text: "Confirme o e-mail", cls: "bg-amber-100 text-amber-800" },
  todo: { text: "A fazer", cls: "bg-zinc-100 text-zinc-600" },
  info: { text: "Em cada plantão", cls: "bg-brand-navy/10 text-brand-navy" },
};

function Progress({ n, label, state }: { n: number; label: string; state: StepState }) {
  const bar = state === "done" ? "bg-brand-teal" : state === "wait" ? "bg-amber-400" : "bg-zinc-200";
  return (
    <li className="flex flex-col gap-1.5">
      <span className={`h-1.5 rounded-full ${bar}`} />
      <span className="text-zinc-600">
        {n}. {label}
      </span>
    </li>
  );
}

function Step({
  n,
  title,
  state,
  hint,
  badgeText,
  children,
}: {
  n: number;
  title: string;
  state: StepState;
  hint?: string;
  badgeText?: string;
  children: React.ReactNode;
}) {
  const badge = { ...BADGE[state], text: badgeText ?? BADGE[state].text };
  const circle =
    state === "done" ? "bg-brand-teal-dark text-white" : "border-2 border-brand-navy/20 bg-white text-brand-navy";
  return (
    <section className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${circle}`}>
        {state === "done" ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-brand-navy">{title}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.text}</span>
        </div>
        {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="truncate text-sm text-zinc-700">{value}</p>
    </div>
  );
}

function Flow({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <li className="rounded-lg border border-zinc-200 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-teal-dark">{n}</p>
      <p className="mt-0.5 text-sm font-semibold text-brand-navy">{title}</p>
      <p className="mt-0.5 text-xs text-zinc-600">{text}</p>
    </li>
  );
}

interface SessionState {
  ready: boolean;
  missing: string[];
  status: "none" | "awaiting_approval" | "active" | "expired";
  expiresAt: string | null;
  error?: string;
}

const SIGN_EMAIL_KEY = "facilitta_sign_email";

function hhmm(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

/**
 * Ativa a sessão de assinatura do plantão (aprovação no app VIDaaS, vale 8h)
 * antes da primeira receita. Com e-mail e senha da conta de assinatura, o
 * CRM vai gravado; sem eles, assina só pelo CPF.
 */
function ShiftActivation({
  defaultEmail,
  onActive,
  onAccountOk,
}: {
  defaultEmail: string;
  onActive: (until: string | null) => void;
  onAccountOk: () => void;
}) {
  const [state, setState] = useState<SessionState | null>(null);
  const [typedEmail, setEmail] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(SIGN_EMAIL_KEY);
    } catch {
      return null;
    }
  });
  const email = typedEmail ?? defaultEmail;
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const apply = useCallback(
    (st: SessionState) => {
      setState(st);
      onActive(st.status === "active" ? hhmm(st.expiresAt) : null);
      window.dispatchEvent(new Event(SIGNING_CHANGED_EVENT));
    },
    [onActive]
  );

  const stopPolling = useCallback(() => {
    if (polling.current) clearInterval(polling.current);
    polling.current = null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    const started = Date.now();
    polling.current = setInterval(async () => {
      const res = await fetch("/api/doctor/signing-session").catch(() => null);
      const st = res && res.ok ? ((await res.json()) as SessionState) : null;
      if (st) apply(st);
      if (!st || st.status !== "awaiting_approval" || Date.now() - started > 190_000) {
        stopPolling();
        if (st?.status !== "active") setError("A aprovação não chegou a tempo. Tente de novo.");
      }
    }, 3000);
  }, [apply, stopPolling]);

  useEffect(() => {
    fetch("/api/doctor/signing-session")
      .then((r) => (r.ok ? r.json() : null))
      .then((st: SessionState | null) => {
        if (!st) return;
        apply(st);
        if (st.status === "awaiting_approval") startPolling();
      })
      .catch(() => {});
    return stopPolling;
  }, [apply, startPolling, stopPolling]);

  async function activate(withAccount: boolean) {
    setError(null);
    if (withAccount && (!email.trim() || !password)) {
      setError("Informe o e-mail e a senha da assinatura, ou ative só com o VIDaaS.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/doctor/signing-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withAccount ? { email: email.trim(), password } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível ativar. Tente de novo.");
        return;
      }
      if (withAccount) {
        onAccountOk();
        try {
          localStorage.setItem(SIGN_EMAIL_KEY, email.trim());
        } catch {
          // ignora
        }
      }
      setPassword("");
      apply(data as SessionState);
      if (data.status === "awaiting_approval") startPolling();
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <p className="text-xs text-zinc-400">Verificando a assinatura...</p>;

  if (state.status === "active") {
    return (
      <div className="rounded-lg border border-brand-teal/40 bg-brand-teal/10 px-4 py-3 text-sm text-brand-navy">
        <p className="font-semibold">Assinatura ativa até {hhmm(state.expiresAt)}.</p>
        <p className="mt-0.5 text-xs text-zinc-600">Pode prescrever: os documentos saem assinados direto.</p>
      </div>
    );
  }

  if (state.status === "awaiting_approval") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="mt-1 h-3 w-3 shrink-0 animate-pulse rounded-full bg-amber-400" />
        <div>
          <p className="font-semibold">Abra o app VIDaaS no celular e aprove o pedido.</p>
          <p className="mt-0.5 text-xs">Você tem até 3 minutos. Esta tela atualiza sozinha.</p>
        </div>
      </div>
    );
  }

  const base = "h-11 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-brand-teal-dark";
  return (
    <div className="flex flex-col gap-3">
      {!state.ready && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Falta no seu cadastro: {state.missing.join(", ")}.{" "}
          {state.missing.includes("endereço profissional") ? (
            <a href="/medico/cadastro" className="font-semibold underline">
              Complete em Meu cadastro
            </a>
          ) : (
            "Peça para a administração completar"
          )}{" "}
          antes de ativar.
        </p>
      )}
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5 text-xs">
          <span className="truncate font-medium text-zinc-600">E-mail da assinatura</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={base} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs">
          <span className="truncate font-medium text-zinc-600">Senha da assinatura</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={base}
          />
        </label>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => activate(false)}
          disabled={busy || !state.ready}
          className="text-xs text-zinc-500 underline disabled:opacity-50"
        >
          Ativar só com o VIDaaS (sem CRM)
        </button>
        <button
          type="button"
          onClick={() => activate(true)}
          disabled={busy || !state.ready}
          className="rounded-md bg-brand-teal-dark px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Enviando..." : "Ativar assinatura do plantão"}
        </button>
      </div>
    </div>
  );
}
