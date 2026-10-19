import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";

const BUCKET = "medicos-docs";

interface Anexo {
  path: string;
  name: string;
  uploaded_at: string;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

async function carregar(id: string): Promise<Anexo[] | null> {
  const { data, error } = await getSupabaseAdmin().from("doctors").select("anexos").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return ((data as { anexos: Anexo[] | null }).anexos ?? []) as Anexo[];
}

async function comLinks(files: Anexo[]) {
  const supabase = getSupabaseAdmin();
  return Promise.all(
    files.map(async (f) => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 60 * 30);
      return { ...f, url: data?.signedUrl ?? null };
    })
  );
}

/** GET /api/admin/doctors/:id/docs — anexos do médico (com link temporário de 30 min). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const files = await carregar(id);
  if (!files) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
  return NextResponse.json({ files: await comLinks(files) });
}

/**
 * POST /api/admin/doctors/:id/docs
 *  { action: "upload-url", fileName } → URL assinada pra enviar direto pro Storage
 *  { action: "finalize", path, name } → registra o arquivo enviado no cadastro
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();

  if (body?.action === "upload-url") {
    if (typeof body.fileName !== "string" || !body.fileName.trim()) {
      return NextResponse.json({ error: "fileName é obrigatório" }, { status: 400 });
    }
    const path = `${id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName(body.fileName)}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: "Falha ao preparar o envio do arquivo" }, { status: 500 });
    return NextResponse.json({ path, token: data.token });
  }

  if (body?.action === "finalize") {
    const { path, name } = body;
    if (typeof path !== "string" || !path.startsWith(`${id}/`) || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "path e name são obrigatórios" }, { status: 400 });
    }
    const atuais = await carregar(id);
    if (!atuais) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
    const next = [...atuais, { path, name: name.trim().slice(0, 200), uploaded_at: new Date().toISOString() }];
    const { error } = await supabase.from("doctors").update({ anexos: next }).eq("id", id);
    if (error) return NextResponse.json({ error: "Arquivo enviado, mas falha ao registrar no cadastro" }, { status: 500 });
    await audit("staff", { action: "anexar_documento", entity: "medico", entityId: id, details: { arquivo: name } });
    return NextResponse.json({ files: await comLinks(next) });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

/**
 * DELETE /api/admin/doctors/:id/docs  { path } — tira o anexo da lista do cadastro.
 * O arquivo continua guardado no Storage (nada é apagado de verdade).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.path !== "string" || !body.path) return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
  const atuais = await carregar(id);
  if (!atuais) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
  const next = atuais.filter((f) => f.path !== body.path);
  const { error } = await getSupabaseAdmin().from("doctors").update({ anexos: next }).eq("id", id);
  if (error) return NextResponse.json({ error: "Falha ao remover o anexo" }, { status: 500 });
  await audit("staff", { action: "remover_documento", entity: "medico", entityId: id, details: { arquivo: String(body.path).split("/").pop() } });
  return NextResponse.json({ files: await comLinks(next) });
}
