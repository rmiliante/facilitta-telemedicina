-- ================================================================
-- Migração: tipo da consulta (rotina ou retorno).
-- A atendente escolhe ao colocar o paciente na fila; o médico vê na
-- fila do dia e na tela da consulta. Rode no SQL Editor do Supabase.
-- ================================================================

alter table appointments
  add column if not exists tipo_consulta text
  check (tipo_consulta in ('rotina', 'retorno'));

notify pgrst, 'reload schema';
