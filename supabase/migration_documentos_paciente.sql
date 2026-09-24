-- Documentos do paciente (pedidos de exame, resultados, etc.) — ficam
-- ligados ao PACIENTE, não a uma consulta específica, pra que o médico
-- veja em qualquer atendimento tudo que já foi anexado, não só o que
-- entrou junto daquele agendamento. Reaproveita o mesmo bucket privado
-- "exames" criado na migração anterior.
alter table patients
  add column if not exists documents jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('exames', 'exames', false)
on conflict (id) do nothing;
