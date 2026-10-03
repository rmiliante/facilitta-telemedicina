import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseConsultFee, professionalFields, migrationWarning, stripMissingColumn } from "@/lib/doctorFields";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const columns =
    "id, name, email, specialty_id, active, memed_email, memed_linked_at, created_at, cpf, crm, crm_uf, rqe, endereco_profissional, consult_fee, pix_key, specialties(name)";
  const run = (cols: string) => supabase.from("doctors").select(cols).order("name", { ascending: true });
  let { data, error } = await run(columns);
  // Colunas de migrações que podem não ter sido rodadas ainda (valor por
  // consulta, RQE/endereço, receita digital) — tira da mais nova pra mais antiga.
  if (error?.code === "42703") ({ data, error } = await run(columns.replace(", pix_key", "")));
  if (error?.code === "42703") ({ data, error } = await run(columns.replace(", consult_fee, pix_key", "")));
  if (error?.code === "42703") ({ data, error } = await run(columns.replace(", rqe, endereco_profissional, consult_fee, pix_key", "")));
  if (error?.code === "42703") ({ data, error } = await run(columns.replace(", cpf, crm, crm_uf, rqe, endereco_profissional, consult_fee, pix_key", "")));

  if (error) {
    console.error("Erro ao buscar médicos:", error);
    return NextResponse.json({ error: "Falha ao buscar médicos" }, { status: 500 });
  }
  return NextResponse.json({ doctors: data });
}

export async function POST(req: NextRequest) {
  const { name, email, password, specialtyId, memedEmail, cpf, crm, crmUf, rqe, enderecoProfissional, consultFee, pixKey } = await req.json().catch(() => ({}));

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

  const fee = parseConsultFee(consultFee);
  if (fee === undefined) {
    return NextResponse.json({ error: "Valor por consulta inválido (ex: 70,00)" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const supabase = getSupabaseAdmin();

  const row: Record<string, unknown> = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password_hash: passwordHash,
    specialty_id: typeof specialtyId === "string" && specialtyId ? specialtyId : null,
    memed_email: typeof memedEmail === "string" && memedEmail.trim() ? memedEmail.trim().toLowerCase() : null,
    ...professionalFields({ cpf, crm, crmUf, rqe, enderecoProfissional, pixKey }),
    consult_fee: fee,
  };
  const insert = (r: Record<string, unknown>) =>
    supabase.from("doctors").insert(r).select("id, name, email, specialty_id, active, memed_email, created_at").single();

  let { data, error } = await insert(row);
  const notSaved: Parameters<typeof migrationWarning>[0] = [];
  let stripped;
  while ((stripped = stripMissingColumn(row, error))) {
    if (stripped.hadValue) notSaved.push(stripped.column);
    ({ data, error } = await insert(row));
  }

  if (error) {
    return NextResponse.json(
      { error: "Falha ao criar médico (e-mail já pode estar em uso)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ doctor: data, warning: migrationWarning(notSaved) });
}
