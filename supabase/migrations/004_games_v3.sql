-- SaveVault v3: jogos do catálogo novo (Steam + PCGamingWiki).
-- catalog_id passa a ser texto (o App ID da Steam). Os ids antigos, do
-- catálogo RAWG, ganham o prefixo "rawg-" para não colidir com os novos.
-- Pode rodar mais de uma vez.

alter table public.games
  add column if not exists catalog_id text,
  add column if not exists cover_source text not null default 'upload',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'games' and column_name = 'catalog_id') <> 'text' then
    alter table public.games alter column catalog_id type text using ('rawg-' || catalog_id::text);
  end if;
end $$;

alter table public.games drop constraint if exists games_cover_source_check;
alter table public.games
  add constraint games_cover_source_check check (cover_source in ('catalog', 'upload'));

-- updated_at muda sozinho a cada alteração
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row execute function public.touch_updated_at();

create index if not exists games_user_idx on public.games (user_id, updated_at desc);
