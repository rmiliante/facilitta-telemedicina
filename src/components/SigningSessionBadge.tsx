"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShiftActivation } from "./SigningAccountClient";
import { SIGNING_CHANGED_EVENT } from "@/lib/signingEvents";

interface SessionState {
  ready: boolean;
  missing: string[];
  status: "none" | "awaiting_approval" | "active" | "expired";
  expiresAt: string | null;
  provider?: { id: string; label: string } | null;
}

export { SIGNING_CHANGED_EVENT };

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
 * assinatura do plantão (sessão de 8h no certificado do médico). Atualiza sozinho.
 */
export default function SigningSessionBadge() {
  const [state, setState] = useState<SessionState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

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

  const left = state.status === "active" && state.expiresAt ? remaining(state.expiresAt, now) : null;
  const tone = left
    ? left.min <= 15
      ? { chip: "bg-red-500/25 text-red-100", dot: "animate-pulse bg-red-400" }
      : left.min <= 60
        ? { chip: "bg-amber-400/20 text-amber-100", dot: "bg-amber-300" }
        : { chip: "bg-brand-teal/20 text-brand-teal", dot: "bg-brand-teal" }
    : state.status === "awaiting_approval"
      ? { chip: "bg-amber-400/20 text-amber-100", dot: "animate-pulse bg-amber-300" }
      : { chip: "bg-white/10 text-white", dot: "bg-zinc-400" };

  const label = left ? (
    <>
      Assinatura · faltam {left.label} · <span className="underline">Renovar</span>
    </>
  ) : state.status === "awaiting_approval" ? (
    `Aprove no app ${state.provider?.label ?? "do certificado"}`
  ) : (
    <>
      Assinatura inativa · <span className="underline">Ativar</span>
    </>
  );

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={left ? `Vale até ${hhmm(state.expiresAt!)}. Clique para renovar por mais 8h.` : "Ativar a assinatura do plantão"}
        className={`${base} ${tone.chip} hover:brightness-125`}
      >
        {dot(tone.dot)}
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-xl">
          <p className="mb-2 text-sm font-semibold text-brand-navy">Assinatura do plantão</p>
          <ShiftActivation
            compact
            defaultEmail=""
            onActive={() => load()}
            onAccountOk={() => {
              try {
                localStorage.setItem("facilitta_sign_confirmed", "1");
              } catch {
                // ignora
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
