import { EXAMS, type ExamGroup } from "@/data/exames";

export interface ExamHit {
  name: string;
  group: ExamGroup;
  prep?: string;
  /** Sigla/sinônimo que bateu com a busca (mostrado na sugestão). */
  matched?: string;
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INDEX = EXAMS.map(([name, group, syn, prep]) => ({
  name,
  group,
  prep,
  nName: norm(name),
  syns: syn.split(",").map((x) => ({ raw: x.trim(), n: norm(x) })).filter((x) => x.n),
}));

export function findExam(name: string) {
  const n = norm(name);
  const hit = INDEX.find((e) => e.nName === n);
  return hit ? { name: hit.name, group: hit.group, prep: hit.prep } : null;
}

/**
 * Busca de exames pelo começo das palavras, siglas (HMG, EAS, TSH, RX...)
 * e sinônimos. Não diferencia acentos nem maiúsculas.
 */
export function searchExams(query: string, limit = 10): ExamHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ");
  const scored: { hit: ExamHit; score: number }[] = [];

  for (const e of INDEX) {
    let score = 0;
    let matched: string | undefined;

    // Sigla/sinônimo idêntico: prioridade máxima (ex: "hmg", "eas", "tsh").
    const exactSyn = e.syns.find((s) => s.n === q);
    if (exactSyn) {
      score = 1000;
      matched = exactSyn.raw;
    } else if (e.nName.startsWith(q)) {
      score = 800;
    } else {
      const words = e.nName.split(" ");
      const allInName = tokens.every((t) => words.some((w) => w.startsWith(t)));
      if (allInName) {
        score = 600 - words.findIndex((w) => w.startsWith(tokens[0]));
      } else {
        const syn = e.syns.find((s) => {
          const sw = s.n.split(" ");
          return tokens.every((t) => sw.some((w) => w.startsWith(t)));
        });
        if (syn) {
          score = syn.n.startsWith(q) ? 500 : 400;
          matched = syn.raw;
        } else if (q.length >= 4 && e.nName.includes(q)) {
          score = 200;
        }
      }
    }
    if (score > 0) {
      // Nomes mais curtos primeiro em caso de empate (o exame "principal").
      scored.push({ hit: { name: e.name, group: e.group, prep: e.prep, matched }, score: score - e.name.length / 100 });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.hit);
}
