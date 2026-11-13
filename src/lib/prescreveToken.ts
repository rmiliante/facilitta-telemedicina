import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

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

export async function saveDoctorBearer(doctorId: string, token: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("doctors")
    .update({
      prescreve_token_enc: encrypt(token),
      prescreve_token_exp: new Date(Date.now() + VALID_MS).toISOString(),
    })
    .eq("id", doctorId);
  if (error) console.error("Prescreve: não foi possível guardar o token do médico", error.message);
}

/** Token ainda dentro das 24h, ou null (o médico precisa entrar de novo com o código do e-mail). */
export async function getDoctorBearer(doctorId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from("doctors")
    .select("prescreve_token_enc, prescreve_token_exp")
    .eq("id", doctorId)
    .maybeSingle();
  if (!data?.prescreve_token_enc || !data.prescreve_token_exp) return null;
  if (new Date(data.prescreve_token_exp).getTime() <= Date.now()) return null;
  return decrypt(data.prescreve_token_enc);
}

export async function clearDoctorBearer(doctorId: string): Promise<void> {
  await getSupabaseAdmin()
    .from("doctors")
    .update({ prescreve_token_enc: null, prescreve_token_exp: null })
    .eq("id", doctorId);
}
