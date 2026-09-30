/** Selo "Rotina" / "Retorno" da consulta. */
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
