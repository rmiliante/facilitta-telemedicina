import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { masterOnly } from "@/lib/esocial-service";
import { DOC_KEYS } from "@/lib/dp-docs";

const BUCKET = "dp-docs";
const MAX = 4 * 1024 * 1024; // limite de corpo da Vercel ~4,5 MB
const MIME: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

/** POST multipart — campos: kind ("aso" | "doc"), employee_id, ref (id do ASO ou chave do documento), file. */
export async function POST(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulário inválido" }, { status: 400 });
  const kind = String(form.get("kind") ?? "");
  const employeeId = String(form.get("employee_id") ?? "");
  const ref = String(form.get("ref") ?? "");
  const file = form.get("file");
  if (!(file instanceof File) || !employeeId || !ref || !["aso", "doc"].includes(kind)) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const ext = MIME[file.type];
  if (!ext) return NextResponse.json({ error: "Só PDF, JPG ou PNG" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Arquivo acima de 4 MB" }, { status: 400 });
  if (kind === "doc" && !DOC_KEYS.some(([k]) => k === ref)) return NextResponse.json({ error: "Documento inválido" }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(employeeId) || (kind === "aso" && !/^[0-9a-f-]{36}$/i.test(ref))) return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const path = `${employeeId}/${kind}/${ref}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  if (kind === "aso") {
    const { error } = await supabase.from("dp_asos").update({ file_path: path }).eq("id", ref).eq("employee_id", employeeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("dp_documents")
      .upsert({ employee_id: employeeId, doc_key: ref, status: "entregue", file_path: path, updated_at: new Date().toISOString() }, { onConflict: "employee_id,doc_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, path });
}

/** GET ?path=… — link temporário (5 min) para abrir o arquivo. Só caminhos registrados no banco. */
export async function GET(req: NextRequest) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!path || path.includes("..")) return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const [{ data: a }, { data: d }] = await Promise.all([
    supabase.from("dp_asos").select("id").eq("file_path", path).limit(1),
    supabase.from("dp_documents").select("id").eq("file_path", path).limit(1),
  ]);
  if (!a?.length && !d?.length) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Falha ao gerar link" }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
