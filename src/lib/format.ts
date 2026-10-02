/**
 * Utilitários compartilhados de data (fuso de São Paulo), CPF e busca.
 */

/**
 * Data de hoje (YYYY-MM-DD) no fuso de São Paulo. As consultas são
 * gravadas ao meio-dia UTC do dia marcado, então a "fila de hoje" tem
 * que usar o dia local — usar o dia UTC fazia a fila do médico e a
 * cabine pularem pro dia seguinte a partir das 21h.
 */
export function todayKeySaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Início e fim (ISO, UTC) do dia `YYYY-MM-DD`, no mesmo padrão em que as consultas são gravadas. */
export function utcDayRange(dayKey: string): { start: string; end: string } {
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Formata CPF como 000.000.000-00 quando tem 11 dígitos; senão devolve o texto como veio. */
export function formatCpf(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value.trim();
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Padrão ILIKE que acha o CPF com ou sem pontuação: "62041525568"
 * encontra tanto "62041525568" quanto "620.415.255-68" (e buscas
 * parciais, como "620415").
 */
export function cpfLikePattern(search: string): string | null {
  const digits = search.replace(/\D/g, "");
  if (!digits) return null;
  return `%${digits.split("").join("%")}%`;
}

/**
 * Remove caracteres que quebram o filtro `.or()` do Supabase (vírgula,
 * parênteses, aspas) — antes, buscar "Silva, Maria" dava erro 500.
 */
export function sanitizeSearch(search: string): string {
  return search.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
}

/** Mostra só parte do CPF (ex: ***.415.255-**), pra telas públicas. */
export function maskCpf(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/** true se for uma data válida no formato YYYY-MM-DD (vem do navegador). */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Só aceita links http(s) — um link "javascript:..." colado no campo
 * da receita rodaria código na página do paciente ao ser clicado.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
