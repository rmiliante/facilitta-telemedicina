import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";
import { DOC_KEYS } from "@/lib/dp-docs";

/** GET /api/admin/dp/docs — situação dos documentos de todos os colaboradores. */
export async function GET() {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { data, error } = await getSupabaseAdmin().from("dp_documents").select("employee_id, doc_key, status, file_path");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ docs: data ?? [] });
}

/** PUT /api/admin/dp/docs — { employee_id, doc_key, status: "entregue" | "pendente" | "na" }. */
export async function PUT(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const employeeId = typeof b.employee_id === "string" ? b.employee_id : "";
  const key = DOC_KEYS.some(([k]) => k === b.doc_key) ? (b.doc_key as string) : null;
  const status = ["entregue", "pendente", "na"].includes(b.status) ? (b.status as string) : null;
  if (!employeeId || !key || !status) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { error } = await getSupabaseAdmin()
    .from("dp_documents")
    .upsert({ employee_id: employeeId, doc_key: key, status, updated_at: new Date().toISOString() }, { onConflict: "employee_id,doc_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
