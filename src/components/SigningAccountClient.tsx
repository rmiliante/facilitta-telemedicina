"use client";

import { useEffect, useState } from "react";

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
    } catch {
      // ignora
    }
    setSentTo(null);
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
  const step2 = sentTo ? "wait" : "todo";

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
          <Progress n={3} label="Usar na consulta" state="info" />
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

        {sentTo ? (
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
      <Step n={3} title="Na consulta: prescreva e aprove no celular" state="info">
        <ol className="grid gap-2 sm:grid-cols-3">
          <Flow n="a" title="Clique em Prescrever" text="Monte a receita, o pedido de exame ou o atestado." />
          <Flow n="b" title="Aprove no app VIDaaS" text="Chega um aviso no celular. Você tem 3 minutos." />
          <Flow n="c" title="A atendente imprime" text="O documento assinado vai para o cadastro do paciente." />
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          A aprovação vale por <strong>8 horas</strong>: no resto do plantão, os documentos são assinados direto, sem
          aprovar de novo. Nada é enviado ao paciente.
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
  children,
}: {
  n: number;
  title: string;
  state: StepState;
  hint?: string;
  children: React.ReactNode;
}) {
  const badge = BADGE[state];
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
