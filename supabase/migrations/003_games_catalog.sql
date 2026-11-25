-- SaveVault: jogos escolhidos no catálogo (RAWG) ou enviados pela pessoa.
-- catalog_id: id do jogo no data/catalog.json (nulo para jogos fora da lista).
-- cover_source: 'catalog' quando cover_url é a URL pública do RAWG,
--               'upload' quando cover_url é um caminho no bucket game-covers.

alter table public.games
  add column if not exists catalog_id integer,
  add column if not exists cover_source text not null default 'upload';

alter table public.games drop constraint if exists games_cover_source_check;
alter table public.games
  add constraint games_cover_source_check check (cover_source in ('catalog', 'upload'));

-- Cada pessoa tem no máximo um jogo para cada item do catálogo
create unique index if not exists games_user_catalog_idx
  on public.games (user_id, catalog_id)
  where catalog_id is not null;
