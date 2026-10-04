-- ================================================================
-- Valor que a Facilitta RECEBE da prefeitura por consulta, por médico.
-- Só aparece no /admin (nunca no acesso do médico).
--
-- 1. doctors.contract_fee: valor atual de cada profissional.
-- 2. appointments.contract_fee: valor CONGELADO na consulta, gravado
--    quando ela é concluída. Mudar o valor do médico depois não altera
--    o que já aconteceu.
--
-- Substitui specialties.contract_fee (valor por especialidade), que sai.
-- Pode rodar mais de uma vez.
-- ================================================================

alter table doctors add column if not exists contract_fee numeric(10,2)
  check (contract_fee is null or contract_fee >= 0);

alter table appointments add column if not exists contract_fee numeric(10,2)
  check (contract_fee is null or contract_fee >= 0);

create or replace function set_appointment_contract_fee() returns trigger
language plpgsql as $fn$
begin
  if new.status = 'concluido' and new.doctor_id is not null and (
       new.contract_fee is null
       or (tg_op = 'UPDATE' and new.doctor_id is distinct from old.doctor_id)
     ) then
    new.contract_fee := (select contract_fee from doctors where id = new.doctor_id);
  end if;
  return new;
end $fn$;

drop trigger if exists appointments_set_contract_fee on appointments;
create trigger appointments_set_contract_fee
  before insert or update on appointments
  for each row execute function set_appointment_contract_fee();

alter table specialties drop column if exists contract_fee;

notify pgrst, 'reload schema';
