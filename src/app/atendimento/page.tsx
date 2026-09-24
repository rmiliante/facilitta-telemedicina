"use client";

import { useEffect, useState } from "react";
import VideoRoom from "@/components/VideoRoom";

interface PendingPatient {
  id: string;
  access_token: string;
  patients: { full_name: string; cpf: string | null } | null;
  doctors: { name: string } | null;
  specialties: { name: string } | null;
}

const POLL_INTERVAL_MS = 4000;

/**
 * Link único, fixo e genérico da cabine de atendimento presencial —
 * fica ligado sempre no computador da cabine, sem login. Começa em
 * branco (aguardando); quando a atendente manda um paciente
 * ("Enviar para atendimento" no /atendente), aparece o nome dele
 * aqui pra confirmar antes de entrar na sala. Não precisa saber qual
 * médico — a consulta já está vinculada a ele.
 */
export default function BoothPage() {
  const [pending, setPending] = useState<PendingPatient | null>(null);
  const [loading, setLoading] = useState(true);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [room, setRoom] = useState<{ roomUrl: string; token: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/booth/current");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setPending(data.pending);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(() => {
      if (!room) load();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [room]);

  async function handleConfirm() {
    if (!pending) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/appointments/${pending.access_token}/room`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setJoinError(err.error ?? "Não foi possível entrar na consulta");
        return;
      }
      const data = await res.json();
      setRoom(data);
    } finally {
      setJoining(false);
    }
  }

  function handleLeave() {
    setRoom(null);
    setPending(null);
    setJoinError(null);
  }

  if (room) {
    return (
      <div className="h-screen w-screen bg-zinc-900">
        <VideoRoom roomUrl={room.roomUrl} token={room.token} onLeave={handleLeave} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-facilitta.png"
          alt="Facilitta Saúde"
          className="mx-auto mb-4 h-14 w-14 rounded-xl"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <h1 className="text-2xl font-semibold text-brand-navy">
          facilitta<span className="text-brand-teal-dark"> saúde</span>
        </h1>

        {loading ? (
          <p className="mt-6 text-sm text-zinc-400">Carregando...</p>
        ) : !pending ? (
          <p className="mt-6 text-sm text-zinc-400">Aguardando o próximo atendimento...</p>
        ) : (
          <div className="mt-8 rounded-xl border-2 border-brand-teal-dark bg-white p-6 shadow-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-teal-dark">
              Confirme seu nome
            </p>
            <p className="text-xl font-semibold text-zinc-800">{pending.patients?.full_name}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {pending.patients?.cpf ? `CPF ${pending.patients.cpf}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {pending.specialties?.name ? `${pending.specialties.name} ` : ""}
              {pending.doctors?.name ? `com ${pending.doctors.name}` : ""}
            </p>

            <button
              onClick={handleConfirm}
              disabled={joining}
              className="mt-6 w-full rounded-md bg-brand-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {joining ? "Entrando..." : "Iniciar consulta"}
            </button>
            {joinError && <p className="mt-3 text-sm text-red-600">{joinError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
