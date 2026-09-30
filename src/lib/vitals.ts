/**
 * Sinais vitais — tipos e formatação compartilhados entre cliente e servidor
 * (sem imports de servidor aqui).
 */

export type VitalKey = "spo2" | "bpm" | "pa" | "peso" | "hgt";

export interface VitalSign {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  measured_at: string;
  spo2: string | null;
  bpm: string | null;
  pa: string | null;
  peso: string | null;
  hgt: string | null;
  recorded_by_name: string | null;
  recorded_by_role: string | null;
}

export const VITAL_FIELDS: { key: VitalKey; label: string; short: string; unit: string; placeholder: string }[] = [
  { key: "spo2", label: "SpO2 (%)", short: "SpO2", unit: "%", placeholder: "Ex: 98" },
  { key: "bpm", label: "BPM", short: "BPM", unit: "", placeholder: "Ex: 80" },
  { key: "pa", label: "PA (mmHg)", short: "PA", unit: "", placeholder: "Ex: 120/80" },
  { key: "peso", label: "Peso (kg)", short: "Peso", unit: "kg", placeholder: "Ex: 68,0" },
  { key: "hgt", label: "HGT (mg/dL)", short: "HGT", unit: "mg/dL", placeholder: "Ex: 95" },
];

export const VITALS_MIGRATION_WARNING =
  "Para registrar aferições, rode o arquivo supabase/migration_afericoes.sql no SQL Editor do Supabase.";

function num(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parsePa(v: string | null | undefined): [number, number] | null {
  const m = v?.match(/(\d{2,3})\s*[/xX]\s*(\d{2,3})/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Valor fora do esperado (destacado em âmbar). */
export function isAlert(key: VitalKey, value: string | null | undefined): boolean {
  if (!value) return false;
  if (key === "pa") {
    const pa = parsePa(value);
    return !!pa && (pa[0] >= 140 || pa[1] >= 90 || pa[0] < 90 || pa[1] < 60);
  }
  const n = num(value);
  if (n === null) return false;
  if (key === "spo2") return n < 95;
  if (key === "bpm") return n < 50 || n > 100;
  if (key === "hgt") return n < 70 || n > 180;
  return false;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/** Diferença entre o valor atual e o anterior, ex.: "▲6", "▼0,7", "▲12/6". */
export function vitalDelta(key: VitalKey, current: string | null, previous: string | null): string | null {
  if (!current || !previous) return null;
  if (key === "pa") {
    const a = parsePa(current);
    const b = parsePa(previous);
    if (!a || !b) return null;
    const ds = a[0] - b[0];
    const dd = a[1] - b[1];
    if (ds === 0 && dd === 0) return "=";
    const arrow = ds > 0 || (ds === 0 && dd > 0) ? "▲" : "▼";
    return `${arrow}${Math.abs(ds)}/${Math.abs(dd)}`;
  }
  const a = num(current);
  const b = num(previous);
  if (a === null || b === null) return null;
  const d = Math.round((a - b) * 10) / 10;
  if (d === 0) return "=";
  return `${d > 0 ? "▲" : "▼"}${fmt(Math.abs(d))}`;
}

export function withUnit(key: VitalKey, value: string | null | undefined): string {
  if (!value) return "—";
  const unit = VITAL_FIELDS.find((f) => f.key === key)?.unit;
  return unit ? `${value} ${unit}` : value;
}

export function formatMeasuredAt(iso: string, withYear = true): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    ...(withYear ? { year: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
}

export function formatMeasuredDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

export function recordedByLabel(v: Pick<VitalSign, "recorded_by_name" | "recorded_by_role">): string {
  const name = v.recorded_by_name || "—";
  if (v.recorded_by_role === "atendente") return `${name} (atendente)`;
  if (v.recorded_by_role === "admin") return `${name} (admin)`;
  return name;
}

/** Valor agora em "yyyy-MM-ddTHH:mm" no fuso de São Paulo, pro <input type="datetime-local">. */
export function nowLocalInput(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
