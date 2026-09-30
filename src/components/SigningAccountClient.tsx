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

  useEffect(() => {
    fetch("/api/doctor/signing-account")
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
  }, []);

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
  const certLabel =
    info.certificate.status === "ok"
      ? `Encontrado (${info.certificate.providers.map((p) => (p === "vidaas" ? "VIDaaS" : p === "birdid" ? "BirdID" : p)).join(" + ")})`
      : info.certificate.status === "nenhum"
        ? "Nenhum certificado em nuvem nesse CPF"
        : info.certificate.status === "sem_cpf"
          ? "Falta o CPF no cadastro"
          : "Não foi possível verificar";

  const base = "h-11 w-full rounded-md border px-3 text-sm outline-none";
  const field = `${base} border-zinc-300 focus:border-brand-teal-dark`;
  const locked = `${base} border-zinc-200 bg-zinc-50 text-zinc-600`;
  const box = "flex min-w-0 flex-col gap-1.5 text-xs";
  const lbl = "truncate font-medium text-zinc-600";
  const conselho =
    info.crm && info.crmUf
      ? [`CRM-${info.crmUf} ${info.crm}`, info.rqe ? `RQE ${info.rqe}` : null, "Médico"].filter(Boolean).join(" · ")
      : "—";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-teal-dark">Ativar uma vez só</p>
          <h1 className="mt-1 text-xl font-semibold text-brand-navy">Assinatura digital com CRM</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Com isso, o seu CRM vai gravado dentro da assinatura de cada receita. Os dados abaixo vêm do seu cadastro
            na Facilitta.
          </p>
        </div>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <label className={box}>
            <span className={lbl}>Nome completo</span>
            <input value={info.name} readOnly className={locked} />
          </label>
          <label className={box}>
            <span className={lbl}>CPF do certificado</span>
            <input value={formatCpf(info.cpf)} readOnly className={locked} />
          </label>
          <label className={`${box} sm:col-span-2`}>
            <span className={lbl}>Conselho</span>
            <input value={conselho} readOnly className={locked} />
          </label>
          <label className={`${box} sm:col-span-2`}>
            <span className={lbl}>E-mail (recebe a confirmação)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={field} />
          </label>
          <label className={box}>
            <span className={lbl}>Senha da assinatura</span>
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
          Essa senha é só para autorizar as assinaturas (uma vez por plantão). Ela não fica guardada no sistema da
          Facilitta. Dados errados? Peça para a administração corrigir o seu cadastro.
        </p>
        {missing && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Falta CPF, CRM ou UF no seu cadastro. Peça para a administração completar antes de ativar.
          </p>
        )}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || missing || !password || !confirm}
            className="rounded-md bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Ativando..." : "Ativar assinatura com CRM"}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-4">
        {sentTo && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Próximo passo</p>
            <p className="mt-2 text-base font-semibold text-brand-navy">Confirme o seu e-mail</p>
            <p className="mt-1 text-sm text-zinc-600">
              Enviamos um link para <strong>{sentTo}</strong>. Abra e confirme — é o único passo fora desta tela.
              Depois, na hora de assinar, use esse e-mail e a senha que você criou.
            </p>
          </div>
        )}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Situação da sua assinatura</p>
          <div className="mt-3 flex justify-between gap-3">
            <span>Certificado digital</span>
            <span className={`font-semibold ${info.certificate.status === "ok" ? "text-brand-teal-dark" : "text-amber-700"}`}>
              {certLabel}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span>Conta de assinatura</span>
            <span className="font-semibold text-zinc-600">{sentTo ? "Criada · confirme o e-mail" : "Não ativada"}</span>
          </div>
        </div>
        <div className="rounded-xl border border-brand-teal/40 bg-brand-teal/10 p-5 text-sm text-brand-navy">
          Enquanto isso, as receitas continuam saindo normalmente, com assinatura pelo VIDaaS e validade legal.
        </div>
      </div>
    </div>
  );
}
