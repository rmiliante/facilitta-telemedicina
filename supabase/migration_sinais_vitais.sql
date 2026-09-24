-- ================================================================
-- Migração: sinais vitais por consulta (SpO2, BPM, PA, Peso, HGT).
-- Cada consulta guarda seus próprios valores; a tela do médico mostra
-- o último valor registrado (de uma consulta anterior) como referência
-- e sempre abre o campo em branco pra essa consulta. Rode este arquivo
-- no SQL Editor do Supabase (não apaga nada existente).
-- ================================================================

alter table appointments
  add column if not exists vital_spo2 text,
  add column if not exists vital_bpm text,
  add column if not exists vital_pa text,
  add column if not exists vital_peso text,
  add column if not exists vital_hgt text;
