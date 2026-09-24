-- ================================================================
-- Migração: horário de término do atendimento (pra calcular o tempo
-- de consulta junto com called_at, que já existia). Rode este
-- arquivo no SQL Editor do Supabase (não apaga nada existente).
-- ================================================================

alter table appointments
  add column if not exists finished_at timestamptz;
