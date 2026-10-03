-- ================================================================
-- Financeiro: repasse aos médicos (fechamento mensal).
--
-- doctor_payouts: cada fechamento de um médico num mês — as consultas
-- concluídas que entraram nele ficam ligadas por appointments.payout_id,
-- então o valor fechado não muda depois (nem se o valor por consulta
-- mudar, nem se outra consulta for concluída mais tarde: essa fica em
-- aberto e entra num fechamento complementar).
--
-- Requer migration_valor_consulta.sql (doctor_fee nas consultas).
-- Pode rodar mais de uma vez.
-- ================================================================

create table if not exists doctor_payouts (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id),
  period date not null,               -- 1º dia do mês do fechamento
  consultas integer not null default 0,
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'a_pagar' check (status in ('a_pagar', 'pago')),
  paid_at date,
  payment_method text,                -- pix | ted | dinheiro | outro
  notes text,
  receipt_path text,                  -- comprovante no bucket privado "financeiro"
  receipt_name text,
  closed_by text,                     -- quem fechou (nome da equipe)
  paid_by text,                       -- quem registrou o pagamento
  created_at timestamptz not null default now()
);

-- Nota fiscal do repasse (o médico anexa no painel dele; o admin também pode).
alter table doctor_payouts add column if not exists invoice_path text;
alter table doctor_payouts add column if not exists invoice_name text;
alter table doctor_payouts add column if not exists invoice_uploaded_at timestamptz;
alter table doctor_payouts add column if not exists invoice_uploaded_by text;

-- Chave PIX do médico pra receber o repasse (ele preenche em "Meu cadastro").
alter table doctors add column if not exists pix_key text;

create index if not exists doctor_payouts_doctor_idx on doctor_payouts (doctor_id, period desc);
create index if not exists doctor_payouts_period_idx on doctor_payouts (period);

alter table appointments add column if not exists payout_id uuid
  references doctor_payouts(id) on delete set null;
create index if not exists appointments_payout_idx on appointments (payout_id);

-- Mesmo padrão das outras tabelas: RLS ligado e sem políticas, só o
-- servidor (service role) lê e grava.
alter table doctor_payouts enable row level security;

-- Bucket privado pros comprovantes de pagamento e notas fiscais.
insert into storage.buckets (id, name, public)
values ('financeiro', 'financeiro', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
