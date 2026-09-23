import { createClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase com a service role key — só usado no servidor
 * (rotas de API e server components), nunca exposto pro navegador.
 * Ignora RLS, então todo controle de acesso é feito no código das
 * rotas (checando a sessão do médico/staff).
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
