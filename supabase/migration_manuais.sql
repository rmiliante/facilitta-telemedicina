-- Manuais da Facilitta (admin): categorias, manuais e versões. Arquivos no bucket privado "manuais".
create table if not exists manual_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists manuals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category_id uuid references manual_categories(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manual_versions (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references manuals(id) on delete cascade,
  version_label text not null,
  notes text,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create index if not exists manual_versions_manual_idx on manual_versions (manual_id, uploaded_at desc);
create index if not exists manuals_category_idx on manuals (category_id, sort_order);

alter table manual_categories enable row level security;
alter table manuals enable row level security;
alter table manual_versions enable row level security;

insert into manual_categories (name, sort_order) values
  ('Médicos', 1), ('Atendentes', 2), ('Processos', 3), ('Administração', 4)
on conflict (name) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('manuais', 'manuais', false, 26214400)
on conflict (id) do nothing;
