-- ================================================================
-- Migração: certificado digital escolhido pelo médico (VIDaaS, BirdID...)
-- Rode no SQL Editor do Supabase (não apaga nada; é seguro rodar de novo).
-- ================================================================
alter table doctors
  add column if not exists signing_provider text;

notify pgrst, 'reload schema';
