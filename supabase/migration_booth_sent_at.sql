-- Cabine: só mostra o paciente que a atendente enviou ("Enviar para atendimento").
-- Antes, a cabine mostrava qualquer consulta em andamento, inclusive as que a
-- médica iniciava sozinha ao abrir o vídeo.
alter table public.appointments add column if not exists booth_sent_at timestamptz;
comment on column public.appointments.booth_sent_at is 'Quando a atendente enviou o paciente para a cabine. A cabine só mostra quem tem este campo preenchido.';
