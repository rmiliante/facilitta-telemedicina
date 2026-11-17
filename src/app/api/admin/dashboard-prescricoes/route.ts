import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ExamFile } from "@/lib/examFiles";
import { TIPO_RECEITA_LABEL, tipoReceitaDosItens, type TipoReceita } from "@/lib/controlledMeds";
import { infoDoMedicamento } from "@/lib/medicamentosInfo";
import { estimarItem, linhasDaSubstancia, type CmedRow } from "@/lib/cmedPreco";

interface Item {
  nome: string;
  posologia?: string;
  quantidade?: string;
}
interface MedAgg {
  nome: string;
  n: number;
  pacientes: Set<string>;
  medicos: Set<string>;
  ultima: string;
  posologias: Map<string, number>;
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

  const [{ data: pacientes, error }, { data: regs }, { data: cmedData }] = await Promise.all([
    supabase.from("patients").select("id, full_name, documents").not("documents", "is", null),
    supabase.from("prescricao_itens").select("doc_path, tipo_receita, itens"),
    supabase.from("cmed_precos").select("substancia, concentracao, forma, pmc_caixa_min, apresentacao_min, pmc_unidade_min, pmc_unidade_med, referencia"),
  ]);
  const cmed = (cmedData ?? []) as CmedRow[];
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
  const medAgg = new Map<string, MedAgg>();
  let itensTotal = 0;
  const pacientesComItem = new Set<string>();
  const itensPorMedico = new Map<string, { itens: number; receitas: number; controlados: number }>();
  const itensPorMes = new Map<string, number>();
  let maxItensReceita = 0;
  let controladosItens = 0;
  let valorTotal = 0;
  let itensComPreco = 0;
  let receitasLidas = 0;
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
      receitasLidas++;
      const autor = d.author || "—";
      const pm = itensPorMedico.get(autor) ?? { itens: 0, receitas: 0, controlados: 0 };
      pm.receitas++;
      maxItensReceita = Math.max(maxItensReceita, nomes.length);
      const mes = d.uploaded_at.slice(0, 7);
      for (const it of r.itens ?? []) {
        pm.itens++;
        pacientesComItem.add(d.patient);
        itensPorMes.set(mes, (itensPorMes.get(mes) ?? 0) + 1);
        if (tipoReceitaDosItens([it.nome]) !== "simples") {
          pm.controlados++;
          controladosItens++;
        }
        const v = estimarItem(it.nome, it.quantidade, cmed);
        if (v != null) {
          valorTotal += v;
          itensComPreco++;
        }
      }
      itensPorMedico.set(autor, pm);
      for (const it of r.itens ?? []) {
        const k = normaliza(it.nome);
        if (!k) continue;
        itensTotal++;
        const a = medAgg.get(k) ?? { nome: it.nome.trim(), n: 0, pacientes: new Set<string>(), medicos: new Set<string>(), ultima: "", posologias: new Map<string, number>() };
        a.n++;
        a.pacientes.add(d.patient);
        if (d.author) a.medicos.add(d.author);
        if (d.uploaded_at > a.ultima) a.ultima = d.uploaded_at;
        const pos = (it.posologia ?? "").trim();
        if (pos) a.posologias.set(pos, (a.posologias.get(pos) ?? 0) + 1);
        medAgg.set(k, a);
      }
    } else if (d.kind === "exame" && r) {
      (r.itens ?? []).forEach((i) => add(exames, i.nome));
    }
  }

  const detalhes = [...medAgg.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 60)
    .map((a) => {
      const info = infoDoMedicamento(a.nome);
      return {
        name: a.nome,
        count: a.n,
        pacientes: a.pacientes.size,
        medicos: a.medicos.size,
        ultima: a.ultima || null,
        posologia: [...a.posologias.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
        tipoKey: tipoReceitaDosItens([a.nome]),
        tipo: TIPO_RECEITA_LABEL[tipoReceitaDosItens([a.nome])],
        info,
        precos: linhasDaSubstancia(a.nome, cmed)
          .filter((p) => p.forma)
          .sort((x, y) => x.concentracao.localeCompare(y.concentracao, "pt-BR", { numeric: true }))
          .slice(0, 8)
          .map((p) => ({ concentracao: p.concentracao, forma: p.forma, caixa: p.pmc_caixa_min, unidadeMin: p.pmc_unidade_min, unidadeMed: p.pmc_unidade_med })),
      };
    });
  const classes = new Map<string, number>();
  for (const x of detalhes) if (x.info) classes.set(x.info.classe, (classes.get(x.info.classe) ?? 0) + x.count);
  const top5 = [...medAgg.values()].sort((x, y) => y.n - x.n).slice(0, 5).reduce((t, x) => t + x.n, 0);
  const resumoMeds = {
    totalItens: itensTotal,
    receitas: receitasLidas,
    pacientes: pacientesComItem.size,
    maxItensReceita,
    distintos: medAgg.size,
    top5Pct: itensTotal ? Math.round((top5 / itensTotal) * 100) : null,
    controlados: controladosItens,
    controladosPct: itensTotal ? Math.round((controladosItens / itensTotal) * 100) : null,
    itensPorReceita: receitasLidas ? Math.round((itensTotal / receitasLidas) * 10) / 10 : null,
    itensPorPaciente: pacientesComItem.size ? Math.round((itensTotal / pacientesComItem.size) * 10) / 10 : null,
    valorEstimado: itensComPreco ? Math.round(valorTotal) : null,
    valorPorReceita: itensComPreco && receitasLidas ? Math.round(valorTotal / receitasLidas) : null,
    itensComPrecoPct: itensTotal ? Math.round((itensComPreco / itensTotal) * 100) : null,
    cmedRef: cmed[0]?.referencia ?? null,
    classes: [...classes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
    porMedico: [...itensPorMedico.entries()]
      .map(([name, v]) => ({ name, itens: v.itens, itensPorReceita: v.receitas ? Math.round((v.itens / v.receitas) * 10) / 10 : 0, controladosPct: v.itens ? Math.round((v.controlados / v.itens) * 100) : 0 }))
      .sort((a, b) => b.itens - a.itens),
    porMes: [...itensPorMes.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([mes, count]) => ({ mes, count })),
  };

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
    medicamentosDetalhe: detalhes,
    resumoMeds,
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
