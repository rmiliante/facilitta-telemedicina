create table if not exists public.prescricao_itens (id uuid primary key default gen_random_uuid(), doc_path text not null unique, patient_id uuid references public.patients(id) on delete cascade, kind text not null, tipo_receita text, itens jsonb not null default '[]'::jsonb, origem text not null default 'pdf', created_at timestamptz not null default now());
create index if not exists prescricao_itens_patient_idx on public.prescricao_itens(patient_id);
alter table public.prescricao_itens enable row level security;
