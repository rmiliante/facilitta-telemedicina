import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { missingOptionalColumn, professionalFields, RQE_MIGRATION_WARNING } from "@/lib/doctorFields";

const COLUMNS = "name, email, cpf, crm, crm_uf, rqe, endereco_profissional, specialties(name)";

/** GET /api/doctor/profile — dados do cadastro do médico logado. */
export async function GET() {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const run = (cols: string) => supabase.from("doctors").select(cols).eq("id", session.doctorId).maybeSingle();
  let { data, error } = await run(COLUMNS);
  if (missingOptionalColumn(error)) ({ data, error } = await run(COLUMNS.replace(" rqe, endereco_profissional,", "")));
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
    specialty: d.specialties?.name ?? null,
  });
}

/**
 * PATCH /api/doctor/profile — o próprio médico completa RQE e endereço
 * profissional. Nome, CPF, CRM e especialidade só a administração altera
 * (identificam o certificado digital).
 */
export async function PATCH(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const update = professionalFields({ rqe: body?.rqe, enderecoProfissional: body?.enderecoProfissional });
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }
  if (update.endereco_profissional && update.endereco_profissional.length < 10) {
    return NextResponse.json({ error: "Informe o endereço completo (rua, número, bairro, cidade/UF)." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("doctors").update(update).eq("id", session.doctorId);
  if (missingOptionalColumn(error)) {
    return NextResponse.json({ error: RQE_MIGRATION_WARNING }, { status: 500 });
  }
  if (error) return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
