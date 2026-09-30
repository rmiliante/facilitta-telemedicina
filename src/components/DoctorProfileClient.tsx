"use client";

import { useEffect, useState } from "react";

interface Profile {
  name: string;
  email: string;
  cpf: string | null;
  crm: string | null;
  crmUf: string | null;
  rqe: string | null;
  enderecoProfissional: string | null;
  specialty: string | null;
}

function formatCpf(cpf: string | null) {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf || "—";
}

/**
 * Tela "Meu cadastro": dados do médico. Nome, CPF, CRM e especialidade vêm
 * da administração (travados); RQE e endereço profissional o médico completa.
 */
export default function DoctorProfileClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rqe, setRqe] = useState("");
  const [endereco, setEndereco] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/doctor/profile")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Falha ao carregar");
        return d as Profile;
      })
      .then((d) => {
        setProfile(d);
        setRqe(d.rqe ?? "");
        setEndereco(d.enderecoProfissional ?? "");
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Falha ao carregar"));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/doctor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rqe, enderecoProfissional: endereco }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Não foi possível salvar." });
        return;
      }
      setProfile((p) => (p ? { ...p, rqe: rqe.replace(/\D/g, "") || null, enderecoProfissional: endereco.trim() || null } : p));
      setMessage({ ok: true, text: "Cadastro atualizado." });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!profile) return <p className="text-xs text-zinc-400">Carregando...</p>;

  const base = "h-11 w-full rounded-md border px-3 text-sm outline-none";
  const locked = `${base} border-zinc-200 bg-zinc-50 text-zinc-600`;
  const field = `${base} border-zinc-300 focus:border-brand-teal-dark`;
  const box = "flex min-w-0 flex-col gap-1.5 text-xs";
  const lbl = "truncate font-medium text-zinc-600";
  const conselho = profile.crm && profile.crmUf ? `CRM-${profile.crmUf} ${profile.crm}` : "—";
  const pendente = !profile.enderecoProfissional;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-brand-navy">Meu cadastro</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Estes dados aparecem nas receitas, pedidos de exame e atestados que você emite pela plataforma.
        </p>
        {pendente && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Falta o <strong>endereço profissional</strong>. Sem ele não é possível emitir documentos.
          </p>
        )}
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-brand-navy">Dados profissionais</h2>
          <p className="text-[11px] text-zinc-500">Para corrigir, fale com a administração.</p>
        </div>
        <div className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <label className={box}>
            <span className={lbl}>Nome completo</span>
            <input value={profile.name} readOnly className={locked} />
          </label>
          <label className={box}>
            <span className={lbl}>E-mail de acesso</span>
            <input value={profile.email} readOnly className={locked} />
          </label>
          <label className={box}>
            <span className={lbl}>CPF</span>
            <input value={formatCpf(profile.cpf)} readOnly className={locked} />
          </label>
          <label className={box}>
            <span className={lbl}>Conselho</span>
            <input value={conselho} readOnly className={locked} />
          </label>
          <label className={`${box} sm:col-span-2`}>
            <span className={lbl}>Especialidade</span>
            <input value={profile.specialty ?? "—"} readOnly className={locked} />
          </label>
        </div>
      </section>

      <form onSubmit={handleSave} className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-base font-semibold text-brand-navy">Complete o seu cadastro</h2>
        <div className="mt-4 flex flex-col gap-4">
          <label className={`${box} sm:max-w-[50%]`}>
            <span className={lbl}>RQE (registro de especialista)</span>
            <input
              value={rqe}
              onChange={(e) => setRqe(e.target.value)}
              inputMode="numeric"
              placeholder="opcional"
              className={field}
            />
            <span className="text-[11px] text-zinc-500">
              Só a especialidade com RQE pode aparecer nos documentos.
            </span>
          </label>

          <label className={box}>
            <span className={lbl}>Endereço profissional</span>
            <textarea
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Ex.: Clínica Exemplo · Rua das Flores, 100, sala 12 · Centro · Salvador/BA · CEP 40000-000"
              className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-teal-dark"
            />
          </label>

          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 shrink-0">
              <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            <div className="space-y-1">
              <p className="font-semibold">Este endereço fica visível nos documentos.</p>
              <p>
                Ele é impresso no cabeçalho de toda receita, pedido de exame e atestado, e o paciente leva o papel.
                Por isso, você pode usar o endereço de uma <strong>clínica</strong> onde atende ou do seu{" "}
                <strong>CNPJ</strong>, em vez do endereço de casa.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Como vai sair na receita</p>
            <p className="mt-1 text-sm font-semibold text-brand-navy">{profile.name}</p>
            <p className="text-xs text-zinc-700">
              {[profile.specialty, conselho, rqe.replace(/\D/g, "") ? `RQE ${rqe.replace(/\D/g, "")}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-xs text-zinc-500">{endereco.trim() || "Endereço profissional"}</p>
          </div>

          {message && (
            <p
              className={`rounded-md px-3 py-2 text-xs ${message.ok ? "bg-brand-teal/10 text-brand-teal-dark" : "bg-red-50 text-red-700"}`}
            >
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="self-end rounded-md bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
