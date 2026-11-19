import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCreditBalance } from "@/lib/prescreve";
import type { ExamFile } from "@/lib/examFiles";

const KINDS = ["exame", "receita", "atestado", "apac"] as const;
const TZ_MS = 3 * 3600_000;

/** Início e fim (UTC) do mês de São Paulo "YYYY-MM". */
function janela(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const ini = new Date(Date.UTC(y, m - 1, 1) + TZ_MS);
  const fim = new Date(Date.UTC(y, m, 1) + TZ_MS);
  return { ini, fim, diasMes: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}
function mesAtualSp() {
  return new Date(Date.now() - TZ_MS).toISOString().slice(0, 7);
}

/**
 * GET /api/admin/consumo-prescreve?mes=YYYY-MM — consumo da Prescreve no mês.
 * - Franquia (API de Prescrições): documentos emitidos pela API (tabela prescreve_documentos).
 * - Créditos de assinatura digital (fluxo antigo/APAC): documentos assinados no sistema fora da API; saldo vem da Prescreve.
 */
export async function GET(req: NextRequest) {
  const mesParam = req.nextUrl.searchParams.get("mes") || "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : mesAtualSp();
  const { ini, fim, diasMes } = janela(mes);
  const supabase = getSupabaseAdmin();

  const [{ data: api }, { data: pacientes }, { data: cfg }, { data: medicos }] = await Promise.all([
    supabase
      .from("prescreve_documentos")
      .select("doctor_id, tipo_controle, status, pdf_path, created_at")
      .gte("created_at", ini.toISOString())
      .lt("created_at", fim.toISOString()),
    supabase.from("patients").select("documents").not("documents", "is", null),
    supabase.from("prescreve_config").select("franquia_mensal").eq("id", 1).maybeSingle(),
    supabase.from("doctors").select("id, name"),
  ]);
  const nome = new Map((medicos ?? []).map((d) => [d.id as string, d.name as string]));
  const apiPaths = new Set((api ?? []).map((a) => a.pdf_path).filter(Boolean) as string[]);

  type Linha = { name: string; exame: number; receita: number; atestado: number; apac: number; api: number; assinatura: number };
  const porMedico = new Map<string, Linha>();
  const linha = (n: string) => {
    const l = porMedico.get(n) ?? { name: n, exame: 0, receita: 0, atestado: 0, apac: 0, api: 0, assinatura: 0 };
    porMedico.set(n, l);
    return l;
  };

  // Documentos da API de Prescrições (consomem a franquia).
  let semPdf = 0;
  for (const a of api ?? []) {
    const l = linha(nome.get(a.doctor_id as string) ?? "—");
    const k = a.tipo_controle as string;
    if (k === "exame" || k === "receita" || k === "atestado") l[k]++;
    l.api++;
    if (a.status === "emitido_sem_pdf") semPdf++;
  }
  // Demais documentos assinados no mês (assinatura digital / créditos): APAC e o fluxo antigo.
  for (const p of pacientes ?? []) {
    for (const d of ((p.documents as ExamFile[] | null) ?? [])) {
      if (!d.signed || !d.kind || !(KINDS as readonly string[]).includes(d.kind)) continue;
      const t = new Date(d.uploaded_at).getTime();
      if (t < ini.getTime() || t >= fim.getTime()) continue;
      if (apiPaths.has(d.path)) continue;
      const l = linha(d.author || "—");
      const k = d.kind as (typeof KINDS)[number];
      l[k]++;
      l.assinatura++;
    }
  }

  const linhas = [...porMedico.values()].sort((a, b) => b.api + b.assinatura - (a.api + a.assinatura));
  const totalApi = linhas.reduce((t, l) => t + l.api, 0);
  const totalAssinatura = linhas.reduce((t, l) => t + l.assinatura, 0);

  let creditos: number | null = null;
  try {
    creditos = await getCreditBalance();
  } catch {
    /* saldo é opcional */
  }

  const franquia = (cfg?.franquia_mensal as number | null) ?? null;
  const hoje = mesAtualSp();
  const atual = mes === hoje;
  const diaAtual = atual ? new Date(Date.now() - TZ_MS).getUTCDate() : diasMes;
  const ritmo = diaAtual ? totalApi / diaAtual : 0;

  return NextResponse.json({
    mes,
    atual,
    diasMes,
    diaAtual,
    diasRestantes: atual ? diasMes - diaAtual : 0,
    franquia,
    consumidosApi: totalApi,
    faltaConsumir: franquia != null ? Math.max(0, franquia - totalApi) : null,
    pctUsado: franquia ? Math.round((totalApi / franquia) * 100) : null,
    ritmoDia: Math.round(ritmo * 10) / 10,
    projecaoMes: atual ? Math.round(ritmo * diasMes) : totalApi,
    semPdf,
    assinaturaDigital: totalAssinatura,
    creditos,
    total: totalApi + totalAssinatura,
    medicos: linhas,
  });
}

/** PUT /api/admin/consumo-prescreve { franquia } — franquia mensal contratada (documentos/mês). */
export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { franquia?: unknown };
  const v = body.franquia === null || body.franquia === "" ? null : Number(body.franquia);
  if (v !== null && (!Number.isInteger(v) || v < 0 || v > 1_000_000)) {
    return NextResponse.json({ error: "Informe um número inteiro de documentos por mês." }, { status: 400 });
  }
  const { error } = await getSupabaseAdmin().from("prescreve_config").upsert({ id: 1, franquia_mensal: v, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  return NextResponse.json({ ok: true, franquia: v });
}
