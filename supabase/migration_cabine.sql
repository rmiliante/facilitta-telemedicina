-- ================================================================
-- Migração: link da cabine de atendimento (paciente presencial) +
-- sinalização de "paciente já entrou na sala" para o médico.
-- Rode este arquivo no SQL Editor do Supabase (não apaga nada
-- existente).
-- ================================================================

-- Link fixo e não divulgado por médico, pra tela da cabine física
-- (sem login) mostrar a fila dele e deixar entrar na sala.
alter table doctors
  add column if not exists booth_token text unique
    default translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');

-- Marca quando o paciente entrou na sala de vídeo, pra o médico ver
-- na fila que ele já está esperando.
alter table appointments
  add column if not exists patient_joined_at timestamptz;
