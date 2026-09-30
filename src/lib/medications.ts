import catalog from "@/data/medicamentos.json";

/**
 * Catálogo de medicamentos pra busca na receita — gerado a partir da
 * lista pública de preços CMED/Anvisa (substância, nome comercial, dose
 * e forma), sem os itens de uso restrito hospitalar. ~19 mil apresentações.
 */

function plain(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const entries: { name: string; key: string }[] = (catalog as string[]).map((name) => ({
  name,
  key: plain(name),
}));

/** Busca por palavras (todas precisam aparecer), priorizando quem começa com o termo e genéricos. */
export function searchMedications(query: string, limit = 12): string[] {
  const tokens = plain(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.join("").length < 3) return [];

  const scored: [number, number, number, string][] = [];
  for (const e of entries) {
    if (!tokens.every((t) => e.key.includes(t))) continue;
    scored.push([
      e.key.startsWith(tokens[0]) ? 0 : 1,
      e.name.includes("(") ? 1 : 0, // genérico (sem marca) primeiro
      e.name.length,
      e.name,
    ]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return scored.slice(0, limit).map((s) => s[3]);
}
