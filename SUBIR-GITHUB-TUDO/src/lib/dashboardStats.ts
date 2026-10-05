/** Utilitários dos dashboards de Captação e Médicos (agregações em memória). */

export function normalizeLabel(value: string | null | undefined, fallback = "Não informado"): string {
  const v = (value ?? "").trim().replace(/\s+/g, " ");
  if (!v || v === "—" || v === "-") return fallback;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** Agrupa tipos de profissional que chegam do site em categorias curtas. */
export function professionGroup(value: string | null | undefined): string {
  const v = (value ?? "").toLowerCase();
  if (!v.trim()) return "Médico(a)";
  if (/m[eé]dic/.test(v)) return "Médico(a)";
  if (/psic[oó]log/.test(v)) return "Psicólogo(a)";
  if (/enferm/.test(v)) return "Enfermagem";
  if (/farmac/.test(v)) return "Farmacêutico(a)";
  if (/nutri/.test(v)) return "Nutricionista";
  if (/fisio/.test(v)) return "Fisioterapeuta";
  return "Outras";
}

/** Tenta achar "N anos" de experiência nos textos do candidato. */
export function parseExperienceYears(...texts: (string | null | undefined)[]): number | null {
  for (const t of texts) {
    if (!t) continue;
    const m = t.match(/(\d{1,2})\s*(?:\+\s*)?anos?\s+de\s+(?:experi[eê]ncia|atua[cç][aã]o|pr[aá]tica|forma[cç][aã]o)/i)
      ?? t.match(/(?:experi[eê]ncia|atuo|atuando|atua[cç][aã]o)[^.\d]{0,40}?(\d{1,2})\s*anos?/i)
      ?? t.match(/(?:h[aá]|com)\s+(\d{1,2})\s*anos?/i);
    if (m) {
      const n = Number(m[1]);
      if (n >= 0 && n <= 60) return n;
    }
  }
  return null;
}

export function experienceBucket(years: number | null): string {
  if (years == null) return "Não informado";
  if (years <= 2) return "Até 2 anos";
  if (years <= 10) return "3 a 10 anos";
  return "Mais de 10 anos";
}

export const EXPERIENCE_ORDER = ["Até 2 anos", "3 a 10 anos", "Mais de 10 anos", "Não informado"];

export function countBy<T>(items: T[], key: (item: T) => string): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function monthsBetween(fromIso: string, to = new Date()): number {
  const from = new Date(fromIso);
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}
