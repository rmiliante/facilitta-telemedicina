import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";
import { ASO_RESULTADOS, ASO_TIPOS } from "@/lib/dp-docs";

const COLS = "id, employee_id, tipo, exam_date, resultado, medico_nome, medico_crm, medico_uf, validade_meses, next_due, file_path, notes, esocial_event_id, created_at";
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

/** GET /api/admin/dp/asos — todos os ASOs + status dos eventos eSocial ligados. */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("dp_asos").select(COLS).order("exam_date", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = [...new Set(((data ?? []) as { esocial_event_id: string | null }[]).map((a) => a.esocial_event_id).filter(Boolean))] as string[];
  const eventos: Record<string, { status: string }> = {};
  if (ids.length) {
    const { data: evs } = await supabase.from("dp_esocial_events").select("id, status").in("id", ids);
    for (const e of evs ?? []) eventos[e.id] = { status: e.status };
  }
  return NextResponse.json({ asos: data ?? [], eventos });
}

/** POST /api/admin/dp/asos — registra um ASO; calcula o próximo vencimento e atualiza o vencimento na ficha. */
export async function POST(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const employeeId = typeof b.employee_id === "string" ? b.employee_id : "";
  const tipo = ASO_TIPOS.some(([k]) => k === b.tipo) ? (b.tipo as string) : null;
  const resultado = ASO_RESULTADOS.some(([k]) => k === b.resultado) ? (b.resultado as string) : null;
  const examDate = isoDate(b.exam_date);
  if (!employeeId || !tipo || !resultado || !examDate) return NextResponse.json({ error: "Colaborador, tipo, data e resultado são obrigatórios" }, { status: 400 });
  const text = (v: unknown, n = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
  const meses = b.validade_meses === 24 ? 24 : 12;
  const nextDue = tipo === "demissional" ? null : addMonths(examDate, meses);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("dp_asos")
    .insert({
      employee_id: employeeId,
      tipo,
      exam_date: examDate,
      resultado,
      medico_nome: text(b.medico_nome),
      medico_crm: text(b.medico_crm, 20),
      medico_uf: text(b.medico_uf, 2)?.toUpperCase() ?? null,
      validade_meses: tipo === "demissional" ? null : meses,
      next_due: nextDue,
      notes: text(b.notes, 300),
    })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (nextDue) await supabase.from("dp_employees").update({ aso_due: nextDue }).eq("id", employeeId);
  return NextResponse.json({ aso: data });
}
