/** Preços de referência (CMED/Anvisa, PMC) para o dashboard de Prescrições. Preço teto, não o preço real da farmácia. */

export interface CmedRow {
  substancia: string;
  concentracao: string;
  forma: string;
  pmc_caixa_min: number | null;
  apresentacao_min: string | null;
  pmc_unidade_min: number | null;
  pmc_unidade_med: number | null;
  referencia: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "20 mg", "1,0 MG", "0,5mg/ml" → "20mg", "1mg", "0.5mg/ml". */
export function forca(texto: string): string | null {
  const m = norm(texto).match(/(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|ui|meq)(?:\s*\/\s*(ml|g|dose))?/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return `${n}${m[2]}${m[3] ? "/" + m[3] : ""}`;
}

export function linhasDaSubstancia(nome: string, rows: CmedRow[]): CmedRow[] {
  const n = norm(nome);
  const subs = [...new Set(rows.map((r) => r.substancia))].filter((s) => n.includes(s));
  if (subs.length === 0) return [];
  const sub = subs.sort((a, b) => b.length - a.length)[0];
  const doSub = rows.filter((r) => r.substancia === sub);
  const f = forca(nome);
  const igual = f ? doSub.filter((r) => forca(r.concentracao) === f) : [];
  return igual.length ? igual : doSub;
}

/** Valor estimado de um item: unidade × quantidade (quando a receita traz número); senão, 1 caixa (menor PMC da dose). */
export function estimarItem(nome: string, quantidade: string | undefined, rows: CmedRow[]): number | null {
  const f = forca(nome);
  if (!f) return null;
  const cand = linhasDaSubstancia(nome, rows).filter((r) => forca(r.concentracao) === f);
  if (cand.length === 0) return null;
  const q = /^\s*(\d{1,4})\b/.exec(quantidade ?? "");
  const comUnidade = cand.filter((r) => r.pmc_unidade_med != null);
  if (q && !/cx|caixa|frasco|fr\b/i.test(quantidade ?? "") && comUnidade.length) {
    const u = comUnidade.sort((a, b) => Number(a.pmc_unidade_med) - Number(b.pmc_unidade_med))[Math.floor(comUnidade.length / 2)].pmc_unidade_med!;
    return Math.round(Number(u) * Number(q[1]) * 100) / 100;
  }
  const caixa = Math.min(...cand.map((r) => Number(r.pmc_caixa_min ?? Infinity)));
  return Number.isFinite(caixa) ? caixa : null;
}
