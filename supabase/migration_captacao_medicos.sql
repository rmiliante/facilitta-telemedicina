-- ================================================================
-- Migração: captação de médicos (formulário público de cadastro +
-- fila de avaliação no admin). Rode este arquivo no SQL Editor do
-- Supabase do projeto facilitta-telemedicina (não apaga nada
-- existente).
-- ================================================================

create table if not exists doctor_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  crm text not null,
  crm_uf text not null,
  specialty text not null,
  experience_years integer,
  email text not null,
  whatsapp text not null,
  city text not null,
  state text not null,
  consult_price numeric(10, 2),
  available_days text[] not null default '{}',
  available_shifts text[] not null default '{}',
  presentation text,
  photo_path text,
  status text not null default 'novo' check (status in ('novo', 'em_avaliacao', 'aprovado', 'recusado')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_doctor_applications_status on doctor_applications(status);
create index if not exists idx_doctor_applications_specialty on doctor_applications(specialty);
create index if not exists idx_doctor_applications_created_at on doctor_applications(created_at desc);

-- Bucket privado pra foto de perfil enviada no formulário (link só é
-- gerado, assinado e temporário, na tela de avaliação do admin).
insert into storage.buckets (id, name, public)
values ('candidaturas', 'candidaturas', false)
on conflict (id) do nothing;
