-- ================================================================
-- Migração: botão "Não sou eu" na cabine de atendimento, que avisa
-- a atendente que a pessoa errada foi chamada. Rode este arquivo no
-- SQL Editor do Supabase (não apaga nada existente).
-- ================================================================

alter table appointments
  add column if not exists booth_rejected_at timestamptz;
