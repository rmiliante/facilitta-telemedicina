"use client";

import { useEffect, useState } from "react";

/** Aviso fixo: só some quando a médica clica em "Fechar". */
export default function AgendaEncerradaPopup() {
  const [pendente, setPendente] = useState(false);
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const check = () => {
      fetch("/api/doctor/agenda-encerrada", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (vivo && d) setPendente(!!d.pendente); })
        .catch(() => {});
    };
    check();
    const t = setInterval(check, 20_000);
    document.addEventListener("visibilitychange", check);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", check); };
  }, []);

  async function fechar() {
    setFechando(true);
    await fetch("/api/doctor/agenda-encerrada", { method: "POST" }).catch(() => {});
    setPendente(false);
    setFechando(false);
  }

  if (!pendente) return null;
  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="text-4xl">🏁</div>
        <h2 className="mt-2 text-lg font-bold text-brand-navy">A agenda de hoje foi encerrada</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Não entrarão novos pacientes hoje. Conclua os atendimentos que já estão na sua fila.
        </p>
        <button
          type="button"
          onClick={fechar}
          disabled={fechando}
          className="mt-5 rounded-lg bg-brand-navy px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
