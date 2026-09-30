-- Dados do médico que saem na receita (Res. CFM 2.314/2022, art. 13):
-- RQE (Registro de Qualificação de Especialista) e endereço profissional.
alter table doctors add column if not exists rqe text;
alter table doctors add column if not exists endereco_profissional text;
notify pgrst, 'reload schema';
