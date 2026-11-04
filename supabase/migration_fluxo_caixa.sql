-- ================================================================
-- Fluxo de caixa: recebimentos da prefeitura (entradas).
-- Cada linha é uma parcela recebida (received_at preenchido) ou
-- prevista (expected_at; sem data = "a definir") de um mês de consultas.
-- As saídas vêm de doctor_payouts (fechamentos) — não ficam aqui.
-- Pode rodar mais de uma vez.
-- ================================================================

create table if not exists cash_receipts (
  id uuid primary key default gen_random_uuid(),
  period date not null,                       -- 1º dia do mês das consultas
  amount numeric(12,2) not null check (amount > 0),
  expected_at date,                           -- previsto (vazio = a definir)
  received_at date,                           -- preenchido = já recebido
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists cash_receipts_period_idx on cash_receipts (period, coalesce(received_at, expected_at));

alter table cash_receipts enable row level security;
