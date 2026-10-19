import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";

const COLS = "pj_razao, pj_cnpj, pj_cep, pj_endereco, pj_rep_nome, pj_rep_cpf";

/** GET /api/admin/doctors/:id/empresa — dados da empresa (PJ) do médico, usados no contrato. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await getSupabaseAdmin().from("doctors").select(COLS).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Falha ao buscar os dados da empresa" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
  return NextResponse.json({ empresa: data });
}

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) || null : undefined;

/** PUT /api/admin/doctors/:id/empresa — grava os dados da empresa (PJ) do médico. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, string | null> = {};
  const map: [string, string, number][] = [
    ["razao", "pj_razao", 160],
    ["cnpj", "pj_cnpj", 20],
    ["cep", "pj_cep", 12],
    ["endereco", "pj_endereco", 240],
    ["repNome", "pj_rep_nome", 120],
    ["repCpf", "pj_rep_cpf", 20],
  ];
  for (const [key, col, max] of map) {
    const v = clean(body?.[key], max);
    if (v !== undefined) update[col] = v;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });

  const { error } = await getSupabaseAdmin().from("doctors").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Falha ao salvar os dados da empresa" }, { status: 500 });
  await audit("staff", { action: "alterar_medico", entity: "medico", entityId: id, details: { campos: ["empresa (PJ)"] } });
  return NextResponse.json({ ok: true });
}
