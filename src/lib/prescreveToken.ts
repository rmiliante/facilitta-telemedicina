import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { renovarSessao } from "@/lib/prescrevePrescricoes";

/**
 * Bearer token do médico na Prescreve (login por código no e-mail).
 * A Prescreve só deixa baixar o PDF assinado com o token do médico emitente;
 * ele vale 24h e é renovado por GET /me. Guardamos criptografado (AES-256-GCM,
 * chave derivada do SESSION_SECRET) e nunca devolvemos ao navegador.
 */

const VALID_MS = 24 * 60 * 60 * 1000;

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Faltando SESSION_SECRET nas variáveis de ambiente.");
  return createHash("sha256").update("prescreve-token:" + secret).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

function decrypt(blob: string): string | null {
  try {
    const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function saveDoctorBearer(doctorId: string, token: string, refresh?: string | null): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("doctors")
    .update({
      prescreve_token_enc: encrypt(JSON.stringify({ a: token, r: refresh ?? null })),
      prescreve_token_exp: new Date(Date.now() + VALID_MS).toISOString(),
    })
    .eq("id", doctorId);
  if (error) console.error("Prescreve: não foi possível guardar o token do médico", error.message);
}

function parse(blob: string): { a: string; r: string | null } | null {
  const plain = decrypt(blob);
  if (!plain) return null;
  try {
    const j = JSON.parse(plain) as { a?: string; r?: string | null };
    return j.a ? { a: j.a, r: j.r ?? null } : null;
  } catch {
    return { a: plain, r: null }; // formato antigo: só o access_token
  }
}

/**
 * Token do médico pronto para usar. Se já passou das 24h e há refresh_token, o GET /me
 * renova (não existe endpoint de refresh separado). Null = o médico precisa entrar de novo
 * com o código do e-mail.
 */
export async function getDoctorBearer(doctorId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("doctors")
    .select("prescreve_token_enc, prescreve_token_exp")
    .eq("id", doctorId)
    .maybeSingle();
  if (!data?.prescreve_token_enc) return null;
  const tk = parse(data.prescreve_token_enc);
  if (!tk) return null;
  const vencido = !data.prescreve_token_exp || new Date(data.prescreve_token_exp).getTime() <= Date.now() + 60_000;
  if (!vencido && !tk.r) return tk.a;
  if (!tk.r) return null;
  try {
    const novo = await renovarSessao(tk.a, tk.r);
    if (novo.access) {
      await saveDoctorBearer(doctorId, novo.access, novo.refresh ?? tk.r);
      return novo.access;
    }
    // sem token novo = o atual ainda vale
    await saveDoctorBearer(doctorId, tk.a, tk.r);
    return tk.a;
  } catch {
    await clearDoctorBearer(doctorId);
    return null;
  }
}

export async function clearDoctorBearer(doctorId: string): Promise<void> {
  await getSupabaseAdmin()
    .from("doctors")
    .update({ prescreve_token_enc: null, prescreve_token_exp: null })
    .eq("id", doctorId);
}
