import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Cliente do Supabase pro NAVEGADOR — usado só pra enviar arquivos
 * grandes direto pro Storage via URL assinada (uploadToSignedUrl),
 * sem passar pelo nosso servidor (que tem limite de tamanho de
 * requisição e era o motivo de PDFs grandes serem recusados).
 *
 * Usa só a chave pública (anon/publishable) — nunca a service role
 * key, que fica só no servidor. A chave pública sozinha não permite
 * escrever no bucket; quem autoriza o envio é o token da URL assinada,
 * gerado no servidor com a service role key.
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Envio direto de arquivo indisponível: faltam NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY nas variáveis de ambiente."
    );
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
