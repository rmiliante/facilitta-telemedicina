"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { uploadPatientDocuments } from "@/lib/uploadPatientDocument";
import VideoRoom from "./VideoRoom";
import PrescriptionPanel from "./PrescriptionPanel";
import PatientTimeline from "./PatientTimeline";
import SigningSessionBadge from "./SigningSessionBadge";
import TipoConsultaBadge, { tipoSuffix } from "./TipoConsultaBadge";
import { VitalsCompare, VitalHistoryList, useVitalSigns } from "./VitalSigns";
import { buildTimeline, type TimelineDoc } from "@/lib/patientTimeline";

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Duração entre início e fim do atendimento, formatada em minutos (ou h/min). */
function formatDuration(startIso: string, endIso: string) {
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
    ),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${rest > 0 ? ` ${rest}min` : ""}`;
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
  const [tab, setTab] = useState<
    "consulta" | "paciente" | "documentos" | "historico"
  >("consulta");
  const [notes, setNotes] = useState(appointment.doctor_notes ?? "");
  const [complaint, setComplaint] = useState(appointment.chief_complaint ?? "");
  const [conduct, setConduct] = useState(appointment.conduct ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<Date | null>(null);

  const [patientDocuments, setPatientDocuments] = useState(
    appointment.patients?.documents ?? [],
  );
  const [uploadingDoc, setUploadingDoc] = useState(false);

  async function handleUploadPatientDocument(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0 || !appointment.patient_id) return;
    setUploadingDoc(true);
    try {
      // Envio direto pro Storage (mesmo fluxo da fila/atendente) — pelo
      // servidor, arquivos acima de ~4,5 MB eram recusados.
      const files = await uploadPatientDocuments<
        (typeof patientDocuments)[number]
      >(
        `/api/doctor/patients/${appointment.patient_id}/documents`,
        selected,
        appointmentId,
      );
      setPatientDocuments(files);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Falha ao anexar pedido de exame",
      );
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  }

  async function handleRemovePatientDocument(path: string) {
    if (!confirm("Remover esse documento anexado?")) return;
    await removeDocByPath(path);
  }

  async function removeDocByPath(path: string) {
    const res = await fetch(
      `/api/doctor/patients/${appointment.patient_id}/documents`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      setPatientDocuments(data.files);
    }
  }

  const timelineAppointments = [
    {
      id: appointmentId,
      scheduled_at: appointment.scheduled_at,
      status: appointment.status,
      doctorName: appointment.doctors?.name ?? null,
      specialty: (appointment.specialties?.name ?? "") + tipoSuffix(appointment.tipo_consulta) || null,
    },
    ...history.map((h) => ({
      id: h.id,
      scheduled_at: h.scheduled_at,
      status: h.status,
      doctorName: h.doctors?.name ?? null,
      specialty: (h.specialties?.name ?? "") + tipoSuffix(h.tipo_consulta) || null,
    })),
  ];
  const currentGroup = buildTimeline(
    timelineAppointments,
    patientDocuments as TimelineDoc[],
  ).find((g) => g.key === appointmentId);
  const currentDocs: TimelineDoc[] = currentGroup
    ? [...currentGroup.medico, ...currentGroup.paciente]
    : [];

  const [videoStarted, setVideoStarted] = useState(false);
  const [room, setRoom] = useState<{ roomUrl: string; token: string } | null>(
    null,
  );
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  /** Monta um texto com os dados do paciente pra colar na prescrição. */
  function handleCopyPatientData() {
    const patient = appointment.patients;
    const lines = [
      `Nome: ${patient?.full_name || "—"}`,
      `CPF: ${patient?.cpf || "—"}`,
      `Nascimento: ${formatDate(patient?.birth_date ?? null)}`,
      `Telefone: ${patient?.phone || "—"}`,
      `E-mail: ${patient?.email || "—"}`,
      `Cidade/UF: ${
        patient?.city
          ? `${patient.city}${patient.state ? `/${patient.state}` : ""}`
          : "—"
      }`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleStartVideo() {
    setLoadingRoom(true);
    setRoomError(null);
    try {
      const res = await fetch(
        `/api/doctor/appointments/${appointmentId}/room`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRoomError(err.error ?? "Não foi possível abrir a videochamada");
        return;
      }
      const data = await res.json();
      setRoom(data);
      setVideoStarted(true);
      setAppointment((a) => ({
        ...a,
        status: "em_andamento",
        called_at: a.called_at ?? new Date().toISOString(),
      }));
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
        body: JSON.stringify({ doctorNotes: notes, chiefComplaint: complaint, conduct }),
      });
      if (res.ok) setNotesSavedAt(new Date());
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleFinish() {
    if (
      !confirm(
        "Finalizar essa consulta? Isso encerra o atendimento e registra o horário de término.",
      )
    ) {
      return;
    }
    const finishedAt = new Date().toISOString();
    const res = await fetch(`/api/doctor/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "concluido", doctorNotes: notes, chiefComplaint: complaint, conduct }),
    }).catch(() => null);
    if (!res?.ok) {
      // Antes a tela mostrava "concluído" mesmo quando não salvava.
      alert(
        "Não foi possível finalizar a consulta. Verifique a conexão e tente de novo.",
      );
      return;
    }
    setAppointment((a) => ({
      ...a,
      status: "concluido",
      finished_at: a.finished_at ?? finishedAt,
    }));
  }

  // Salva as anotações automaticamente a cada alguns segundos se mudou algo.
  useEffect(() => {
    if (
      notes === (appointment.doctor_notes ?? "") &&
      complaint === (appointment.chief_complaint ?? "") &&
      conduct === (appointment.conduct ?? "")
    ) {
      return;
    }
    const t = setTimeout(handleSaveNotes, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, complaint, conduct]);

  const patient = appointment.patients;

  return (
    <div className="flex h-screen flex-col bg-brand-bg">
      <div className="flex items-center justify-between border-b border-brand-navy bg-brand-navy px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href="/medico"
            className="text-white/70 hover:text-white"
            title="Voltar pra agenda"
          >
            ←
          </Link>
          <div>
            <p className="text-sm font-medium text-white">
              {patient?.full_name ?? "Paciente"}
            </p>
            <p className="text-xs text-white/60">
              {formatDateTime(appointment.scheduled_at)}
              {appointment.specialties?.name
                ? ` · ${appointment.specialties.name}`
                : ""}
              {appointment.tipo_consulta && (
                <span className="ml-2 align-middle">
                  <TipoConsultaBadge tipo={appointment.tipo_consulta} dark />
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SigningSessionBadge />
          {appointment.status === "concluido" &&
            appointment.called_at &&
            appointment.finished_at && (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/70">
                {formatTime(appointment.called_at)}–
                {formatTime(appointment.finished_at)} ·{" "}
                {formatDuration(appointment.called_at, appointment.finished_at)}
              </span>
            )}
          {appointment.status === "em_andamento" && appointment.called_at && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/70">
              Iniciado às {formatTime(appointment.called_at)}
            </span>
          )}
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
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
              {roomError && (
                <p className="mt-3 text-sm text-red-400">{roomError}</p>
              )}
            </div>
          ) : room ? (
            <VideoRoom roomUrl={room.roomUrl} token={room.token} />
          ) : null}
        </div>

        {/* Painel do paciente: ações fixas no topo e abas com rolagem própria */}
        <aside className="flex h-[60vh] min-h-0 w-full shrink-0 flex-col border-t border-zinc-200 bg-white md:h-auto md:w-[420px] md:border-l md:border-t-0">
          <PrescriptionPanel
            appointmentId={appointmentId}
            patientName={appointment.patients?.full_name ?? "Paciente"}
            onIssued={(doc) => setPatientDocuments((prev) => [...prev, doc])}
          />

          <div className="flex shrink-0 border-b border-zinc-200 px-1">
            <TabButton
              active={tab === "consulta"}
              onClick={() => setTab("consulta")}
            >
              Consulta
            </TabButton>
            <TabButton
              active={tab === "paciente"}
              onClick={() => setTab("paciente")}
            >
              Paciente
            </TabButton>
            <TabButton
              active={tab === "documentos"}
              onClick={() => setTab("documentos")}
            >
              Documentos ({currentDocs.length})
            </TabButton>
            <TabButton
              active={tab === "historico"}
              onClick={() => setTab("historico")}
            >
              Histórico ({history.length})
            </TabButton>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {tab === "consulta" && (
              <div className="space-y-4">
                <VitalsCompare endpoint={`/api/doctor/appointments/${appointmentId}/vitals`} />

                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Queixa principal
                    </span>
                    <input
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      onBlur={handleSaveNotes}
                      maxLength={500}
                      placeholder="Ex.: dor de cabeça há 3 dias"
                      className="w-full rounded-md border border-zinc-300 px-2.5 py-2 text-sm outline-none focus:border-brand-teal-dark"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Conduta
                    </span>
                    <textarea
                      value={conduct}
                      onChange={(e) => setConduct(e.target.value)}
                      onBlur={handleSaveNotes}
                      rows={3}
                      maxLength={3000}
                      placeholder="Ex.: prescrito analgésico, solicitado hemograma, retorno em 15 dias"
                      className="w-full rounded-md border border-zinc-300 p-2.5 text-sm outline-none focus:border-brand-teal-dark"
                    />
                  </label>
                  <p className="text-[10px] text-zinc-400">Aparecem no histórico do paciente nas próximas consultas.</p>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Anotações da consulta
                    </p>
                    {savingNotes ? (
                      <span className="text-[10px] text-zinc-400">
                        Salvando...
                      </span>
                    ) : (
                      notesSavedAt && (
                        <span className="text-[10px] text-zinc-400">
                          Salvo às{" "}
                          {notesSavedAt.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )
                    )}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleSaveNotes}
                    rows={8}
                    placeholder="Evolução, condutas, observações..."
                    className="w-full rounded-md border border-zinc-300 p-2.5 text-sm outline-none focus:border-brand-teal-dark"
                  />
                  <p className="mt-1 text-[10px] text-zinc-400">
                    Salva sozinho ao clicar fora do campo.
                  </p>
                </div>
              </div>
            )}

            {tab === "paciente" && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    onClick={handleCopyPatientData}
                    className="rounded-md border border-brand-teal-dark px-2.5 py-1 text-[11px] font-medium text-brand-teal-dark hover:bg-brand-teal/10"
                    title="Copiar dados do paciente para colar na prescrição"
                  >
                    {copied ? "Copiado!" : "Copiar dados"}
                  </button>
                </div>
                <InfoRow label="Nome completo" value={patient?.full_name} />
                <InfoRow label="CPF" value={patient?.cpf} />
                <InfoRow
                  label="Nascimento"
                  value={formatDate(patient?.birth_date ?? null)}
                />
                <InfoRow label="Telefone" value={patient?.phone} />
                <InfoRow label="E-mail" value={patient?.email} />
                <InfoRow
                  label="Cidade/UF"
                  value={
                    patient?.city
                      ? `${patient.city}${patient.state ? `/${patient.state}` : ""}`
                      : null
                  }
                />
                <InfoRow label="Observações da equipe" value={patient?.notes} />
              </div>
            )}

            {tab === "documentos" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Documentos desta consulta
                  </p>
                  <label className="cursor-pointer">
                    <span className="inline-flex h-7 items-center rounded-md bg-brand-teal/15 px-2.5 text-[11px] font-semibold text-brand-teal-dark hover:bg-brand-teal/25">
                      {uploadingDoc ? "Enviando..." : "+ Anexar"}
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={handleUploadPatientDocument}
                      disabled={uploadingDoc}
                      className="hidden"
                    />
                  </label>
                </div>
                <PatientTimeline
                  appointments={timelineAppointments.filter(
                    (a) => a.id === appointmentId,
                  )}
                  documents={currentDocs}
                  currentAppointmentId={appointmentId}
                  compact
                  onRemove={(d) => handleRemovePatientDocument(d.path)}
                />
                <p className="text-[11px] text-zinc-400">
                  O que você anexa aqui fica em &quot;Do médico&quot;. Receitas,
                  pedidos e atestados emitidos entram sozinhos e vão para a
                  impressão da atendente.
                </p>
              </div>
            )}

            {tab === "historico" && (
              <div className="space-y-4">
                <HistoryVitals appointmentId={appointmentId} />
              <PatientTimeline
                appointments={timelineAppointments}
                documents={patientDocuments as TimelineDoc[]}
                currentAppointmentId={appointmentId}
                showClinical
                renderDetails={(id) => {
                  const h = history.find((x) => x.id === id);
                  if (!h) return null;
                  return (
                    <div className="mt-2 space-y-1 rounded-md bg-zinc-50 px-3 py-2 text-xs">
                      {h.called_at && h.finished_at && (
                        <p className="text-zinc-500">
                          {formatDuration(h.called_at, h.finished_at)} de
                          atendimento
                        </p>
                      )}
                      {h.chief_complaint && (
                        <p className="text-zinc-700">
                          <span className="font-semibold">Queixa:</span> {h.chief_complaint}
                        </p>
                      )}
                      {h.conduct && (
                        <p className="whitespace-pre-wrap text-zinc-700">
                          <span className="font-semibold">Conduta:</span> {h.conduct}
                        </p>
                      )}
                      {h.doctor_notes && (
                        <p className="whitespace-pre-wrap text-zinc-700">
                          {h.doctor_notes}
                        </p>
                      )}
                      {h.prescription_url && (
                        <a
                          href={h.prescription_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-brand-teal-dark underline"
                        >
                          Ver receita
                        </a>
                      )}
                      {h.memed_prescription_summary && (
                        <p className="text-brand-teal-dark">
                          {h.memed_prescription_summary}
                        </p>
                      )}
                      {!h.doctor_notes &&
                        !h.chief_complaint &&
                        !h.conduct &&
                        !h.prescription_url &&
                        !h.memed_prescription_summary &&
                        !(h.called_at && h.finished_at) && (
                          <p className="text-zinc-400">
                            Sem anotações registradas.
                          </p>
                        )}
                    </div>
                  );
                }}
              />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 whitespace-nowrap border-b-2 px-2 py-2 text-[11px] font-semibold transition-colors ${
        active
          ? "border-brand-teal-dark text-brand-navy"
          : "border-transparent text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="text-xs">
      <span className="block font-medium text-zinc-500">{label}</span>
      <span className="block text-zinc-800">{value || "—"}</span>
    </div>
  );
}

/** Todas as aferições do paciente, no topo da aba Histórico. */
function HistoryVitals({ appointmentId }: { appointmentId: string }) {
  const { items, loading } = useVitalSigns(`/api/doctor/appointments/${appointmentId}/vitals`);
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        Aferições de sinais vitais{items.length > 0 ? ` (${items.length})` : ""}
      </p>
      <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
        {loading ? <p className="text-xs text-zinc-400">Carregando...</p> : <VitalHistoryList items={items} />}
      </div>
    </div>
  );
}
