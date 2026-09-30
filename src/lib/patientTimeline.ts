/**
 * Agrupa os documentos do paciente por consulta (data do atendimento) e
 * separa a origem: emitido pelo médico x enviado pelo paciente. Sem nada
 * de servidor — usado nas telas da atendente, do médico e do admin.
 */

export type DocOrigin = "medico" | "paciente";

export interface TimelineDoc {
  path: string;
  name: string;
  uploaded_at: string;
  kind?: "receita" | "exame" | "atestado";
  signed?: boolean;
  author?: string;
  appointment_id?: string;
  /** Quem anexou: médico (emitido/anexado na consulta) ou paciente (exames trazidos, anexados pela recepção). */
  source?: DocOrigin;
  needs_print?: boolean;
  printed_at?: string;
  url?: string | null;
}

export interface TimelineAppointment {
  id: string;
  scheduled_at: string;
  status?: string;
  doctorName?: string | null;
  specialty?: string | null;
  doctorNotes?: string | null;
}

export interface TimelineGroup {
  key: string;
  /** Data de referência do grupo (ISO). */
  date: string;
  appointment: TimelineAppointment | null;
  medico: TimelineDoc[];
  paciente: TimelineDoc[];
}

export function docOrigin(doc: TimelineDoc): DocOrigin {
  if (doc.source) return doc.source;
  // Documentos antigos (antes de gravar a origem): o que o sistema emitiu
  // (receita/exame/atestado assinado) é do médico; o resto veio do paciente.
  return doc.kind || doc.signed ? "medico" : "paciente";
}

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function buildTimeline(appointments: TimelineAppointment[], docs: TimelineDoc[]): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();
  const byDay = new Map<string, TimelineAppointment>();

  for (const a of [...appointments].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))) {
    groups.set(a.id, { key: a.id, date: a.scheduled_at, appointment: a, medico: [], paciente: [] });
    // Se houver duas consultas no mesmo dia, anexos sem vínculo vão pra última.
    byDay.set(dayKey(a.scheduled_at), a);
  }

  for (const doc of docs) {
    let appt = doc.appointment_id ? appointments.find((a) => a.id === doc.appointment_id) : undefined;
    if (!appt) appt = byDay.get(dayKey(doc.uploaded_at));
    let group: TimelineGroup;
    if (appt) {
      group = groups.get(appt.id)!;
    } else {
      const k = `sem-consulta-${dayKey(doc.uploaded_at)}`;
      group = groups.get(k) ?? { key: k, date: doc.uploaded_at, appointment: null, medico: [], paciente: [] };
      groups.set(k, group);
    }
    group[docOrigin(doc)].push(doc);
  }

  for (const g of groups.values()) {
    g.medico.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    g.paciente.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}
