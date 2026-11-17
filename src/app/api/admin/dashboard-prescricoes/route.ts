import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ExamFile } from "@/lib/examFiles";
import { TIPO_RECEITA_LABEL, tipoReceitaDosItens, type TipoReceita } from "@/lib/controlledMeds";

interface Item {
  nome: string;
}
const KINDS = ["receita", "exame", "atestado", "apac"] as const;
const KIND_LABEL: Record<string, string> = { receita: "Receitas", exame: "Pedidos de exame", atestado: "Atestados", apac: "Laudos APAC" };

function normaliza(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function top(map: Map<string, { nome: string; n: number }>, max = 10) {
  return [...map.values()].sort((a, b) => b.n - a.n).slice(0, max).map((x) => ({ name: x.nome, count: x.n }));
}
function add(map: Map<string, { nome: string; n: number }>, nome: string) {
  const k = normaliza(nome);
  if (!k) return;
  const cur = map.get(k);
  if (cur) cur.n++;
  else map.set(k, { nome: nome.trim(), n: 1 });
}
/** Segunda-feira da semana (YYYY-MM-DD), em São Paulo. */
function semana(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** GET /api/admin/dashboard-prescricoes?from=&to=&medico=&tipo= — números da aba "Prescrições" do dashboard. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const from = q.get("from") || "";
  const to = q.get("to") || "";
  const medico = q.get("medico") || "";
  const tipo = q.get("tipo") || "";
  const supabase = getSupabaseAdmin();

  const [{ data: pacientes, error }, { data: regs }] = await Promise.all([
    supabase.from("patients").select("id, full_name, documents").not("documents", "is", null),
    supabase.from("prescricao_itens").select("doc_path, tipo_receita, itens"),
  ]);
  if (error) return NextResponse.json({ error: "Falha ao carregar" }, { status: 500 });
  const reg = new Map((regs ?? []).map((r) => [r.doc_path as string, r as { tipo_receita: string | null; itens: Item[] }]));

  type Doc = ExamFile & { patient: string };
  let docs: Doc[] = [];
  for (const p of pacientes ?? []) {
    for (const d of ((p.documents as ExamFile[] | null) ?? [])) {
      if (d.kind && (KINDS as readonly string[]).includes(d.kind)) docs.push({ ...d, patient: p.full_name as string });
    }
  }
  const medicos = [...new Set(docs.map((d) => d.author).filter(Boolean))].sort() as string[];
  const dia = (d: Doc) => d.uploaded_at.slice(0, 10);
  docs = docs.filter((d) => (!from || dia(d) >= from) && (!to || dia(d) <= to) && (!medico || d.author === medico) && (!tipo || d.kind === tipo));
  docs.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));

  const porTipo = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<string, number>;
  const porMedico = new Map<string, Record<string, number>>();
  const porSemana = new Map<string, Record<string, number>>();
  const tipos = new Map<TipoReceita, number>();
  const meds = new Map<string, { nome: string; n: number }>();
  const exames = new Map<string, { nome: string; n: number }>();
  const consultas = new Set<string>();
  let assinados = 0;
  let lidos = 0;
  let receitasSemLeitura = 0;

  for (const d of docs) {
    porTipo[d.kind as string]++;
    if (d.signed) assinados++;
    if (d.appointment_id) consultas.add(d.appointment_id);
    const m = porMedico.get(d.author || "—") ?? Object.fromEntries(KINDS.map((k) => [k, 0]));
    m[d.kind as string]++;
    porMedico.set(d.author || "—", m);
    const w = semana(d.uploaded_at);
    const sw = porSemana.get(w) ?? Object.fromEntries(KINDS.map((k) => [k, 0]));
    sw[d.kind as string]++;
    porSemana.set(w, sw);

    const r = reg.get(d.path);
    if (r) lidos++;
    if (d.kind === "receita") {
      if (!r) {
        receitasSemLeitura++;
        continue;
      }
      const nomes = (r.itens ?? []).map((i) => i.nome);
      const t = (r.tipo_receita as TipoReceita | null) ?? tipoReceitaDosItens(nomes);
      tipos.set(t, (tipos.get(t) ?? 0) + 1);
      nomes.forEach((n) => add(meds, n));
    } else if (d.kind === "exame" && r) {
      (r.itens ?? []).forEach((i) => add(exames, i.nome));
    }
  }

  const total = docs.length;
  return NextResponse.json({
    total,
    porTipo,
    kindLabels: KIND_LABEL,
    assinadosPct: total ? Math.round((assinados / total) * 100) : null,
    docsPorConsulta: consultas.size ? Math.round((docs.filter((d) => d.appointment_id).length / consultas.size) * 10) / 10 : null,
    semanas: [...porSemana.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([week, v]) => ({ week, ...v })),
    tiposReceita: (Object.keys(TIPO_RECEITA_LABEL) as TipoReceita[]).map((t) => ({ name: TIPO_RECEITA_LABEL[t], key: t, count: tipos.get(t) ?? 0 })).filter((x) => x.count > 0),
    medicos: [...porMedico.entries()].map(([name, v]) => ({ name, ...v, total: KINDS.reduce((s, k) => s + (v[k] ?? 0), 0) })).sort((a, b) => b.total - a.total),
    medicamentos: top(meds),
    exames: top(exames),
    ultimas: docs.slice(0, 15).map((d) => {
      const r = reg.get(d.path);
      return {
        at: d.uploaded_at,
        patient: d.patient,
        author: d.author ?? "—",
        kind: d.kind,
        tipoReceita: d.kind === "receita" && r ? TIPO_RECEITA_LABEL[(r.tipo_receita as TipoReceita) ?? tipoReceitaDosItens((r.itens ?? []).map((i) => i.nome))] : null,
        itens: r ? (r.itens ?? []).length : null,
        signed: !!d.signed,
      };
    }),
    filtros: { medicos },
    leitura: { lidos, receitasSemLeitura },
  });
}
