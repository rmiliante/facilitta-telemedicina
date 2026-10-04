-- ================================================================
-- Níveis de acesso da equipe: master, gestor, financeiro, prefeitura e
-- atendente (regras em src/lib/permissions.ts). Quem era "admin" vira
-- "master" (acesso total). Pode rodar mais de uma vez.
-- ================================================================

alter table staff drop constraint if exists staff_role_check;
update staff set role = 'master' where role = 'admin';
alter table staff add constraint staff_role_check
  check (role in ('master', 'gestor', 'financeiro', 'prefeitura', 'atendente'));

notify pgrst, 'reload schema';
