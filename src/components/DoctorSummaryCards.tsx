"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Summary {
  filaHoje: number;
  atendidosHoje: number;
  atendidosMes: number;
}

/** Resumo no topo da Fila de hoje: hoje e mês, sem precisar abrir outras telas. */
export default function DoctorSummaryCards() {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/doctor/resumo")
        .then(async (r) => {
          const json = await r.json().catch(() => null);
          if (!cancelled && r.ok && json) setS(json);
        })
        .catch(() => {});
    load();
    // Acompanha a fila (que também se atualiza sozinha).
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const card = "@container min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-3";
  const label = "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
  const value = "whitespace-nowrap text-xl font-extrabold text-brand-navy @[11rem]:text-2xl";

  return (
    <div className="mb-5 grid grid-cols-3 gap-3">
      <div className={card}>
        <p className={label}>Na fila agora</p>
        <p className={value}>{s ? s.filaHoje : "—"}</p>
      </div>
      <div className={card}>
        <p className={label}>Atendidos hoje</p>
        <p className={value}>{s ? s.atendidosHoje : "—"}</p>
      </div>
      <Link href="/medico/historico" className={`${card} hover:border-brand-teal-dark`}>
        <p className={label}>Atendimentos no mês</p>
        <p className={value}>{s ? s.atendidosMes : "—"}</p>
      </Link>
    </div>
  );
}
