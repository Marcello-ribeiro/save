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
