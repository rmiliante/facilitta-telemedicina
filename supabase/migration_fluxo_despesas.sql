-- ================================================================
-- Fluxo de caixa: despesas operacionais (licenças, receituários, etc.)
-- e premissas da projeção (caixa de partida, cotas cheias, etc.).
-- Pode rodar mais de uma vez.
-- ================================================================

create table if not exists cash_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null default 'outras',
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,                      -- 1ª data (ou única)
  recurrence text not null default 'unica' check (recurrence in ('unica', 'mensal', 'anual')),
  ends_on date,                                -- fim da recorrência (vazio = sem fim)
  paid_at date,                                -- só para despesa única
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists cash_expenses_due_idx on cash_expenses (due_date);
alter table cash_expenses enable row level security;

create table if not exists cash_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table cash_settings enable row level security;
