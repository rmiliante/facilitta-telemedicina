-- Vincula (por referência) o e-mail de login pessoal do médico na
-- Memed ao cadastro dele, pra lembrar qual conta usar ao gerar
-- receitas. Não autentica nada — é só um lembrete salvo no cadastro.
alter table doctors
  add column if not exists memed_email text;
