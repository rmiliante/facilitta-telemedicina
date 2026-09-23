"use client";

import { use, useEffect, useState } from "react";
import VideoRoom from "@/components/VideoRoom";

interface AppointmentInfo {
  id: string;
  scheduled_at: string;
  status: string;
  patients: { full_name: string } | null;
  specialties: { name: string } | null;
  doctors: { name: string } | null;
}

export default function PatientAppointmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [info, setInfo] = useState<AppointmentInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [room, setRoom] = useState<{ roomUrl: string; token: string } | null>(null);

  useEffect(() => {
    fetch(`/api/appointments/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setLoadError(err.error ?? "Link inválido");
          return;
        }
        const data = await res.json();
        setInfo(data.appointment);
      })
      .catch(() => setLoadError("Não foi possível carregar a consulta"));
  }, [token]);

  async function handleJoin() {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/appointments/${token}/room`, { method: "POST" });
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

  if (room) {
    return (
      <div className="h-screen w-screen bg-zinc-900">
        <VideoRoom roomUrl={room.roomUrl} token={room.token} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-facilitta.png"
          alt="Facilitta Saúde"
          className="mx-auto mb-4 h-10 w-10 rounded-md"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <h1 className="mb-1 text-lg font-semibold text-brand-navy">
          facilitta<span className="text-brand-teal-dark"> saúde</span>
        </h1>

        {loadError ? (
          <p className="mt-4 text-sm text-red-600">{loadError}</p>
        ) : !info ? (
          <p className="mt-4 text-sm text-zinc-400">Carregando...</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-zinc-600">
              Olá, <strong>{info.patients?.full_name}</strong>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Consulta {info.specialties?.name ? `de ${info.specialties.name} ` : ""}
              {info.doctors?.name ? `com ${info.doctors.name} ` : ""}
              marcada para{" "}
              {new Date(info.scheduled_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>

            <button
              onClick={handleJoin}
              disabled={joining}
              className="mt-6 w-full rounded-md bg-brand-navy px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {joining ? "Entrando..." : "Entrar na consulta"}
            </button>
            {joinError && <p className="mt-3 text-sm text-red-600">{joinError}</p>}

            <p className="mt-4 text-[11px] text-zinc-400">
              Recomendamos entrar com alguns minutos de antecedência e testar
              sua câmera e microfone.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
