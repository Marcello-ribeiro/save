-- SaveVault: data de atualização dos saves.
-- Ao trocar o arquivo de um save, o app grava updated_at. A lista e a
-- biblioteca passam a ordenar por essa coluna.

alter table public.saves
  add column if not exists updated_at timestamptz not null default now();

-- Preenche as linhas que já existiam com a data de criação
update public.saves set updated_at = created_at;

create index if not exists saves_user_updated_idx
  on public.saves (user_id, updated_at desc);
