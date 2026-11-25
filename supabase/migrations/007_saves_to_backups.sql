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
