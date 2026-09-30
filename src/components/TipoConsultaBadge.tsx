/** Selo "Rotina" / "Retorno" da consulta e o seletor usado nos cadastros. */
export const TIPO_LABELS: Record<string, string> = { rotina: "Rotina", retorno: "Retorno" };

export function tipoSuffix(tipo?: string | null): string {
  return tipo && TIPO_LABELS[tipo] ? ` · ${TIPO_LABELS[tipo]}` : "";
}

export default function TipoConsultaBadge({ tipo, dark = false }: { tipo?: string | null; dark?: boolean }) {
  if (!tipo || !TIPO_LABELS[tipo]) return null;
  const style =
    tipo === "retorno"
      ? dark
        ? "bg-white/15 text-white"
        : "bg-violet-100 text-violet-700"
      : dark
        ? "bg-brand-teal/25 text-brand-teal"
        : "bg-brand-teal/15 text-brand-teal-dark";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${style}`}>
      {TIPO_LABELS[tipo]}
    </span>
  );
}

export const TIPO_OPTIONS = [
  { value: "rotina", label: "Rotina (primeiro atendimento)" },
  { value: "retorno", label: "Retorno de consulta" },
];

/** Seletor obrigatório ao agendar / colocar na fila (admin e atendente). */
export function TipoConsultaChoice({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIPO_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            value === o.value
              ? "border-brand-teal-dark bg-brand-teal/15 text-brand-navy"
              : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          {value === o.value ? "● " : "○ "}
          {o.label}
        </button>
      ))}
    </div>
  );
}
