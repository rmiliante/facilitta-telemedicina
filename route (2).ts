import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { missingOptionalColumn, professionalFields, RQE_MIGRATION_WARNING, stripOptionalColumns } from "@/lib/doctorFields";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const columns =
    "id, name, email, specialty_id, active, memed_email, memed_linked_at, created_at, cpf, crm, crm_uf, rqe, endereco_profissional, specialties(name)";
  const run = (cols: string) => supabase.from("doctors").select(cols).order("name", { ascending: true });
  let { data, error } = await run(columns);
  // Sem a migração da receita digital, as colunas cpf/crm/crm_uf não existem ainda.
  if (error?.code === "42703") ({ data, error } = await run(columns.replace(", rqe, endereco_profissional", "")));
  if (error?.code === "42703") ({ data, error } = await run(columns.replace(", cpf, crm, crm_uf, rqe, endereco_profissional", "")));

  if (error) {
    console.error("Erro ao buscar médicos:", error);
    return NextResponse.json({ error: "Falha ao buscar médicos" }, { status: 500 });
  }
  return NextResponse.json({ doctors: data });
}

export async function POST(req: NextRequest) {
  const { name, email, password, specialtyId, memedEmail, cpf, crm, crmUf, rqe, enderecoProfissional } = await req.json().catch(() => ({}));

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    password.length < 6
  ) {
    return NextResponse.json(
      { error: "name, email e password (mín. 6 caracteres) são obrigatórios" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const supabase = getSupabaseAdmin();

  const row: Record<string, unknown> = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password_hash: passwordHash,
    specialty_id: typeof specialtyId === "string" && specialtyId ? specialtyId : null,
    memed_email: typeof memedEmail === "string" && memedEmail.trim() ? memedEmail.trim().toLowerCase() : null,
    ...professionalFields({ cpf, crm, crmUf, rqe, enderecoProfissional }),
  };
  const insert = (r: Record<string, unknown>) =>
    supabase.from("doctors").insert(r).select("id, name, email, specialty_id, active, memed_email, created_at").single();

  let { data, error } = await insert(row);
  let warning: string | undefined;
  if (missingOptionalColumn(error)) {
    const hadValue = stripOptionalColumns(row);
    ({ data, error } = await insert(row));
    if (!error && hadValue) warning = RQE_MIGRATION_WARNING;
  }

  if (error) {
    return NextResponse.json(
      { error: "Falha ao criar médico (e-mail já pode estar em uso)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ doctor: data, warning });
}
