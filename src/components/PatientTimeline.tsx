"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  buildTimeline,
  type TimelineAppointment,
  type TimelineDoc,
} from "@/lib/patientTimeline";
import { downloadFile, fileAction } from "@/lib/printPdf";

const KIND_LABEL = {
  receita: "Receita",
  exame: "Pedido de exame",
  atestado: "Atestado",
} as const;
const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendada",
  em_andamento: "Em andamento",
  concluido: "Concluída",
  cancelado: "Cancelada",
  faltou: "Faltou",
};

type Filter = "todos" | "medico" | "paciente";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fileType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext))
    return "Imagem";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "Word";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "Planilha";
  if (ext === "txt") return "Texto";
  return ext.toUpperCase() || "Arquivo";
}

export interface PatientTimelineProps {
  appointments: TimelineAppointment[];
  documents: TimelineDoc[];
  /** Mostra anotações clínicas da consulta (médico e admin; a recepção não vê). */
  showClinical?: boolean;
  onPrint?: (doc: TimelineDoc) => void;
  onRemove?: (doc: TimelineDoc) => void;
  /** Destaca a consulta atual (tela do médico). */
  currentAppointmentId?: string;
  /** Detalhes extras da consulta (ex.: sinais vitais e duração, no admin). */
  renderDetails?: (appointmentId: string) => ReactNode;
  /** Só as colunas de documentos (sem filtros nem cabeçalho da consulta). */
  compact?: boolean;
}

/**
 * Histórico do paciente agrupado por consulta (data), separando o que o
 * médico emitiu/anexou do que o paciente trouxe (anexado pela recepção).
 */
