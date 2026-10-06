-- ================================================================
-- Migração: captação de profissionais — origem do candidato e campos
-- do formulário do site. Rode no SQL Editor do Supabase (não apaga
-- nada; é seguro rodar de novo).
-- origin: 'pago' = entrou pelo formulário do sistema (tráfego pago);
--         'organico' = veio do formulário do site (e-mail da caixa Info).
-- ================================================================
alter table doctor_applications
  add column if not exists origin text not null default 'pago',
  add column if not exists profession text not null default 'Médico(a)',
  add column if not exists collaboration text,
  add column if not exists comments text,
  add column if not exists innovative_idea text,
  add column if not exists received_at timestamptz;

-- Candidatos do site podem vir sem alguns dados: libera os campos.
alter table doctor_applications
  alter column crm drop not null,
  alter column crm_uf drop not null,
  alter column specialty drop not null,
  alter column whatsapp drop not null,
  alter column city drop not null,
  alter column state drop not null;

alter table doctor_applications drop constraint if exists doctor_applications_origin_check;
alter table doctor_applications
  add constraint doctor_applications_origin_check check (origin in ('pago', 'organico'));

create index if not exists idx_doctor_applications_origin on doctor_applications(origin);
create index if not exists idx_doctor_applications_profession on doctor_applications(profession);
create index if not exists idx_doctor_applications_email on doctor_applications(lower(email));

notify pgrst, 'reload schema';
