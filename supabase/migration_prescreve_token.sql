alter table public.doctors add column if not exists prescreve_token_enc text, add column if not exists prescreve_token_exp timestamptz;
