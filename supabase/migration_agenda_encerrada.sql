-- Encerramento da agenda do dia por médico (botão da atendente; aviso fixo na tela da médica).
create table if not exists public.agenda_encerrada (
  day date not null,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  closed_at timestamptz not null default now(),
  closed_by text,
  ack_at timestamptz,
  primary key (day, doctor_id)
);
alter table public.agenda_encerrada enable row level security;
