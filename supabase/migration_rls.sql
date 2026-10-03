-- ================================================================
-- Segurança: liga o RLS (Row Level Security) em todas as tabelas.
--
-- Por quê: a chave pública do Supabase (NEXT_PUBLIC_SUPABASE_ANON_KEY)
-- vai no código do navegador. Em tabela SEM RLS, qualquer pessoa com
-- essa chave consegue ler e alterar os dados direto pela API do
-- Supabase — CPF e dados dos pacientes, links das consultas, hashes de
-- senha e até criar um usuário admin na tabela staff.
--
-- Com RLS ligado e sem nenhuma política, a chave pública não acessa
-- nada. O sistema não muda: o servidor usa a service role key, que
-- ignora o RLS.
--
-- Pode rodar quantas vezes quiser (é idempotente).
-- ================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'specialties', 'doctors', 'staff', 'patients', 'appointments',
    'doctor_applications', 'vital_signs'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      -- Tira também as permissões diretas dos papéis públicos.
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Confere: todas as tabelas abaixo devem aparecer com rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
