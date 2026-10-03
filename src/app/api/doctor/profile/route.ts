import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { migrationWarning, missingOptionalColumn, OPTIONAL_DOCTOR_COLUMNS, professionalFields, stripMissingColumn } from "@/lib/doctorFields";

const BASE_COLUMNS = ["name", "email", "cpf", "crm", "crm_uf"];
const OPTIONAL = ["rqe", "endereco_profissional", "pix_key"];

/** GET /api/doctor/profile — dados do cadastro do médico logado. */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const run = (cols: string[]) =>
    supabase.from("doctors").select([...cols, "specialties(name)"].join(", ")).eq("id", session.doctorId).maybeSingle();
  // Colunas de migrações ainda não rodadas: tira só a que faltar e tenta de novo.
  let cols = [...BASE_COLUMNS, ...OPTIONAL];
  let { data, error } = await run(cols);
  while (missingOptionalColumn(error)) {
    const missing = OPTIONAL_DOCTOR_COLUMNS.find((c) => (error?.message ?? "").includes(c));
    if (!missing || !cols.includes(missing)) break;
    cols = cols.filter((c) => c !== missing);
    ({ data, error } = await run(cols));
  }
  if (error || !data) {
    return NextResponse.json({ error: "Falha ao carregar o cadastro" }, { status: 500 });
  }
  const d = data as unknown as Record<string, unknown> & { specialties: { name: string } | null };
  return NextResponse.json({
    name: d.name,
    email: d.email,
    cpf: d.cpf ?? null,
    crm: d.crm ?? null,
    crmUf: d.crm_uf ?? null,
    rqe: d.rqe ?? null,
    enderecoProfissional: d.endereco_profissional ?? null,
    pixKey: d.pix_key ?? null,
    specialty: d.specialties?.name ?? null,
  });
}

/**
 * PATCH /api/doctor/profile — o próprio médico completa RQE, endereço
 * profissional e chave PIX. Nome, CPF, CRM e especialidade só a
 * administração altera (identificam o certificado digital).
 */
export async function PATCH(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = professionalFields({
    rqe: body?.rqe,
    enderecoProfissional: body?.enderecoProfissional,
    pixKey: body?.pixKey,
  });
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }
  if (typeof update.endereco_profissional === "string" && update.endereco_profissional.length < 10) {
    return NextResponse.json({ error: "Informe o endereço completo (rua, número, bairro, cidade/UF)." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let { error } = await supabase.from("doctors").update(update).eq("id", session.doctorId);
  // Sem a migração de alguma coluna: grava o resto e avisa exatamente o que faltou.
  const notSaved: Parameters<typeof migrationWarning>[0] = [];
  let stripped;
  while ((stripped = stripMissingColumn(update, error))) {
    if (stripped.hadValue) notSaved.push(stripped.column);
    if (Object.keys(update).length === 0) break;
    ({ error } = await supabase.from("doctors").update(update).eq("id", session.doctorId));
  }
  const warning = migrationWarning(notSaved);
  if (Object.keys(update).length === 0) {
    // Tudo que veio era de coluna ainda não criada.
    return warning ? NextResponse.json({ error: warning }, { status: 503 }) : NextResponse.json({ ok: true });
  }
  if (error) return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true, warning });
}
