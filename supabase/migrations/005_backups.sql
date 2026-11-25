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
