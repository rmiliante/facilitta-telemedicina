"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Summary {
  filaHoje: number;
  atendidosHoje: number;
  atendidosMes: number;
  repasse: { aReceber: number; emAberto: number } | null;
}

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Resumo no topo da Fila de hoje: hoje, mês e repasse, sem precisar abrir outras telas. */
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
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
      <Link href="/medico/financeiro" className={`${card} hover:border-brand-teal-dark`}>
        <p className={label}>A receber</p>
        <p className={value}>{s?.repasse ? money(s.repasse.aReceber + s.repasse.emAberto) : "—"}</p>
        {s?.repasse && s.repasse.emAberto > 0 && (
          <p className="text-[11px] text-zinc-500">{money(s.repasse.emAberto)} ainda não fechado</p>
        )}
      </Link>
    </div>
  );
}
