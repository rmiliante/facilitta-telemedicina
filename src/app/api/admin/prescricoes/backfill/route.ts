import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EXAM_FILES_BUCKET, type ExamFile } from "@/lib/examFiles";
import { lerItensDoPdf } from "@/lib/prescricaoParse";
import { registrarItens } from "@/lib/prescricoesRegistro";

export const maxDuration = 60;

const KINDS = ["receita", "exame", "apac"]; // atestado não tem itens

/**
 * POST /api/admin/prescricoes/backfill?limit=25 — lê os PDFs já emitidos e guarda os itens
 * prescritos (medicamentos / exames / procedimento). Pula os já lidos; chame de novo até
 * "restantes" chegar a 0.
 */
export async function POST(req: NextRequest) {
  const limit = Math.min(60, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 25));
  const supabase = getSupabaseAdmin();

  const { data: lidos } = await supabase.from("prescricao_itens").select("doc_path");
  const jaLidos = new Set((lidos ?? []).map((r) => r.doc_path as string));

  const { data: pacientes, error } = await supabase.from("patients").select("id, documents").not("documents", "is", null);
  if (error) return NextResponse.json({ error: "Falha ao listar documentos" }, { status: 500 });

  const pendentes: { patientId: string; doc: ExamFile }[] = [];
  for (const p of pacientes ?? []) {
    for (const d of ((p.documents as ExamFile[] | null) ?? [])) {
      if (d.kind && KINDS.includes(d.kind) && d.signed && !jaLidos.has(d.path)) pendentes.push({ patientId: p.id as string, doc: d });
    }
  }

  let ok = 0;
  let falhas = 0;
  for (const { patientId, doc } of pendentes.slice(0, limit)) {
    try {
      const { data: file, error: dlErr } = await supabase.storage.from(EXAM_FILES_BUCKET).download(doc.path);
      if (dlErr || !file) throw new Error(dlErr?.message || "sem arquivo");
      const itens = await lerItensDoPdf(new Uint8Array(await file.arrayBuffer()), doc.kind as string);
      await registrarItens({ docPath: doc.path, patientId, kind: doc.kind as string, itens, origem: "pdf" });
      ok++;
    } catch (e) {
      falhas++;
      console.error("Backfill de prescrições: falha em", doc.path, e);
      // registra vazio para não travar a fila nas próximas chamadas
      await registrarItens({ docPath: doc.path, patientId, kind: doc.kind as string, itens: [], origem: "pdf" });
    }
  }
  return NextResponse.json({ lidos: ok, falhas, restantes: Math.max(0, pendentes.length - limit) });
}
