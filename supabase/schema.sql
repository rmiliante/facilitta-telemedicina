-- ================================================================
-- Facilitta Telemedicina — schema inicial (MVP)
-- Rode este arquivo no SQL Editor do Supabase (projeto novo,
-- separado do banco do CRM de WhatsApp).
-- ================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Tabela: specialties
-- As especialidades atendidas (ex: Clínico Geral, Psicologia).
-- monthly_quota é o limite de consultas por mês contratado pra
-- essa especialidade (ex: 50).
-- ------------------------------------------------------------
create table if not exists specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  monthly_quota integer not null default 50,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: doctors
-- Login e senha (hash bcrypt) fornecidos pela Facilitta.
-- ------------------------------------------------------------
create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  specialty_id uuid references specialties(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabela: patients
-- Cadastro prévio feito pela equipe da Facilitta antes da consulta.
-- ------------------------------------------------------------
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  cpf text,
  birth_date date,
  phone text,
  email text,
  city text,
  state text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_patients_full_name on patients(full_name);
create index if not exists idx_patients_cpf on patients(cpf);

-- ------------------------------------------------------------
-- Tabela: appointments
-- Uma consulta agendada. access_token é o link único que o
-- paciente usa pra entrar na sala (sem precisar de login/senha).
-- ------------------------------------------------------------
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id uuid references doctors(id),
  specialty_id uuid not null references specialties(id),
  scheduled_at timestamptz not null,
  status text not null default 'agendado', -- agendado | em_andamento | concluido | cancelado | faltou
  access_token text not null unique default encode(gen_random_bytes(18), 'base64url'),
  daily_room_name text,
  doctor_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_doctor on appointments(doctor_id);
create index if not exists idx_appointments_patient on appointments(patient_id);
create index if not exists idx_appointments_scheduled_at on appointments(scheduled_at);
create index if not exists idx_appointments_specialty_month on appointments(specialty_id, scheduled_at);

-- ------------------------------------------------------------
-- Seed: especialidades de exemplo (renomeie/ajuste como precisar
-- na tela de administração, ou direto aqui antes de rodar).
-- ------------------------------------------------------------
insert into specialties (name, monthly_quota)
values
  ('Clínico Geral', 50),
  ('Psicologia', 50)
on conflict (name) do nothing;
