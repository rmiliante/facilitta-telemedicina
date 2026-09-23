"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VideoRoom from "./VideoRoom";
import type { AppointmentDetail, HistoryItem } from "@/lib/appointments";

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function ConsultationClient({
  appointmentId,
  initialAppointment,
  initialHistory,
}: {
  appointmentId: string;
  initialAppointment: AppointmentDetail;
  initialHistory: HistoryItem[];
}) {
  const [appointment, setAppointment] = useState(initialAppointment);
  const [history] = useState(initialHistory);
  const [tab, setTab] = useState<"dados" | "historico">("dados");
  const [notes, setNotes] = useState(appointment.doctor_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<Date | null>(null);

  const [videoStarted, setVideoStarted] = useState(false);
  const [room, setRoom] = useState<{ roomUrl: string; token: string } | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  async function handleStartVideo() {
    setLoadingRoom(true);
    setRoomError(null);
    try {
      const res = await fetch(`/api/doctor/appointments/${appointmentId}/room`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRoomError(err.error ?? "Não foi possível abrir a videochamada");
        return;
      }
      const data = await res.json();
      setRoom(data);
      setVideoStarted(true);
      setAppointment((a) => ({ ...a, status: "em_andamento" }));
    } finally {
      setLoadingRoom(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/doctor/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorNotes: notes }),
      });
      if (res.ok) setNotesSavedAt(new Date());
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleFinish() {
    await fetch(`/api/doctor/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "concluido", doctorNotes: notes }),
    });
    setAppointment((a) => ({ ...a, status: "concluido" }));
  }

  // Salva as anotações automaticamente a cada alguns segundos se mudou algo.
  useEffect(() => {
    if (notes === (appointment.doctor_notes ?? "")) return;
    const t = setTimeout(handleSaveNotes, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const patient = appointment.patients;

  return (
    <div className="flex h-screen flex-col bg-brand-bg">
      <div className="flex items-center justify-between border-b border-brand-navy bg-brand-navy px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/medico" className="text-white/70 hover:text-white" title="Voltar pra agenda">
            ←
          </Link>
          <div>
            <p className="text-sm font-medium text-white">
              {patient?.full_name ?? "Paciente"}
            </p>
            <p className="text-xs text-white/60">
              {formatDateTime(appointment.scheduled_at)}
              {appointment.specialties?.name ? ` · ${appointment.specialties.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80">
            {STATUS_LABELS[appointment.status] ?? appointment.status}
          </span>
          {appointment.status !== "concluido" && (
            <button
              onClick={handleFinish}
              className="rounded-md bg-brand-teal px-3 py-1.5 text-xs font-medium text-brand-navy hover:opacity-90"
            >
              Finalizar consulta
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Vídeo */}
        <div className="relative flex flex-1 items-center justify-center bg-zinc-900">
          {!videoStarted ? (
            <div className="text-center">
              <button
                onClick={handleStartVideo}
                disabled={loadingRoom}
                className="rounded-md bg-brand-teal px-5 py-2.5 text-sm font-medium text-brand-navy disabled:opacity-50"
              >
                {loadingRoom ? "Preparando sala..." : "Iniciar videochamada"}
              </button>
              {roomError && <p className="mt-3 text-sm text-red-400">{roomError}</p>}
            </div>
          ) : room ? (
            <VideoRoom roomUrl={room.roomUrl} token={room.token} />
          ) : null}
        </div>

        {/* Painel do paciente */}
        <aside className="flex w-full shrink-0 flex-col overflow-hidden border-t border-zinc-200 bg-white md:w-96 md:border-l md:border-t-0">
          <div className="flex border-b border-zinc-200">
            <button
              onClick={() => setTab("dados")}
              className={`flex-1 px-3 py-2.5 text-xs font-medium ${
                tab === "dados"
                  ? "border-b-2 border-brand-teal-dark text-brand-navy"
                  : "text-zinc-500"
              }`}
            >
              Dados do paciente
            </button>
            <button
              onClick={() => setTab("historico")}
              className={`flex-1 px-3 py-2.5 text-xs font-medium ${
                tab === "historico"
                  ? "border-b-2 border-brand-teal-dark text-brand-navy"
                  : "text-zinc-500"
              }`}
            >
              Histórico ({history.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === "dados" ? (
              <div className="space-y-3">
                <InfoRow label="Nome completo" value={patient?.full_name} />
                <InfoRow label="CPF" value={patient?.cpf} />
                <InfoRow label="Nascimento" value={formatDate(patient?.birth_date ?? null)} />
                <InfoRow label="Telefone" value={patient?.phone} />
                <InfoRow label="E-mail" value={patient?.email} />
                <InfoRow
                  label="Cidade/UF"
                  value={
                    patient?.city ? `${patient.city}${patient.state ? `/${patient.state}` : ""}` : null
                  }
                />
                <InfoRow label="Observações da equipe" value={patient?.notes} />
              </div>
            ) : (
              <ul className="space-y-2">
                {history.length === 0 && (
                  <p className="text-xs text-zinc-400">Primeira consulta desse paciente.</p>
                )}
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border border-zinc-200 p-2.5 text-xs">
                    <p className="font-medium text-zinc-700">
                      {formatDateTime(h.scheduled_at)}
                      {h.specialties?.name ? ` · ${h.specialties.name}` : ""}
                    </p>
                    <p className="mt-0.5 text-zinc-500">
                      {STATUS_LABELS[h.status] ?? h.status}
                    </p>
                    {h.doctor_notes && (
                      <p className="mt-1 whitespace-pre-wrap text-zinc-600">{h.doctor_notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-zinc-200 p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-600">Anotações da consulta</span>
              {savingNotes ? (
                <span className="text-[10px] text-zinc-400">Salvando...</span>
              ) : (
                notesSavedAt && (
                  <span className="text-[10px] text-zinc-400">
                    Salvo às {notesSavedAt.toLocaleTimeString("pt-BR")}
                  </span>
                )
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              rows={5}
              placeholder="Evolução, condutas, observações..."
              className="w-full rounded-md border border-zinc-300 p-2 text-xs outline-none focus:border-brand-teal-dark"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="text-xs">
      <span className="block font-medium text-zinc-500">{label}</span>
      <span className="block text-zinc-800">{value || "—"}</span>
    </div>
  );
}
