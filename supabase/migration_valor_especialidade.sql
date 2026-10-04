-- ================================================================
-- Valor que a Facilitta recebe por consulta em cada especialidade
-- (contrato com a prefeitura). Usado no Admin → Relatórios pra
-- calcular o valor a receber do mês. Pode rodar mais de uma vez.
-- ================================================================

alter table specialties add column if not exists contract_fee numeric(10,2)
  check (contract_fee is null or contract_fee >= 0);

notify pgrst, 'reload schema';
