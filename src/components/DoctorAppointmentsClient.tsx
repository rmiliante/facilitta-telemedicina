"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AttachmentsButton, DocumentsPanel, type DocFile } from "./DoctorDocuments";

interface AppointmentItem {
  id: string;
  scheduled_at: string;
  status: string;
  called_at: string | null;
  finished_at: string | null;
  patients: { id: string; full_name: string; cpf: string | null; documents: DocFile[] } | null;
  specialties: { name: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  agendado: "Aguardando",
  em_andamento: "Em atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

const STATUS_STYLES: Record<string, string> = {
  agendado: "bg-zinc-100 text-zinc-600",
  em_andamento: "bg-amber-100 text-amber-700",
  concluido: "bg-brand-teal/15 text-brand-teal-dark",
  cancelado: "bg-red-100 text-red-600",
  faltou: "bg-red-100 text-red-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function DoctorAppointmentsClient() {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (name.trim()) params.set("name", name.trim());
      if (cpf.trim()) params.set("cpf", cpf.trim());
      const res = await fetch(`/api/doctor/appointments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [date, name, cpf]);

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [load]);

  function toggleExpanded(patientId: string) {
    setExpandedPatientId((cur) => (cur === patientId ? null : patientId));
  }

  function updatePatientDocuments(patientId: string, files: DocFile[]) {
    setAppointments((prev) =>
      prev.map((a) => (a.patients?.id === patientId ? { ...a, patients: { ...a.patients!, documents: files } } : a))
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Nome do paciente</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Buscar por nome..."
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">CPF</span>
          <input
            type="text"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="Buscar por CPF..."
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        {(date || name || cpf) && (
          <button
            type="button"
            onClick={() => {
              setDate("");
              setName("");
              setCpf("");
            }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-zinc-400">Carregando...</p>
      ) : appointments.length === 0 ? (
        <p className="text-xs text-zinc-400">Nenhum atendimento encontrado com esses filtros.</p>
      ) : (
        <ul className="space-y-2">
          {appointments.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white shadow-sm hover:border-brand-teal-dark"
            >
              <Link
                href={`/medico/consulta/${item.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-800">
                    {item.patients?.full_name ?? "Paciente"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(item.scheduled_at)}
                    {item.specialties?.name ? ` · ${item.specialties.name}` : ""}
                    {item.patients?.cpf ? ` · CPF ${item.patients.cpf}` : ""}
                  </p>
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
      )}
    </div>
  );
}
