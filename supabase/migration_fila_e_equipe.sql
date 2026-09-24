-- ================================================================
-- Migração: atendimento por ordem de chegada + contas de equipe
-- Rode este arquivo no SQL Editor do Supabase do projeto
-- facilitta-telemedicina (não apaga nada existente).
-- ================================================================

-- Tabela de equipe (admin e atendente, com login próprio)
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'atendente')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Colunas novas em appointments pra fila por ordem de chegada
alter table appointments
  add column if not exists queue_position integer,
  add column if not exists called_at timestamptz;

create index if not exists idx_appointments_doctor_queue
  on appointments(doctor_id, queue_position);
