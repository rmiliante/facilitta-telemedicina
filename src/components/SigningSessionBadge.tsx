"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface SessionState {
  ready: boolean;
  missing: string[];
  status: "none" | "awaiting_approval" | "active" | "expired";
  expiresAt: string | null;
}

/** Evento disparado quando a assinatura é ativada em outra parte da tela. */
export const SIGNING_CHANGED_EVENT = "facilitta:signing-changed";

function remaining(expiresAt: string, now: number) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  const min = Math.ceil(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return { min, label: h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m} min` };
}

function hhmm(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

/**
 * Selo no topo da área do médico com o tempo que falta pra acabar a
 * assinatura do plantão (sessão VIDaaS de 8h). Atualiza sozinho.
 */
export default function SigningSessionBadge() {
  const [state, setState] = useState<SessionState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const res = await fetch("/api/doctor/signing-session").catch(() => null);
    if (res?.ok) setState((await res.json()) as SessionState);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const poll = setInterval(load, 2 * 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(SIGNING_CHANGED_EVENT, onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(SIGNING_CHANGED_EVENT, onFocus);
    };
  }, [load]);

  if (!state) return null;

  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap";
  const dot = (cls: string) => <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;

  if (!state.ready) {
    return (
      <Link href="/medico/cadastro" className={`${base} bg-amber-400/20 text-amber-200 hover:bg-amber-400/30`}>
        {dot("bg-amber-300")}
        Assinatura: complete o cadastro
      </Link>
    );
  }

  if (state.status === "awaiting_approval") {
    return (
      <Link href="/medico/assinatura" className={`${base} bg-amber-400/20 text-amber-100`}>
        {dot("animate-pulse bg-amber-300")}
        Aprove no app VIDaaS
      </Link>
    );
  }

  const left = state.status === "active" && state.expiresAt ? remaining(state.expiresAt, now) : null;
  if (!left) {
    return (
      <Link
        href="/medico/assinatura"
        title="Ative a assinatura do plantão antes de prescrever"
        className={`${base} bg-white/10 text-white hover:bg-white/20`}
      >
        {dot("bg-zinc-400")}
        Assinatura inativa · <span className="underline">Ativar</span>
      </Link>
    );
  }

  const tone =
    left.min <= 15
      ? { chip: "bg-red-500/25 text-red-100", dot: "animate-pulse bg-red-400" }
      : left.min <= 60
        ? { chip: "bg-amber-400/20 text-amber-100", dot: "bg-amber-300" }
        : { chip: "bg-brand-teal/20 text-brand-teal", dot: "bg-brand-teal" };

  return (
    <Link
      href="/medico/assinatura"
      title={`A assinatura do plantão vale até ${hhmm(state.expiresAt!)}`}
      className={`${base} ${tone.chip}`}
    >
      {dot(tone.dot)}
      Assinatura ativa · faltam {left.label}
    </Link>
  );
}
