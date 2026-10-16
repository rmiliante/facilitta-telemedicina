import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { normalizeRole, STAFF_ROLE_HEADER } from "@/lib/permissions";
import { DP_STATUSES } from "@/lib/dp";

async function masterOnly() {
  const role = normalizeRole((await headers()).get(STAFF_ROLE_HEADER));
  return role === "master" || role === null;
}

const FIELDS =
  "id, full_name, cpf, role_title, department, admitted_at, salary, status, experience_end, vacation_due, vacation_return, aso_due, terminated_at, notes";

/** GET /api/admin/dp/employees/[id] — ficha + checklist de admissão. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = getSupabaseAdmin();
  const { data: employee } = await supabase.from("dp_employees").select(FIELDS).eq("id", id).maybeSingle();
  if (!employee) return NextResponse.json({ error: "Colaborador não encontrado" }, { status: 404 });
  const { data: items } = await supabase
    .from("dp_admission_items")
    .select("id, employee_id, label, sort, done, done_at")
    .eq("employee_id", id)
    .order("sort");
  return NextResponse.json({ employee, items: items ?? [] });
}

/** PATCH /api/admin/dp/employees/[id] — altera dados. Nunca apaga: desligar = status "desligado". */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("full_name" in body) {
    const v = text(body.full_name);
    if (!v) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    patch.full_name = v;
  }
  if ("role_title" in body) {
    const v = text(body.role_title);
    if (!v) return NextResponse.json({ error: "Cargo é obrigatório" }, { status: 400 });
    patch.role_title = v;
  }
  for (const k of ["cpf", "department", "notes"] as const) if (k in body) patch[k] = text(body[k]);
  for (const k of ["admitted_at", "experience_end", "vacation_due", "vacation_return", "aso_due", "terminated_at"] as const) {
    if (k in body) patch[k] = date(body[k]);
  }
  if ("salary" in body) {
    const s = body.salary === "" || body.salary == null ? null : Number(body.salary);
    if (s !== null && (!Number.isFinite(s) || s < 0)) return NextResponse.json({ error: "Salário inválido" }, { status: 400 });
    patch.salary = s;
  }
  if ("status" in body) {
    if (!DP_STATUSES.includes(body.status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    patch.status = body.status;
    if (body.status === "desligado" && !("terminated_at" in body)) patch.terminated_at = new Date().toISOString().slice(0, 10);
  }

  const { data, error } = await getSupabaseAdmin().from("dp_employees").update(patch).eq("id", id).select(FIELDS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Colaborador não encontrado" }, { status: 404 });
  await audit("staff", {
    action: "dp_alterar_colaborador",
    entity: "dp_employees",
    entityId: id,
    details: { campos: Object.keys(patch).filter((k) => k !== "updated_at"), nome: data.full_name },
  });
  return NextResponse.json({ employee: data });
}
