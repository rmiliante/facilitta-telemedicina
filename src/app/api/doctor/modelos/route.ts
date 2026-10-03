import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Modelos de receita / pedido de exame / atestado do médico logado
 * (ex.: "Hipertensão padrão"), pra preencher a prescrição com um clique.
 */

const KINDS = ["receita", "exame", "atestado"];
const MAX_TEMPLATES = 100;
const MIGRATION_WARNING = "Os modelos precisam da atualização do banco: rode supabase/migration_auditoria_relatorios.sql no Supabase.";

function missingTable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function cleanItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => ({
      name: typeof it?.name === "string" ? it.name.trim().slice(0, 300) : "",
      quantity: typeof it?.quantity === "string" ? it.quantity.trim().slice(0, 80) : "",
      instructions: typeof it?.instructions === "string" ? it.instructions.trim().slice(0, 1000) : "",
    }))
    .filter((it) => it.name)
    .slice(0, 30);
}

export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data, error } = await getSupabaseAdmin()
    .from("prescription_templates")
    .select("id, kind, name, items, notes")
    .eq("doctor_id", session.doctorId)
    .order("name", { ascending: true });
  if (missingTable(error)) return NextResponse.json({ templates: [], warning: MIGRATION_WARNING });
  if (error) return NextResponse.json({ error: "Falha ao carregar os modelos" }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = typeof body?.kind === "string" && KINDS.includes(body.kind) ? body.kind : null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const items = cleanItems(body?.items);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 5000) : "";
  if (!kind || !name) return NextResponse.json({ error: "Informe o nome do modelo" }, { status: 400 });
  if (kind === "atestado" ? !notes : items.length === 0) {
    return NextResponse.json({ error: "O modelo está vazio" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { count, error: countErr } = await supabase
    .from("prescription_templates")
    .select("id", { count: "exact", head: true })
    .eq("doctor_id", session.doctorId);
  if (missingTable(countErr)) return NextResponse.json({ error: MIGRATION_WARNING }, { status: 503 });
  if ((count ?? 0) >= MAX_TEMPLATES) {
    return NextResponse.json({ error: `Limite de ${MAX_TEMPLATES} modelos. Exclua algum antes de criar outro.` }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("prescription_templates")
    .insert({ doctor_id: session.doctorId, kind, name, items, notes: notes || null })
    .select("id, kind, name, items, notes")
    .single();
  if (error) return NextResponse.json({ error: "Falha ao salvar o modelo" }, { status: 500 });
  return NextResponse.json({ template: data });
}
