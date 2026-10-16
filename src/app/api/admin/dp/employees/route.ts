import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { normalizeRole, STAFF_ROLE_HEADER } from "@/lib/permissions";
import { DEFAULT_ADMISSION_CHECKLIST, DP_STATUSES, type DpStatus } from "@/lib/dp";

/** Departamento Pessoal: só Master (o proxy já bloqueia os demais; aqui é a segunda trava). */
async function masterOnly() {
  const role = normalizeRole((await headers()).get(STAFF_ROLE_HEADER));
  return role === "master" || role === null /* acesso de recuperação não grava papel */;
}

const FIELDS =
  "id, full_name, cpf, role_title, department, admitted_at, salary, status, experience_end, vacation_due, vacation_return, aso_due, terminated_at, notes";

/** GET /api/admin/dp/employees — lista de colaboradores + itens pendentes da admissão. */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("dp_employees").select(FIELDS).order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: items } = await supabase.from("dp_admission_items").select("employee_id, done");
  const pending: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const it of (items ?? []) as { employee_id: string; done: boolean }[]) {
    total[it.employee_id] = (total[it.employee_id] ?? 0) + 1;
    if (!it.done) pending[it.employee_id] = (pending[it.employee_id] ?? 0) + 1;
  }
  return NextResponse.json({ employees: data ?? [], pending, total });
}

/** POST /api/admin/dp/employees — cadastra colaborador (admissão já com checklist). */
export async function POST(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const roleTitle = typeof body.role_title === "string" ? body.role_title.trim() : "";
  if (!fullName || !roleTitle) {
    return NextResponse.json({ error: "Nome e cargo são obrigatórios" }, { status: 400 });
  }
  const status: DpStatus = DP_STATUSES.includes(body.status) ? body.status : "admissao";
  const salary = body.salary === "" || body.salary == null ? null : Number(body.salary);
  if (salary !== null && (!Number.isFinite(salary) || salary < 0)) {
    return NextResponse.json({ error: "Salário inválido" }, { status: 400 });
  }
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("dp_employees")
    .insert({
      full_name: fullName,
      cpf: text(body.cpf),
      role_title: roleTitle,
      department: text(body.department),
      admitted_at: date(body.admitted_at),
      salary,
      status,
      experience_end: date(body.experience_end),
      vacation_due: date(body.vacation_due),
      aso_due: date(body.aso_due),
      notes: text(body.notes),
    })
    .select(FIELDS)
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Falha ao cadastrar" }, { status: 500 });

  if (status === "admissao") {
    await supabase.from("dp_admission_items").insert(
      DEFAULT_ADMISSION_CHECKLIST.map((label, i) => ({ employee_id: data.id, label, sort: i })),
    );
  }
  await audit("staff", {
    action: "dp_cadastrar_colaborador",
    entity: "dp_employees",
    entityId: data.id,
    details: { nome: fullName, cargo: roleTitle, status },
  });
  return NextResponse.json({ employee: data }, { status: 201 });
}
