-- ================================================================
-- Valor que o médico recebe por consulta realizada (R$).
-- Usado nos totais do Histórico de atendimentos (admin e médico):
-- consultas concluídas no período × valor por consulta.
-- Novos cadastros começam em branco. Pode rodar mais de uma vez.
-- ================================================================

alter table doctors add column if not exists consult_fee numeric(10,2)
  check (consult_fee is null or consult_fee >= 0);

-- Preenche R$ 70,00 no único médico já cadastrado. Se houver mais de
-- um, não mexe em nada: preencha cada um pelo /admin > Médicos.
do $$
begin
  if (select count(*) from doctors) = 1 then
    update doctors set consult_fee = 70.00 where consult_fee is null;
  else
    raise notice 'Há % médicos cadastrados: preencha o valor por consulta de cada um no /admin.',
      (select count(*) from doctors);
  end if;
end $$;

notify pgrst, 'reload schema';