export default function PatientTimeline({
  appointments,
  documents,
  showClinical = false,
  onPrint,
  onRemove,
  currentAppointmentId,
  renderDetails,
  compact = false,
}: PatientTimelineProps) {
  const [filter, setFilter] = useState<Filter>("todos");
  const groups = useMemo(
    () => buildTimeline(appointments, documents),
    [appointments, documents],
  );
  const counts = useMemo(() => {
    let medico = 0;
    let paciente = 0;
    for (const g of groups) {
      medico += g.medico.length;
      paciente += g.paciente.length;
    }
    return { medico, paciente };
  }, [groups]);

  if (compact) {
    const medico = groups.flatMap((g) => g.medico);
    const paciente = groups.flatMap((g) => g.paciente);
    return (
      <div className="grid gap-2">
        <DocColumn
          title="Do médico"
          hint="emitidos e anexados"
          tone="medico"
          docs={medico}
          onPrint={onPrint}
          onRemove={onRemove}
        />
        <DocColumn
          title="Do paciente"
          hint="trazidos pelo paciente"
          tone="paciente"
          docs={paciente}
          onPrint={onPrint}
          onRemove={onRemove}
        />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="text-xs text-zinc-400">
        Nenhuma consulta ou documento ainda.
      </p>
    );
  }

  const chip = (value: Filter, label: string, n?: number) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        filter === value
          ? "bg-brand-navy text-white"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {label}
      {n !== undefined && <span className="ml-1 opacity-70">{n}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {chip("todos", "Tudo")}
        {chip("medico", "Do médico", counts.medico)}
        {chip("paciente", "Do paciente", counts.paciente)}
      </div>

      <ol className="relative flex flex-col gap-3 border-l-2 border-zinc-200 pl-4">
        {groups.map((g) => {
          const a = g.appointment;
          const isCurrent = a && a.id === currentAppointmentId;
          // Grupo sem consulta: mostra só a coluna que tem documento.
          const showMed =
            filter !== "paciente" && (a !== null || g.medico.length > 0);
          const showPac =
            filter !== "medico" && (a !== null || g.paciente.length > 0);
          const nothing = g.medico.length + g.paciente.length === 0;
          const empty =
            (showMed ? g.medico.length : 0) +
              (showPac ? g.paciente.length : 0) ===
            0;
          if (filter !== "todos" && empty) return null;
          return (
            <li key={g.key} className="relative">
              <span
                className={`absolute -left-[23px] top-4 h-3 w-3 rounded-full ring-4 ring-white ${
                  a ? "bg-brand-teal-dark" : "bg-zinc-300"
                }`}
              />
              <div
                className={`rounded-lg border bg-white p-4 ${isCurrent ? "border-brand-teal-dark" : "border-zinc-200"}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold text-brand-navy">
                    {a
                      ? `Consulta de ${fmtDate(a.scheduled_at)}`
                      : `Sem consulta vinculada · ${fmtDate(g.date)}`}
                    {a && (
                      <span className="font-normal text-zinc-500">
                        {" "}
                        · {fmtTime(a.scheduled_at)}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="ml-2 rounded-full bg-brand-teal/15 px-2 py-0.5 text-[10px] font-semibold text-brand-teal-dark">
                        consulta atual
                      </span>
                    )}
                  </p>
                  {a?.status && (
                    <span className="text-[11px] text-zinc-500">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  )}
                </div>
                {a && (a.doctorName || a.specialty) && (
                  <p className="mt-0.5 text-xs text-zinc-600">
                    {[a.doctorName, a.specialty].filter(Boolean).join(" · ")}
                  </p>
                )}
                {a && renderDetails
                  ? renderDetails(a.id)
                  : showClinical &&
                    a?.doctorNotes && (
                      <p className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                        {a.doctorNotes}
                      </p>
                    )}

                {nothing ? (
                  <p className="mt-2 text-[11px] text-zinc-400">
                    Nenhum documento nesta consulta.
                  </p>
                ) : (
                  <div
                    className={`mt-3 grid gap-3 ${showMed && showPac ? "sm:grid-cols-2" : ""}`}
                  >
                    {showMed && (
                      <DocColumn
                        title="Do médico"
                        hint="receitas, pedidos e atestados"
                        tone="medico"
                        docs={g.medico}
                        onPrint={onPrint}
                        onRemove={onRemove}
                      />
                    )}
                    {showPac && (
                      <DocColumn
                        title="Do paciente"
                        hint="exames e documentos trazidos"
                        tone="paciente"
                        docs={g.paciente}
                        onPrint={onPrint}
                        onRemove={onRemove}
                      />
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DocColumn({
  title,
  hint,
  tone,
  docs,
  onPrint,
  onRemove,
}: {
  title: string;
  hint: string;
  tone: "medico" | "paciente";
  docs: TimelineDoc[];
  onPrint?: (doc: TimelineDoc) => void;
  onRemove?: (doc: TimelineDoc) => void;
}) {
  const head =
    tone === "medico"
      ? "bg-brand-navy/5 text-brand-navy"
      : "bg-amber-50 text-amber-900";
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200">
      <div
        className={`flex items-baseline justify-between gap-2 px-3 py-1.5 ${head}`}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide">
          {title}{" "}
          <span className="font-normal normal-case tracking-normal opacity-70">
            · {hint}
          </span>
        </p>
        <span className="text-[11px] font-semibold opacity-70">
          {docs.length}
        </span>
      </div>
      {docs.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-zinc-400">Nenhum.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {docs.map((d) => (
            <li key={d.path} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  {d.kind && (
                    <span className="shrink-0 rounded bg-brand-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {KIND_LABEL[d.kind]}
                    </span>
                  )}
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs font-medium text-brand-teal-dark hover:underline"
                    >
                      {d.name}
                    </a>
                  ) : (
                    <span className="truncate text-xs text-zinc-700">
                      {d.name}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  {fileType(d.name)} · {fmtTime(d.uploaded_at)}
                  {d.author ? ` · ${d.author}` : ""}
                  {d.signed ? " · assinado digitalmente" : ""}
                  {d.needs_print
                    ? " · aguardando impressão"
                    : d.printed_at
                      ? " · impresso"
                      : ""}
                </p>
              </div>
              {d.url && fileAction(d.name) === "print" && onPrint && (
                <button
                  type="button"
                  onClick={() => onPrint(d)}
                  className="shrink-0 rounded border border-brand-navy px-2 py-0.5 text-[10px] font-semibold text-brand-navy hover:bg-brand-navy hover:text-white"
                >
                  Imprimir
                </button>
              )}
              {d.url && fileAction(d.name) === "download" && (
                <button
                  type="button"
                  onClick={() => downloadFile(d.url!, d.name)}
                  title="Abra no Word ou no Excel para imprimir"
                  className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Baixar
                </button>
              )}
              {onRemove && !d.signed && (
                <button
                  type="button"
                  onClick={() => onRemove(d)}
                  className="shrink-0 text-[10px] text-red-500 hover:underline"
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
