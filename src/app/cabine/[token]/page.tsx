"use client";

import { use, useEffect, useState } from "react";
import VideoRoom from "@/components/VideoRoom";

interface BoothQueueItem {
  id: string;
  status: string;
  queue_position: number | null;
  called_at: string | null;
  patient_joined_at: string | null;
  access_token: string;
  patients: { full_name: string; cpf: string | null } | null;
  specialties: { name: string } | null;
}

const POLL_INTERVAL_MS = 6000;

/**
 * Tela da cabine de atendimento presencial — fica ligada num
 * computador físico específico, sem login. Mostra a fila do médico
 * daquele dia; a pessoa (ou quem estiver dando suporte na cabine)
 * clica no nome dela quando for chamada, e entra direto na sala de
 * vídeo com o médico.
 */
export default function BoothPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [doctorInfo, setDoctorInfo] = useState<{ name: string; specialty: string | null } | null>(null);
  const [queue, setQueue] = useState<BoothQueueItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeItem, setActiveItem] = useState<BoothQueueItem | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [room, setRoom] = useState<{ roomUrl: string; token: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/booth/${token}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (!cancelled) setLoadError(err.error ?? "Link inválido");
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setDoctorInfo(data.doctor);
          setQueue(data.queue);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) setLoadError("Não foi possível carregar a fila");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Não faz polling enquanto está numa videochamada em andamento.
    const interval = setInterval(() => {
      if (!room) load();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, room]);

  async function handleJoin(item: BoothQueueItem) {
    setActiveItem(item);
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/appointments/${item.access_token}/room`, { method: "POST" });
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
    setActiveItem(null);
    setJoinError(null);
  }

  if (room) {
    return (
      <div className="h-screen w-screen bg-zinc-900">
        <VideoRoom roomUrl={room.roomUrl} token={room.token} onLeave={handleLeave} />
      </div>
    );
  }

  const pending = queue.filter((q) => q.status === "agendado" || q.status === "em_andamento");

  return (
    <div className="min-h-screen bg-brand-bg px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-facilitta.png"
            alt="Facilitta Saúde"
            className="mx-auto mb-3 h-14 w-14 rounded-xl"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <h1 className="text-2xl font-semibold text-brand-navy">
            facilitta<span className="text-brand-teal-dark"> saúde</span>
          </h1>
          {doctorInfo && (
            <p className="mt-1 text-sm text-zinc-500">
              Cabine de atendimento — {doctorInfo.name}
              {doctorInfo.specialty ? ` · ${doctorInfo.specialty}` : ""}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-sm text-zinc-400">Carregando fila...</p>
        ) : loadError ? (
          <p className="text-center text-sm text-red-600">{loadError}</p>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
            <p className="text-sm text-zinc-500">Nenhum paciente na fila no momento.</p>
            <p className="mt-1 text-xs text-zinc-400">
              Aguarde a atendente adicionar o próximo atendimento.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleJoin(item)}
                  disabled={joining}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl border-2 bg-white px-5 py-4 text-left shadow-sm transition hover:border-brand-teal-dark disabled:opacity-50 ${
                    index === 0 ? "border-brand-teal-dark" : "border-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="shrink-0 rounded-full bg-brand-navy px-3 py-1.5 text-sm font-semibold text-white">
                      {index + 1}º
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-zinc-800">
                        {item.patients?.full_name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {item.patients?.cpf ? `CPF ${item.patients.cpf}` : "sem CPF cadastrado"}
                        {item.specialties?.name ? ` · ${item.specialties.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-brand-teal/15 px-3 py-2 text-xs font-semibold text-brand-teal-dark">
                    {joining && activeItem?.id === item.id ? "Entrando..." : "Clique para entrar"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {joinError && <p className="mt-4 text-center text-sm text-red-600">{joinError}</p>}

        <p className="mt-8 text-center text-[11px] text-zinc-400">
          Toque no seu nome completo quando for chamado pra entrar na sala de atendimento.
        </p>
      </div>
    </div>
  );
}
