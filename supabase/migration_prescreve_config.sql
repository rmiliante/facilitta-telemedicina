-- Configuração da Prescreve: franquia mensal de documentos contratada (editada no dashboard, aba Médicos).
create table if not exists public.prescreve_config (
  id int primary key default 1 check (id = 1),
  franquia_mensal int,
  updated_at timestamptz not null default now()
);
insert into public.prescreve_config (id) values (1) on conflict (id) do nothing;
alter table public.prescreve_config enable row level security;
