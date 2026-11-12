"use client";

import { useEffect, useState } from "react";

interface Lado {
  online: boolean;
  entrou: string | null;
}

interface Conexao {
  medico: Lado;
  paciente: Lado;
}

interface Pessoa {
  paciente: string;
  medico: string | null;
  especialidade: string | null;
  desde?: string | null;
  outros?: number;
  tipo?: "enviado" | "fila";
  enviadoAs?: string | null;
  posicao?: number | null;
  conexao?: Conexao | null;
}

function hhmm(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function fmt(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return h > 0 ? h + ":" + m + ":" + s : m + ":" + s;
}

/** Etiqueta de conexão de um dos lados (médico ou paciente). */
function Chip({ rotulo, lado }: { rotulo: string; lado: Lado }) {
  return lado.online ? (
    <span className="mr-1.5 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
      {"● " + rotulo + " conectado" + (lado.entrou ? " · entrou " + hhmm(lado.entrou) : "")}
    </span>
  ) : (
    <span className="mr-1.5 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      {"⚠ " + rotulo + " não conectado"}
    </span>
  );
}

/**
 * Cronômetro da consulta: corre ao vivo enquanto médico e paciente estão
 * conectados e pausa se algum deles cair. Sem informação do vídeo, conta
 * desde a entrada do paciente.
 */
function Cronometro({ atual }: { atual: Pessoa }) {
  const [now, setNow] = useState(0);
  const [ultimo, setUltimo] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const c = atual.conexao;
  let inicio: number | null = null;
  if (!c) {
    inicio = atual.desde ? new Date(atual.desde).getTime() : null;
  } else if (c.medico.online && c.paciente.online && c.medico.entrou && c.paciente.entrou) {
    inicio = Math.max(new Date(c.medico.entrou).getTime(), new Date(c.paciente.entrou).getTime());
  }
  const secs = inicio !== null && now > 0 ? Math.max(0, Math.floor((now - inicio) / 1000)) : null;

  useEffect(() => {
    if (secs !== null) setUltimo(secs);
  }, [secs]);

  const mostrar = secs ?? ultimo;
  const legenda = secs !== null ? (c ? "ao vivo" : "desde a entrada do paciente") : ultimo !== null ? "pausado · aguardando reconexão" : "aguardando conexão";

  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tempo de consulta</p>
      <p
        className={"text-3xl font-extrabold leading-none " + (secs !== null ? "text-green-800" : "text-zinc-400")}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {mostrar !== null ? fmt(mostrar) : "--:--"}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{legenda}</p>
    </div>
  );
}

/** Quadro "Na cabine agora / Próximo", atualizado a cada 8 segundos. */
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
    const timer = setInterval(load, 8_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (!data) return null;
  const { atual, proximo } = data;
  const c = atual?.conexao ?? null;
  const todosOnline = !c || (c.medico.online && c.paciente.online);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          <span className={"mr-1.5 inline-block h-2 w-2 rounded-full " + (atual ? (todosOnline ? "bg-green-600" : "bg-amber-500") : "bg-zinc-400")} />
          {atual ? "Na cabine agora" : "Cabine"}
        </p>
        {atual ? (
          <>
            <p className="truncate text-sm font-semibold text-zinc-900">{atual.paciente}</p>
            <p className="text-xs text-zinc-600">
              {[atual.medico, atual.especialidade].filter(Boolean).join(" · ")}
              {atual.desde ? " · desde " + hhmm(atual.desde) : ""}
              {atual.outros && atual.outros > 0 ? " · +" + atual.outros + " em consulta" : ""}
            </p>
            {c && (
              <div className="mt-2">
                <Chip rotulo="Médico" lado={c.medico} />
                <Chip rotulo="Paciente" lado={c.paciente} />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm font-semibold text-zinc-500">Vazia</p>
        )}
      </div>
      {atual && <Cronometro key={atual.paciente + (atual.desde ?? "")} atual={atual} />}
      <div className="min-w-0 text-right">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {proximo?.tipo === "fila" ? "Próximo da fila" : "Próximo"}
        </p>
        {proximo ? (
          <>
            <p className="truncate text-sm font-semibold text-zinc-900">{proximo.paciente}</p>
            <p className="text-xs text-zinc-600">
              {proximo.tipo === "enviado"
                ? (proximo.enviadoAs ? "enviado às " + hhmm(proximo.enviadoAs) + " · " : "") +
                  "aguardando entrar na cabine" +
                  (proximo.conexao?.medico.online ? " · médico já conectado" : "")
                : [proximo.medico, proximo.posicao ? proximo.posicao + "º da fila" : null].filter(Boolean).join(" · ") + " · ainda não enviado"}
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500">ninguém aguardando</p>
        )}
      </div>
    </div>
  );
}
