"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import VideoRoom from "./VideoRoom";
import type { AppointmentDetail, HistoryItem } from "@/lib/appointments";

// Tipos mínimos do script global da Memed (carregado dinamicamente —
// ver handleOpenMemed). Docs: https://doc.memed.com.br/docs/primeiros-passos/
interface MemedPrescricaoEvent {
  prescricao?: { medicamentos?: unknown[]; data?: string };
  medicamentos?: unknown[];
  data?: string;
}
interface MemedHub {
  command: { send: (module: string, command: string, data: unknown) => Promise<void> };
  module: { show: (module: string) => Promise<void> };
  event: { add: (name: string, cb: (data: MemedPrescricaoEvent) => void) => void };
}
interface MemedSinapse {
  event: { add: (name: string, cb: (module: { name: string }) => void) => void };
}
declare global {
  interface Window {
    MdHub?: MemedHub;
    MdSinapsePrescricao?: MemedSinapse;
  }
}

/** Converte "AAAA-MM-DD" (formato do banco) pra "DD/MM/AAAA" (formato que a Memed espera). */
function toBrDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

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
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Duração entre início e fim do atendimento, formatada em minutos (ou h/min). */
function formatDuration(startIso: string, endIso: string) {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
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
  const [tab, setTab] = useState<"dados" | "historico">("dados");
  const [notes, setNotes] = useState(appointment.doctor_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<Date | null>(null);

  const [prescriptionUrl, setPrescriptionUrl] = useState(appointment.prescription_url ?? "");
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [prescriptionSavedAt, setPrescriptionSavedAt] = useState<Date | null>(null);

  const memedInitedRef = useRef(false);
  const [memedStatus, setMemedStatus] = useState<"idle" | "loading" | "error">("idle");
  const [memedError, setMemedError] = useState<string | null>(null);
  const [memedHomologacao, setMemedHomologacao] = useState(false);

  const [patientDocuments, setPatientDocuments] = useState(appointment.patients?.documents ?? []);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  async function handleUploadPatientDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0 || !appointment.patient_id) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      selected.forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/doctor/patients/${appointment.patient_id}/documents`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setPatientDocuments(data.files);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Falha ao anexar pedido de exame");
      }
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  }

  async function handleRemovePatientDocument(path: string) {
    if (!confirm("Remover esse documento anexado?")) return;
    const res = await fetch(`/api/doctor/patients/${appointment.patient_id}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (res.ok) {
      const data = await res.json();
      setPatientDocuments(data.files);
    }
  }

  const [videoStarted, setVideoStarted] = useState(false);
  const [room, setRoom] = useState<{ roomUrl: string; token: string } | null>(null);
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
        patient?.city ? `${patient.city}${patient.state ? `/${patient.state}` : ""}` : "—"
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
        body: JSON.stringify({ doctorNotes: notes }),
      });
      if (res.ok) setNotesSavedAt(new Date());
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleSavePrescription() {
    setSavingPrescription(true);
    try {
      const res = await fetch(`/api/doctor/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescriptionUrl }),
      });
      if (res.ok) {
        setPrescriptionSavedAt(new Date());
        setAppointment((a) => ({ ...a, prescription_url: prescriptionUrl.trim() || null }));
      }
    } finally {
      setSavingPrescription(false);
    }
  }

  /** Callback da Memed quando o médico emite uma receita dentro do módulo embutido. */
  async function handlePrescricaoEmitida(data: MemedPrescricaoEvent) {
    const medicamentos = data.prescricao?.medicamentos ?? data.medicamentos ?? [];
    const dataEmissao = data.prescricao?.data ?? data.data ?? "";
    const summary = `Receita emitida pela Memed${dataEmissao ? ` em ${dataEmissao}` : ""} · ${medicamentos.length} item(ns)`;
    try {
      await fetch(`/api/doctor/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memedPrescriptionSummary: summary }),
      });
      setAppointment((a) => ({
        ...a,
        memed_prescription_summary: summary,
        memed_prescription_at: new Date().toISOString(),
      }));
    } catch {
      // Se falhar em salvar o resumo, a receita já foi emitida na Memed
      // mesmo assim — só não fica registrada aqui, sem gravidade.
    }
  }

  /**
   * Abre o módulo de prescrição da Memed embutido na tela: busca um
   * token fresco do médico (prescritor já vinculado), carrega o
   * script uma única vez por sessão e manda os dados do paciente
   * antes de mostrar a tela de prescrição.
   */
  async function handleOpenMemed() {
    setMemedStatus("loading");
    setMemedError(null);
    try {
      if (!memedInitedRef.current) {
        const tokenRes = await fetch("/api/doctor/memed-token");
        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Falha ao conectar com a Memed");
        }
        const { token, scriptUrl, homologacao } = await tokenRes.json();
        setMemedHomologacao(Boolean(homologacao));

        if (!document.getElementById("memed-sinapse-script")) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.id = "memed-sinapse-script";
            script.src = scriptUrl;
            script.setAttribute("data-token", token);
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Falha ao carregar o script da Memed"));
            document.body.appendChild(script);
          });
        }

        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(
            () => reject(new Error("A Memed demorou demais pra responder. Tente de novo.")),
            15000
          );
          const check = () => {
            if (window.MdSinapsePrescricao?.event) {
              window.MdSinapsePrescricao.event.add("core:moduleInit", (module) => {
                if (module.name === "plataforma.prescricao") {
                  clearTimeout(timeoutId);
                  window.MdHub?.event.add("prescricaoImpressa", handlePrescricaoEmitida);
                  resolve();
                }
              });
            } else {
              setTimeout(check, 150);
            }
          };
          check();
        });

        memedInitedRef.current = true;
      }

      await window.MdHub!.command.send("plataforma.prescricao", "setPaciente", {
        idExterno: patient?.id,
        nome: patient?.full_name,
        cpf: patient?.cpf || undefined,
        telefone: patient?.phone || undefined,
        email: patient?.email || undefined,
        data_nascimento: patient?.birth_date ? toBrDate(patient.birth_date) : undefined,
        cidade: patient?.city || undefined,
      });
      await window.MdHub!.module.show("plataforma.prescricao");
      setMemedStatus("idle");
    } catch (err) {
      setMemedStatus("error");
      setMemedError(err instanceof Error ? err.message : "Erro ao abrir a Memed");
    }
  }

  async function handleFinish() {
    if (!confirm("Finalizar essa consulta? Isso encerra o atendimento e registra o horário de término.")) {
      return;
    }
    const finishedAt = new Date().toISOString();
    await fetch(`/api/doctor/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "concluido", doctorNotes: notes }),
    });
    setAppointment((a) => ({ ...a, status: "concluido", finished_at: a.finished_at ?? finishedAt }));
  }

  // Salva as anotações automaticamente a cada alguns segundos se mudou algo.
  useEffect(() => {
    if (notes === (appointment.doctor_notes ?? "")) return;
    const t = setTimeout(handleSaveNotes, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Idem pro link da receita gerada na Memed.
  useEffect(() => {
    if (prescriptionUrl === (appointment.prescription_url ?? "")) return;
    const t = setTimeout(handleSavePrescription, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prescriptionUrl]);

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
          {appointment.status === "concluido" && appointment.called_at && appointment.finished_at && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/70">
              {formatTime(appointment.called_at)}–{formatTime(appointment.finished_at)} ·{" "}
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
                <div className="text-xs">
                  <span className="mb-1 block font-medium text-zinc-500">
                    Exames / documentos do paciente
                  </span>
                  {patientDocuments.length === 0 ? (
                    <p className="mb-2 text-zinc-400">Nenhum anexado ainda.</p>
                  ) : (
                    <ul className="mb-2 space-y-1">
                      {patientDocuments.map((f) => (
                        <li key={f.path} className="flex items-center justify-between gap-2">
                          {f.url ? (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-brand-teal-dark underline"
                            >
                              📎 {f.name}
                            </a>
                          ) : (
                            <span className="truncate text-zinc-400">📎 {f.name} (link indisponível)</span>
                          )}
                          <button
                            onClick={() => handleRemovePatientDocument(f.path)}
                            className="shrink-0 text-[10px] font-medium text-red-600 hover:underline"
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="inline-block cursor-pointer">
                    <span className="rounded-md bg-brand-teal/15 px-2.5 py-1 text-[11px] font-medium text-brand-teal-dark hover:bg-brand-teal/25">
                      {uploadingDoc ? "Enviando..." : "+ Anexar pedido de exame"}
                    </span>
                    <input
                      type="file"
                      multiple
                      onChange={handleUploadPatientDocument}
                      disabled={uploadingDoc}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Fica vinculado ao paciente — a atendente consegue abrir e imprimir daqui a pouco.
                  </p>
                </div>
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
                      {h.called_at && h.finished_at
                        ? ` · ${formatDuration(h.called_at, h.finished_at)} de atendimento`
                        : ""}
                    </p>
                    {h.doctor_notes && (
                      <p className="mt-1 whitespace-pre-wrap text-zinc-600">{h.doctor_notes}</p>
                    )}
                    {h.prescription_url && (
                      <a
                        href={h.prescription_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-brand-teal-dark underline"
                      >
                        Ver receita
                      </a>
                    )}
                    {h.memed_prescription_summary && (
                      <p className="mt-1 text-brand-teal-dark">{h.memed_prescription_summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-zinc-200 p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-600">Receita (Memed)</span>
              {savingPrescription ? (
                <span className="text-[10px] text-zinc-400">Salvando...</span>
              ) : (
                prescriptionSavedAt && (
                  <span className="text-[10px] text-zinc-400">
                    Link salvo às {prescriptionSavedAt.toLocaleTimeString("pt-BR")}
                  </span>
                )
              )}
            </div>

            {appointment.doctors?.memed_linked_at ? (
              <>
                <button
                  onClick={handleOpenMemed}
                  disabled={memedStatus === "loading"}
                  className="mb-1 w-full rounded-md bg-brand-navy px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {memedStatus === "loading" ? "Abrindo Memed..." : "Emitir receita (Memed)"}
                </button>
                <p className="mb-2 text-[11px] text-zinc-400">
                  Abre o módulo da Memed aqui na tela, já com os dados do paciente preenchidos.
                  {memedHomologacao && (
                    <span className="font-medium text-amber-600"> Ambiente de teste — receita não vale legalmente.</span>
                  )}
                </p>
                {memedError && <p className="mb-2 text-[11px] text-red-600">{memedError}</p>}
                {appointment.memed_prescription_summary && (
                  <p className="mb-2 rounded-md bg-brand-teal/10 px-2 py-1.5 text-[11px] text-brand-teal-dark">
                    {appointment.memed_prescription_summary}
                    {appointment.memed_prescription_at
                      ? ` · ${formatTime(appointment.memed_prescription_at)}`
                      : ""}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mb-2 text-[11px] text-zinc-400">
                  Esse médico ainda não foi vinculado à Memed (peça pra Admin vincular no
                  cadastro). Por enquanto, gere a receita com o login pessoal dele na Memed e
                  cole aqui o link.
                </p>
                <a
                  href="https://memed.com.br/login"
                  target="_blank"
                  rel="noreferrer"
                  className="mb-1 inline-block rounded-md border border-brand-teal-dark px-3 py-1.5 text-xs font-medium text-brand-teal-dark hover:bg-brand-teal/10"
                >
                  Abrir Memed ↗
                </a>
                {appointment.doctors?.memed_email && (
                  <p className="mb-2 text-[11px] text-zinc-400">
                    Login: {appointment.doctors.memed_email}
                  </p>
                )}
              </>
            )}

            <input
              type="url"
              value={prescriptionUrl}
              onChange={(e) => setPrescriptionUrl(e.target.value)}
              onBlur={handleSavePrescription}
              placeholder="Cole aqui o link da receita (opcional)"
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:border-brand-teal-dark"
            />
            {appointment.prescription_url && (
              <a
                href={appointment.prescription_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[11px] text-brand-teal-dark underline"
              >
                Abrir receita salva
              </a>
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
