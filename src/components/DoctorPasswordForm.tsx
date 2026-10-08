"use client";

import { useState } from "react";

/** Troca de senha do médico (Minha conta). */
export default function DoctorPasswordForm() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (nova.length < 8) return setMsg({ ok: false, text: "A nova senha precisa ter pelo menos 8 caracteres." });
    if (nova !== confirma) return setMsg({ ok: false, text: "A confirmação não confere com a nova senha." });
    setBusy(true);
    try {
      const res = await fetch("/api/doctor/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual: atual, novaSenha: nova }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Não foi possível trocar a senha." });
      } else {
        setMsg({ ok: true, text: "Senha alterada com sucesso." });
        setAtual("");
        setNova("");
        setConfirma("");
      }
    } catch {
      setMsg({ ok: false, text: "Falha de conexão. Tente de novo." });
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand-teal-dark";

  return (
    <form onSubmit={salvar} className="mt-8 max-w-xl rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-900">Trocar senha</h2>
      <label className="mt-4 block text-sm text-zinc-600">
        Senha atual
        <input type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} className={input} />
      </label>
      <label className="mt-3 block text-sm text-zinc-600">
        Nova senha (mínimo 8 caracteres)
        <input type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} className={input} />
      </label>
      <label className="mt-3 block text-sm text-zinc-600">
        Confirmar nova senha
        <input type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className={input} />
      </label>
      <button
        type="submit"
        disabled={busy || !atual || !nova || !confirma}
        className="mt-4 rounded-md bg-brand-teal-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Salvando…" : "Salvar senha"}
      </button>
      {msg && (
        <p className={`mt-3 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
