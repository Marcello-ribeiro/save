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
