-- Receita médica via Memed (login pessoal do médico na Memed — sem
-- integração via API de parceiro). O médico gera e assina a receita
-- diretamente no site/app da Memed e cola o link gerado aqui, pra
-- ficar registrado na consulta e disponível pro paciente.
alter table appointments
  add column if not exists prescription_url text;
