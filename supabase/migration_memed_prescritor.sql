-- Vínculo real do médico como "prescritor" na Memed (módulo de
-- prescrição embutido na tela de consulta). O external_id enviado pra
-- Memed é o próprio id do médico no nosso banco.
alter table doctors
  add column if not exists memed_cpf text,
  add column if not exists memed_crm text,
  add column if not exists memed_uf text,
  add column if not exists memed_birth_date date,
  add column if not exists memed_linked_at timestamptz;

-- Registro de quando uma receita foi emitida pelo módulo embutido
-- (além do link manual que já existia em prescription_url).
alter table appointments
  add column if not exists memed_prescription_at timestamptz,
  add column if not exists memed_prescription_summary text;
