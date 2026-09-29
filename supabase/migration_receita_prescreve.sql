-- ================================================================
-- Migração: receita digital própria, assinada pela Prescreve
-- (White Label, certificado VIDaaS/BirdID do médico).
-- Rode no SQL Editor do Supabase (não apaga nada existente).
-- ================================================================

-- Dados do médico que saem na receita e identificam o certificado.
alter table doctors
  add column if not exists cpf text,
  add column if not exists crm text,
  add column if not exists crm_uf text,
  -- Sessão de assinatura aberta na Prescreve (dura até 8h, uma
  -- aprovação no app VIDaaS vale pro plantão inteiro).
  add column if not exists prescreve_session_id text,
  add column if not exists prescreve_session_status text,
  add column if not exists prescreve_session_expires_at timestamptz;

-- Aproveita o que já foi preenchido no vínculo com a Memed.
update doctors set cpf = memed_cpf where cpf is null and memed_cpf is not null;
update doctors set crm = memed_crm where crm is null and memed_crm is not null;
update doctors set crm_uf = memed_uf where crm_uf is null and memed_uf is not null;

notify pgrst, 'reload schema';
