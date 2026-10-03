-- ================================================================
-- Auditoria (LGPD), limite de tentativas de login, modelos de receita
-- e resumo da consulta. Pode rodar mais de uma vez.
-- ================================================================

-- Registro de auditoria: quem viu/alterou dados de pacientes, consultas,
-- documentos, cadastros e financeiro. Também guarda os logins (aceitos e
-- recusados), que alimentam o bloqueio por excesso de tentativas.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_type text not null,           -- admin | atendente | admin_recuperacao | medico | anonimo
  actor_id uuid,
  actor_name text not null,
  action text not null,
  entity text,
  entity_id text,
  patient_id uuid,                    -- sem FK: o registro continua mesmo se o paciente for excluído
  patient_name text,
  details jsonb,
  ip text
);
create index if not exists audit_log_at_idx on audit_log (at desc);
create index if not exists audit_log_patient_idx on audit_log (patient_id, at desc);
create index if not exists audit_log_action_idx on audit_log (action, at desc);
create index if not exists audit_log_login_idx on audit_log (action, entity_id, at desc);
alter table audit_log enable row level security;

-- Modelos de receita / pedido de exame / atestado de cada médico.
create table if not exists prescription_templates (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id) on delete cascade,
  kind text not null check (kind in ('receita', 'exame', 'atestado')),
  name text not null,
  items jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists prescription_templates_doctor_idx on prescription_templates (doctor_id, kind);
alter table prescription_templates enable row level security;

-- Resumo da consulta (aparece no histórico do paciente).
alter table appointments add column if not exists chief_complaint text;
alter table appointments add column if not exists conduct text;

notify pgrst, 'reload schema';
