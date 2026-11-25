-- SaveVault v3: TODAS as migrações juntas, na ordem.
-- Cole tudo no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez sem estragar nada.


-- ======================= 001_saves_updated_at.sql =======================
-- SaveVault: data de atualização dos saves.
-- Ao trocar o arquivo de um save, o app grava updated_at. A lista e a
-- biblioteca passam a ordenar por essa coluna.

alter table public.saves
  add column if not exists updated_at timestamptz not null default now();

-- Preenche as linhas que já existiam com a data de criação
update public.saves set updated_at = created_at;

create index if not exists saves_user_updated_idx
  on public.saves (user_id, updated_at desc);


-- ======================= 002_policies_delete.sql =======================
-- SaveVault: policies de RLS para o dono da linha ler, criar, editar e apagar.
-- Pode rodar mais de uma vez. As policies do Postgres são permissivas e se
-- somam: se você já tiver policies parecidas com outros nomes, elas continuam
-- valendo, e estas só garantem que delete e update funcionem.

alter table public.games enable row level security;
alter table public.saves enable row level security;

-- ---------- games ----------
drop policy if exists "games: dono lê" on public.games;
drop policy if exists "games: dono cria" on public.games;
drop policy if exists "games: dono edita" on public.games;
drop policy if exists "games: dono apaga" on public.games;

create policy "games: dono lê" on public.games
  for select to authenticated using (auth.uid() = user_id);
create policy "games: dono cria" on public.games
  for insert to authenticated with check (auth.uid() = user_id);
create policy "games: dono edita" on public.games
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "games: dono apaga" on public.games
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- saves ----------
drop policy if exists "saves: dono lê" on public.saves;
drop policy if exists "saves: dono cria" on public.saves;
drop policy if exists "saves: dono edita" on public.saves;
drop policy if exists "saves: dono apaga" on public.saves;

create policy "saves: dono lê" on public.saves
  for select to authenticated using (auth.uid() = user_id);
create policy "saves: dono cria" on public.saves
  for insert to authenticated with check (auth.uid() = user_id);
create policy "saves: dono edita" on public.saves
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saves: dono apaga" on public.saves
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- storage: buckets game-covers e save-files ----------
-- Os arquivos ficam em <user_id>/<game_id>/<arquivo>. A primeira pasta
-- do caminho precisa ser o id de quem está logado.
drop policy if exists "savevault: dono lê arquivos" on storage.objects;
drop policy if exists "savevault: dono envia arquivos" on storage.objects;
drop policy if exists "savevault: dono troca arquivos" on storage.objects;
drop policy if exists "savevault: dono apaga arquivos" on storage.objects;

create policy "savevault: dono lê arquivos" on storage.objects
  for select to authenticated
  using (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "savevault: dono envia arquivos" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "savevault: dono troca arquivos" on storage.objects
  for update to authenticated
  using (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "savevault: dono apaga arquivos" on storage.objects
  for delete to authenticated
  using (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text);


-- ======================= 003_games_catalog.sql =======================
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


-- ======================= 004_games_v3.sql =======================
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


-- ======================= 005_backups.sql =======================
-- SaveVault v3: backups em ZIP. Cada linha é um arquivo no bucket save-files.
-- deleted_at preenchido = está na lixeira. Pode rodar mais de uma vez.

create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  size_bytes bigint,
  file_count int,
  sha256 text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists backups_user_idx on public.backups (user_id, created_at desc);
create index if not exists backups_game_idx on public.backups (game_id, created_at desc);
create index if not exists backups_sha_idx on public.backups (user_id, sha256);

drop trigger if exists backups_touch_updated_at on public.backups;
create trigger backups_touch_updated_at
  before update on public.backups
  for each row execute function public.touch_updated_at();

alter table public.backups enable row level security;

drop policy if exists "backups: dono lê" on public.backups;
drop policy if exists "backups: dono cria" on public.backups;
drop policy if exists "backups: dono edita" on public.backups;
drop policy if exists "backups: dono apaga" on public.backups;

create policy "backups: dono lê" on public.backups
  for select to authenticated using (auth.uid() = user_id);
create policy "backups: dono cria" on public.backups
  for insert to authenticated with check (auth.uid() = user_id);
create policy "backups: dono edita" on public.backups
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "backups: dono apaga" on public.backups
  for delete to authenticated using (auth.uid() = user_id);


-- ======================= 006_profiles_preferences.sql =======================
-- SaveVault v3: preferências da pessoa (tema, cor, seção inicial...).
-- A tabela profiles já existe no projeto, com id = id do usuário.
-- Se não existir, é criada aqui. Pode rodar mais de uma vez.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

-- Em profiles o dono é a própria linha: id = auth.uid()
drop policy if exists "profiles: dono lê" on public.profiles;
drop policy if exists "profiles: dono cria" on public.profiles;
drop policy if exists "profiles: dono edita" on public.profiles;
drop policy if exists "profiles: dono apaga" on public.profiles;

create policy "profiles: dono lê" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles: dono cria" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles: dono edita" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles: dono apaga" on public.profiles
  for delete to authenticated using (auth.uid() = id);


-- ======================= 007_saves_to_backups.sql =======================
-- SaveVault v3: copia os saves antigos para a tabela backups.
-- A tabela saves continua existindo. Pode rodar mais de uma vez: só copia
-- o que ainda não foi copiado. O tamanho vem dos metadados do Storage.

insert into public.backups (user_id, game_id, file_path, file_name, size_bytes, note, created_at, updated_at)
select
  s.user_id,
  s.game_id,
  s.file_url,
  coalesce(nullif(s.file_name, ''), s.name, 'save'),
  (o.metadata ->> 'size')::bigint,
  s.description,
  s.created_at,
  coalesce(s.updated_at, s.created_at)
from public.saves s
left join storage.objects o
  on o.bucket_id = 'save-files' and o.name = s.file_url
where s.file_url is not null
  and not exists (
    select 1 from public.backups b
    where b.user_id = s.user_id and b.file_path = s.file_url
  );


-- ======================= 008_storage_policies.sql =======================
-- SaveVault v3: buckets privados e acesso só à pasta <user_id>/...
-- Também garante as policies de games (as mesmas da 002). Pode rodar mais
-- de uma vez.

insert into storage.buckets (id, name, public)
values ('game-covers', 'game-covers', false), ('save-files', 'save-files', false)
on conflict (id) do update set public = false;

drop policy if exists "savevault: dono lê arquivos" on storage.objects;
drop policy if exists "savevault: dono envia arquivos" on storage.objects;
drop policy if exists "savevault: dono troca arquivos" on storage.objects;
drop policy if exists "savevault: dono apaga arquivos" on storage.objects;

create policy "savevault: dono lê arquivos" on storage.objects
  for select to authenticated
  using (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "savevault: dono envia arquivos" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "savevault: dono troca arquivos" on storage.objects
  for update to authenticated
  using (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "savevault: dono apaga arquivos" on storage.objects
  for delete to authenticated
  using (bucket_id in ('game-covers', 'save-files') and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.games enable row level security;

drop policy if exists "games: dono lê" on public.games;
drop policy if exists "games: dono cria" on public.games;
drop policy if exists "games: dono edita" on public.games;
drop policy if exists "games: dono apaga" on public.games;

create policy "games: dono lê" on public.games
  for select to authenticated using (auth.uid() = user_id);
create policy "games: dono cria" on public.games
  for insert to authenticated with check (auth.uid() = user_id);
create policy "games: dono edita" on public.games
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "games: dono apaga" on public.games
  for delete to authenticated using (auth.uid() = user_id);
