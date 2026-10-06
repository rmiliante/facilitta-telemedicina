import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { professionalFields } from "@/lib/doctorFields";

/**
 * POST /api/admin/doctor-applications/:id/create-doctor — cria o cadastro do
 * médico a partir de uma candidatura aprovada (nome, e-mail, especialidade,
 * CRM e UF já preenchidos). Gera uma senha provisória, mostrada uma única vez
 * para a administração repassar ao médico. CPF é opcional aqui (o médico ou a
 * equipe completa depois, na tela de Médicos).
 */
function provisionalPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join("");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();

  const { data: app } = await supabase.from("doctor_applications").select("*").eq("id", id).maybeSingle();
  if (!app) return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  if (app.status !== "aprovado") {
    return NextResponse.json({ error: "Aprove a candidatura antes de criar o cadastro" }, { status: 400 });
  }

  const email = String(app.email).trim().toLowerCase();
  const { data: dup } = await supabase.from("doctors").select("id").eq("email", email).maybeSingle();
  if (dup) return NextResponse.json({ error: "Já existe um médico com este e-mail" }, { status: 409 });

  let specialtyId: string | null = null;
  if (app.specialty) {
    const { data: sp } = await supabase.from("specialties").select("id").ilike("name", String(app.specialty)).maybeSingle();
    specialtyId = (sp?.id as string | undefined) ?? null;
  }

  const password = provisionalPassword();
  const row: Record<string, unknown> = {
    name: String(app.name).trim(),
    email,
    password_hash: await bcrypt.hash(password, 10),
    specialty_id: specialtyId,
    ...professionalFields({ cpf: body.cpf, crm: app.crm ?? "", crmUf: app.crm_uf ?? "" }),
  };
  const insert = (r: Record<string, unknown>) => supabase.from("doctors").insert(r).select("id").single();
  const { data, error } = await insert(row);
  if (error || !data) return NextResponse.json({ error: "Falha ao criar o cadastro do médico" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    doctorId: data.id,
    email,
    password,
    specialtyMatched: !!specialtyId,
  });
}
