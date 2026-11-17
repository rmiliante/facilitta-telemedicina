-- Preços de referência da tabela CMED/Anvisa (PMC, ICMS 18%), agregados por substância + concentração + forma.
-- Dados importados da lista publicada em 09/11/2026; reimportar quando sair a tabela nova.
create table if not exists public.cmed_precos (
  id bigserial primary key,
  substancia text not null,
  concentracao text not null default '',
  forma text not null default '',
  pmc_caixa_min numeric,
  apresentacao_min text,
  pmc_unidade_min numeric,
  pmc_unidade_med numeric,
  n_apresentacoes int,
  referencia date not null
);
create index if not exists cmed_precos_substancia_idx on public.cmed_precos (substancia);
alter table public.cmed_precos enable row level security;
