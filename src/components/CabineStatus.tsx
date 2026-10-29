"use client";

import { useEffect, useState } from "react";

interface Pessoa {
  paciente: string;
  medico: string | null;
  especialidade: string | null;
  desde?: string | null;
  outros?: number;
  tipo?: "enviado" | "fila";
  enviadoAs?: string | null;
  posicao?: number | null;
}

function hhmm(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Quadro "Na cabine agora / Próximo", atualizado a cada 15 segundos. */
export default function CabineStatus() {
  const [data, setData] = useState<{ atual: Pessoa | null; proximo: Pessoa | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/appointments/cabine", { cache: "no-store" });
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        /* mantém o último valor */
      }
    }
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (!data) return null;
  const { atual, proximo } = data;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${atual ? "bg-green-600" : "bg-zinc-400"}`} />
          {atual ? "Na cabine agora" : "Cabine"}
        </p>
        {atual ? (
          <>
            <p className="truncate text-sm font-semibold text-zinc-900">{atual.paciente}</p>
            <p className="text-xs text-zinc-600">
              {[atual.medico, atual.especialidade].filter(Boolean).join(" · ")}
              {atual.desde ? ` · desde ${hhmm(atual.desde)}` : ""}
              {atual.outros && atual.outros > 0 ? ` · +${atual.outros} em consulta` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold text-zinc-500">Vazia</p>
        )}
      </div>
      <div className="min-w-0 text-right">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {proximo?.tipo === "fila" ? "Próximo da fila" : "Próximo"}
        </p>
        {proximo ? (
          <>
            <p className="truncate text-sm font-semibold text-zinc-900">{proximo.paciente}</p>
            <p className="text-xs text-zinc-600">
              {proximo.tipo === "enviado"
                ? `${proximo.enviadoAs ? `enviado às ${hhmm(proximo.enviadoAs)} · ` : ""}aguardando entrar na cabine`
                : `${[proximo.medico, proximo.posicao ? `${proximo.posicao}º da fila` : null].filter(Boolean).join(" · ")} · ainda não enviado`}
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500">ninguém aguardando</p>
        )}
      </div>
    </div>
  );
}
