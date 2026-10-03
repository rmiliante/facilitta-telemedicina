-- ================================================================
-- Valor que o médico recebe por consulta realizada (R$).
--
-- 1. doctors.consult_fee: valor combinado atual (cadastro no /admin).
--    Novos cadastros começam em branco.
-- 2. appointments.doctor_fee: valor CONGELADO na consulta, gravado
--    automaticamente quando ela é concluída. Se o valor do médico mudar
--    depois, o que já aconteceu continua com o valor da época.
--
-- O Histórico de atendimentos (admin e médico) soma doctor_fee das
-- consultas concluídas no período. Pode rodar mais de uma vez.
-- ================================================================

alter table doctors add column if not exists consult_fee numeric(10,2)
  check (consult_fee is null or consult_fee >= 0);

alter table appointments add column if not exists doctor_fee numeric(10,2)
  check (doctor_fee is null or doctor_fee >= 0);

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

-- Congela o valor quando a consulta é concluída (vale para qualquer
-- tela ou ajuste manual). Se a consulta concluída trocar de médico,
-- passa a valer o valor do novo médico.
create or replace function set_appointment_doctor_fee() returns trigger
language plpgsql as $$
begin
  if new.status = 'concluido' and new.doctor_id is not null and (
       new.doctor_fee is null
       or (tg_op = 'UPDATE' and new.doctor_id is distinct from old.doctor_id)
     ) then
    new.doctor_fee := (select consult_fee from doctors where id = new.doctor_id);
  end if;
  return new;
end $$;

drop trigger if exists appointments_set_doctor_fee on appointments;
create trigger appointments_set_doctor_fee
  before insert or update on appointments
  for each row execute function set_appointment_doctor_fee();

-- Consultas já concluídas antes desta migração: grava o valor atual.
update appointments a
set doctor_fee = d.consult_fee
from doctors d
where a.doctor_id = d.id
  and a.status = 'concluido'
  and a.doctor_fee is null
  and d.consult_fee is not null;

notify pgrst, 'reload schema';
