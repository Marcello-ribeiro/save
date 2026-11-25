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
