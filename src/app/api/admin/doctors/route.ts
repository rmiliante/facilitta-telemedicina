import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseConsultFee, professionalFields, migrationWarning, stripMissingColumn } from "@/lib/doctorFields";
import { audit } from "@/lib/audit";

export async function GET() {
  const supabase = getSupabaseAdmin();
  // Colunas de migrações que podem não ter sido rodadas ainda — tira da
  // mais nova pra mais antiga até a consulta passar.
  const base = "id, name, email, specialty_id, active, memed_email, memed_linked_at, created_at";
  const optional = ["cpf, crm, crm_uf", "rqe, endereco_profissional", "consult_fee", "pix_key", "contract_fee"];
  const run = (n: number) =>
    supabase
      .from("doctors")
      .select([base, ...optional.slice(0, n), "specialties(name)"].join(", "))
      .order("name", { ascending: true });
  let n = optional.length;
  let { data, error } = await run(n);
  while (error?.code === "42703" && n > 0) ({ data, error } = await run(--n));

  if (error) {
    console.error("Erro ao buscar médicos:", error);
    return NextResponse.json({ error: "Falha ao buscar médicos" }, { status: 500 });
  }
  return NextResponse.json({ doctors: data });
}

export async function POST(req: NextRequest) {
  const { name, email, password, specialtyId, memedEmail, cpf, crm, crmUf, rqe, enderecoProfissional, consultFee, contractFee, pixKey } = await req.json().catch(() => ({}));

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
  const received = parseConsultFee(contractFee);
  if (received === undefined) {
    return NextResponse.json({ error: "Valor que recebemos por consulta inválido (ex: 120,00)" }, { status: 400 });
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
    contract_fee: received,
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
  await audit("staff", { action: "cadastrar_medico", entity: "medico", entityId: (data as { id?: string } | null)?.id ?? null, details: { nome: name.trim() } });
  return NextResponse.json({ doctor: data, warning: migrationWarning(notSaved) });
}
