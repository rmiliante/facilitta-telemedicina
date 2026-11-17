import { getDocumentProxy } from "unpdf";

/**
 * Lê o texto dos PDFs de receita / pedido de exame / laudo que o próprio sistema gera
 * (layout fixo, ver prescriptionPdf.ts) e devolve os itens prescritos. É heurístico:
 * serve para o relatório de prescrições, não para validar o documento.
 */

export interface ItemLido {
  nome: string;
  quantidade?: string;
  posologia?: string;
}

interface Linha {
  esq: string;
  dir: string;
}

const RIGHT_X = 360; // quantidade fica alinhada à direita da página

async function linhasDaPagina(pdf: Awaited<ReturnType<typeof getDocumentProxy>>, n: number): Promise<Linha[]> {
  const page = await pdf.getPage(n);
  const content = await page.getTextContent();
  const itens = content.items
    .filter((i): i is typeof i & { str: string; transform: number[] } => "str" in i && i.str.trim() !== "")
    .map((i) => ({ s: i.str, x: i.transform[4], y: Math.round(i.transform[5] * 2) / 2 }));
  itens.sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: { y: number; itens: typeof itens }[] = [];
  for (const it of itens) {
    const g = grupos.find((x) => Math.abs(x.y - it.y) <= 1.5);
    if (g) g.itens.push(it);
    else grupos.push({ y: it.y, itens: [it] });
  }
  return grupos
    .sort((a, b) => b.y - a.y)
    .map((g) => {
      g.itens.sort((a, b) => a.x - b.x);
      return {
        esq: g.itens.filter((i) => i.x < RIGHT_X).map((i) => i.s).join(" ").replace(/\s+/g, " ").trim(),
        dir: g.itens.filter((i) => i.x >= RIGHT_X).map((i) => i.s).join(" ").replace(/\s+/g, " ").trim(),
      };
    });
}

export async function lerItensDoPdf(buf: Uint8Array, kind: string): Promise<ItemLido[]> {
  if (kind === "atestado") return [];
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const itens: ItemLido[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const linhas = await linhasDaPagina(pdf, n);
    const ini = linhas.findIndex((l) => l.esq.startsWith("Local do atendimento:"));
    let fim = linhas.findIndex((l) => l.esq.startsWith("Documento assinado digitalmente"));
    if (fim < 0) fim = linhas.length;
    const corpo = linhas.slice(ini + 1, fim);

    if (kind === "apac") {
      const l = corpo.find((x) => x.esq.startsWith("Procedimento:"));
      if (l) itens.push({ nome: l.esq.replace(/^Procedimento:\s*/, "").trim() });
      continue;
    }

    let atual: ItemLido | null = null;
    let emNotas = false;
    for (const l of corpo) {
      if (l.esq === "Observações") {
        emNotas = true;
        atual = null;
        continue;
      }
      const m = /^(\d+)\.\s+(.*)$/.exec(l.esq);
      if (m && !emNotas) {
        atual = { nome: m[2].trim(), quantidade: l.dir || undefined };
        itens.push(atual);
      } else if (atual && !emNotas && l.esq) {
        atual.posologia = [atual.posologia, l.esq].filter(Boolean).join(" ");
      }
    }
  }
  return itens;
}
