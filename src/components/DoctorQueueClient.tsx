"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AttachmentsButton, DocumentsPanel, type DocFile } from "./DoctorDocuments";

interface QueueItem {
  id: string;
  scheduled_at: string;
  status: string;
  queue_position: number | null;
  called_at: string | null;
  patient_joined_at: string | null;
  patients: { id: string; full_name: string; documents: DocFile[] } | null;
  specialties: { name: string } | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS: Record<string, string> = {
  agendado: "Aguardando",
  em_andamento: "Em atendimento",
  concluido: "Concluído",
  faltou: "Faltou",
};

const STATUS_STYLES: Record<string, string> = {
  agendado: "bg-zinc-100 text-zinc-600",
  em_andamento: "bg-amber-100 text-amber-700",
  concluido: "bg-brand-teal/15 text-brand-teal-dark",
  faltou: "bg-red-100 text-red-600",
};

const POLL_INTERVAL_MS = 8000;

export default function DoctorQueueClient() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/doctor/queue");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setQueue(data.queue);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function toggleExpanded(patientId: string) {
    setExpandedPatientId((cur) => (cur === patientId ? null : patientId));
  }

  function updatePatientDocuments(patientId: string, files: DocFile[]) {
    setQueue((prev) =>
      prev.map((q) => (q.patients?.id === patientId ? { ...q, patients: { ...q.patients!, documents: files } } : q))
    );
  }

  const pending = queue.filter((q) => q.status === "agendado" || q.status === "em_andamento");
  const finished = queue.filter((q) => q.status === "concluido" || q.status === "faltou");
  const waiting = pending.filter((q) => q.status === "agendado");
  // Quem já foi chamado (em_andamento) tem prioridade no card em
  // destaque, mesmo que não fosse o próximo da fila por posição —
  // é quem a atendente decidiu iniciar o atendimento agora.
  const current = pending.find((q) => q.status === "em_andamento");
  const next = current ?? waiting[0];

  if (loading) {
    return <p className="text-xs text-zinc-400">Carregando fila...</p>;
  }

  if (queue.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center">
        <p className="text-sm text-zinc-500">Nenhum paciente na fila de hoje ainda.</p>
        <p className="mt-1 text-xs text-zinc-400">
          A atendente vai adicionar pacientes conforme forem chegando.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {next && (
        <div className="rounded-lg border-2 border-brand-teal-dark bg-white p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-teal-dark">
            {next.status === "em_andamento" ? "Em atendimento agora" : "Próximo da fila"}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-zinc-800">{next.patients?.full_name}</p>
              <p className="text-xs text-zinc-500">
                {next.specialties?.name ?? ""}
                {next.status === "em_andamento" && next.called_at
                  ? ` · iniciado às ${formatTime(next.called_at)}`
                  : ""}
              </p>
              {next.patient_joined_at && next.status === "agendado" && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Paciente já está na sala aguardando
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {next.patients?.id && (
                <AttachmentsButton
                  patientId={next.patients.id}
                  count={next.patients.documents?.length ?? 0}
                  isOpen={expandedPatientId === next.patients.id}
                  onToggle={toggleExpanded}
                />
              )}
              <Link
                href={`/medico/consulta/${next.id}`}
                className="rounded-md bg-brand-navy px-5 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Entrar na consulta
              </Link>
            </div>
          </div>
          {next.patients?.id && expandedPatientId === next.patients.id && (
            <DocumentsPanel
              patientId={next.patients.id}
              onChange={(files) => updatePatientDocuments(next.patients!.id, files)}
            />
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">
          Fila de hoje {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="text-xs text-zinc-400">Nenhum paciente aguardando.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((item, index) => (
              <li
                key={item.id}
                className={`rounded-lg border bg-white shadow-sm ${
                  index === 0 ? "border-brand-teal-dark" : "border-zinc-200"
                }`}
              >
                <Link
                  href={`/medico/consulta/${item.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-zinc-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-full bg-brand-navy px-2.5 py-1 text-xs font-semibold text-white">
                      {index + 1}º
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-800">
                        {item.patients?.full_name ?? "Paciente"}
                      </p>
                      <p className="text-xs text-zinc-500">{item.specialties?.name ?? ""}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.patient_joined_at && item.status === "agendado" && (
                      <span
                        className="h-2 w-2 rounded-full bg-emerald-500"
                        title="Paciente já está na sala"
                      />
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_STYLES[item.status] ?? STATUS_STYLES.agendado
                      }`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    {item.patients?.id && (
                      <AttachmentsButton
                        patientId={item.patients.id}
                        count={item.patients.documents?.length ?? 0}
                        isOpen={expandedPatientId === item.patients.id}
                        onToggle={toggleExpanded}
                      />
                    )}
                  </div>
                </Link>
                {item.patients?.id && expandedPatientId === item.patients.id && (
                  <div className="px-4 pb-3">
                    <DocumentsPanel
                      patientId={item.patients.id}
                      onChange={(files) => updatePatientDocuments(item.patients!.id, files)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {finished.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">
            Já atendidos hoje ({finished.length})
          </h2>
          <ul className="space-y-2">
            {finished.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-zinc-200 bg-white shadow-sm hover:border-brand-teal-dark"
              >
                <Link
                  href={`/medico/consulta/${item.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-800">
                      {item.patients?.full_name ?? "Paciente"}
                    </p>
                    <p className="text-xs text-zinc-500">{item.specialties?.name ?? ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_STYLES[item.status] ?? STATUS_STYLES.agendado
                      }`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    {item.patients?.id && (
                      <AttachmentsButton
                        patientId={item.patients.id}
                        count={item.patients.documents?.length ?? 0}
                        isOpen={expandedPatientId === item.patients.id}
                        onToggle={toggleExpanded}
                      />
                    )}
                  </div>
                </Link>
                {item.patients?.id && expandedPatientId === item.patients.id && (
                  <div className="px-4 pb-3">
                    <DocumentsPanel
                      patientId={item.patients.id}
                      onChange={(files) => updatePatientDocuments(item.patients!.id, files)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
