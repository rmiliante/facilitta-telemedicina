import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { normalizeRole, STAFF_ROLE_HEADER } from "@/lib/permissions";

/** PATCH /api/admin/dp/employees/[id]/admission — marca/desmarca um item do checklist de admissão. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const role = normalizeRole((await headers()).get(STAFF_ROLE_HEADER));
  if (role !== "master" && role !== null) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (typeof body.item_id !== "string" || typeof body.done !== "boolean") {
    return NextResponse.json({ error: "Informe item_id e done" }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("dp_admission_items")
    .update({ done: body.done, done_at: body.done ? new Date().toISOString() : null })
    .eq("id", body.item_id)
    .eq("employee_id", id)
    .select("id, employee_id, label, sort, done, done_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  await audit("staff", {
    action: "dp_admissao_item",
    entity: "dp_admission_items",
    entityId: data.id,
    details: { item: data.label, concluido: data.done, colaborador: id },
  });
  return NextResponse.json({ item: data });
}
