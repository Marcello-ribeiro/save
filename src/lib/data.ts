import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { catalogById, type CatalogGame } from "./catalog";
import { formatBytes, slugify, stamp } from "./format";
import { sha256, zipFolder, type Folder, type Progress } from "./folder";
import { BUCKET_COVERS, BUCKET_SAVES, MAX_FILE_BYTES, SUPABASE_KEY, SUPABASE_URL, UserError, supabase } from "./supabase";

export type Game = {
  id: string;
  user_id: string;
  name: string;
  cover_url: string | null;
  cover_source: "catalog" | "upload" | null;
  catalog_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Backup = {
  id: string;
  user_id: string;
  game_id: string;
  file_path: string;
  file_name: string;
  size_bytes: number | null;
  file_count: number | null;
  sha256: string | null;
  note: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type GameWithStats = Game & {
  coverSrc: string | null;
  activeCount: number;
  lastBackupAt: string | null;
};

export const TRASH_DAYS = 30;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
type Undo = () => PromiseLike<unknown>;

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new UserError("Entre na sua conta para continuar.");
  return id;
}

async function rollback(undo: Undo[]) {
  for (const fn of [...undo].reverse()) {
    try {
      await fn();
    } catch {
      /* segue desfazendo o resto */
    }
  }
}

const removeFiles = (bucket: string, paths: string[]) => (paths.length ? supabase.storage.from(bucket).remove(paths) : Promise.resolve());

// ---------- capas ----------

const signedCache = new Map<string, { url: string; until: number }>();

/** Capas do catálogo usam a URL direta; capas enviadas usam URL assinada. */
export async function resolveCovers<T extends Game>(games: T[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const need: string[] = [];
  const now = Date.now();
  for (const g of games) {
    if (!g.cover_url) out.set(g.id, catalogById(g.catalog_id)?.cover ?? null);
    else if (g.cover_source === "catalog" || /^https?:\/\//.test(g.cover_url)) out.set(g.id, g.cover_url);
    else {
      const hit = signedCache.get(g.cover_url);
      if (hit && hit.until > now) out.set(g.id, hit.url);
      else need.push(g.cover_url);
    }
  }
  if (need.length) {
    const { data } = await supabase.storage.from(BUCKET_COVERS).createSignedUrls(need, 3600);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) signedCache.set(row.path, { url: row.signedUrl, until: now + 50 * 60 * 1000 });
    }
    for (const g of games) {
      if (!out.has(g.id)) out.set(g.id, (g.cover_url && signedCache.get(g.cover_url)?.url) || null);
    }
  }
  return out;
}

function checkCover(file: File) {
  if (!file.type.startsWith("image/")) throw new UserError("A capa precisa ser uma imagem (JPG, PNG ou WebP).");
  if (file.size > MAX_COVER_BYTES) throw new UserError(`A capa tem ${formatBytes(file.size)}. Use uma imagem de até 5 MB.`);
}

function coverExt(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^(jpe?g|png|webp|gif|avif)$/.test(fromName)) return fromName;
  return file.type.split("/")[1] || "img";
}

// ---------- leitura ----------

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase.from("games").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Game[];
}

export async function fetchBackups(): Promise<Backup[]> {
  const { data, error } = await supabase.from("backups").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Backup[];
}

export async function fetchLibrary(): Promise<GameWithStats[]> {
  const [games, backups] = await Promise.all([fetchGames(), fetchBackups()]);
  const covers = await resolveCovers(games);
  return games.map((g) => {
    const mine = backups.filter((b) => b.game_id === g.id && !b.deleted_at);
    return { ...g, coverSrc: covers.get(g.id) ?? null, activeCount: mine.length, lastBackupAt: mine[0]?.created_at ?? null };
  });
}

type Load<T> = { status: "idle" | "loading" | "ready" | "error"; data: T | null; error: unknown; reload: () => void };

/** Carrega dados da conta. Sem login, fica em "idle". */
export function useAccountData<T>(loader: () => Promise<T>, deps: unknown[] = []): Load<T> {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<Omit<Load<T>, "reload">>({ status: "loading", data: null, error: null });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  const userId = user?.id;

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setState({ status: "idle", data: null, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, status: s.data ? "ready" : "loading" }));
    loader().then(
      (data) => alive && setState({ status: "ready", data, error: null }),
      (error) => alive && setState({ status: "error", data: null, error })
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authLoading, tick, ...deps]);

  return { ...state, reload };
}

// ---------- envio com progresso ----------

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Envia direto para a API do Storage para poder mostrar o progresso. */
export async function uploadWithProgress(bucket: string, path: string, blob: Blob, contentType: string, onProgress?: (loaded: number, total: number) => void) {
  if (blob.size > MAX_FILE_BYTES) throw new UserError(`O arquivo tem ${formatBytes(blob.size)}. O limite é 50 MB por arquivo no plano grátis do Supabase.`);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new UserError("Sua sessão expirou. Entre de novo.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded, e.lengthComputable ? e.total : blob.size);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `HTTP ${xhr.status}`;
      try {
        message = JSON.parse(xhr.responseText).message || message;
      } catch {
        /* resposta sem JSON */
      }
      if (xhr.status === 413) return reject(new UserError("O arquivo passou do limite de 50 MB do Storage."));
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Failed to fetch"));
    xhr.send(blob);
  });
}

async function uploadCover(uid: string, gameId: string, file: File, undo: Undo[]): Promise<string> {
  checkCover(file);
  const path = `${uid}/${gameId}/capa-${Date.now()}.${coverExt(file)}`;
  const { error } = await supabase.storage.from(BUCKET_COVERS).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  undo.push(() => removeFiles(BUCKET_COVERS, [path]));
  return path;
}

// ---------- jogos ----------

export type CoverChoice = { kind: "catalog"; url: string } | { kind: "upload"; file: File } | { kind: "none" };

export async function createGame(
  input: { name: string; catalog: CatalogGame | null; cover: CoverChoice; folder: Folder | null; note?: string },
  onProgress: (p: Progress) => void
): Promise<Game> {
  const name = input.name.trim();
  if (!name) throw new UserError("Digite o nome do jogo.");
  const uid = await requireUserId();
  const undo: Undo[] = [];
  try {
    // o ZIP sai antes de qualquer envio: se a pasta for inválida, nada sobe
    const zip = input.folder ? await zipFolder(input.folder, onProgress) : null;

    const gameId = crypto.randomUUID();
    let cover_url: string | null = null;
    let cover_source: Game["cover_source"] = null;
    if (input.cover.kind === "catalog") {
      cover_url = input.cover.url;
      cover_source = "catalog";
    } else if (input.cover.kind === "upload") {
      cover_url = await uploadCover(uid, gameId, input.cover.file, undo);
      cover_source = "upload";
    }

    const { data, error } = await supabase
      .from("games")
      .insert({ id: gameId, user_id: uid, name, catalog_id: input.catalog?.id ?? null, cover_url, cover_source: cover_source ?? "upload" })
      .select()
      .single();
    if (error) throw error;
    undo.push(() => supabase.from("games").delete().eq("id", gameId).then());

    if (zip && input.folder) await sendBackup(uid, data as Game, zip, input.folder, input.note ?? "", onProgress, undo);
    return data as Game;
  } catch (err) {
    await rollback(undo);
    throw err;
  }
}

async function sendBackup(uid: string, game: Game, zip: Blob, folder: Folder, note: string, onProgress: (p: Progress) => void, undo: Undo[]) {
  const hash = await sha256(zip);
  const when = stamp();
  const path = `${uid}/${game.id}/${when}-${crypto.randomUUID().slice(0, 8)}.zip`;
  await uploadWithProgress(BUCKET_SAVES, path, zip, "application/zip", (loaded, total) => onProgress({ phase: "enviando", loaded, total }));
  undo.push(() => removeFiles(BUCKET_SAVES, [path]));
  onProgress({ phase: "salvando" });
  const { data, error } = await supabase
    .from("backups")
    .insert({
      user_id: uid,
      game_id: game.id,
      file_path: path,
      file_name: `${slugify(game.name)}_${when}.zip`,
      size_bytes: zip.size,
      file_count: folder.files.length,
      sha256: hash,
      note: note.trim() || null
    })
    .select("id")
    .single();
  if (error) throw error;
  undo.push(() => supabase.from("backups").delete().eq("id", data.id).then());
  await supabase.from("games").update({ updated_at: new Date().toISOString() }).eq("id", game.id);
}

/** Novo backup de um jogo que já existe. */
export async function createBackup(game: Game, folder: Folder, note: string, onProgress: (p: Progress) => void) {
  const uid = await requireUserId();
  const undo: Undo[] = [];
  try {
    const zip = await zipFolder(folder, onProgress);
    await sendBackup(uid, game, zip, folder, note, onProgress, undo);
  } catch (err) {
    await rollback(undo);
    throw err;
  }
}

export async function updateGame(game: Game, input: { name: string; cover: CoverChoice | null }) {
  const name = input.name.trim();
  if (!name) throw new UserError("Digite o nome do jogo.");
  const uid = await requireUserId();
  const undo: Undo[] = [];
  const patch: Partial<Game> = { name };
  try {
    if (input.cover?.kind === "upload") {
      patch.cover_url = await uploadCover(uid, game.id, input.cover.file, undo);
      patch.cover_source = "upload";
    } else if (input.cover?.kind === "catalog") {
      patch.cover_url = input.cover.url;
      patch.cover_source = "catalog";
    } else if (input.cover?.kind === "none") {
      patch.cover_url = null;
    }
    const { error } = await supabase.from("games").update(patch).eq("id", game.id);
    if (error) throw error;
  } catch (err) {
    await rollback(undo);
    throw err;
  }
  // a capa antiga só sai depois que a nova foi gravada
  if (input.cover && game.cover_source === "upload" && game.cover_url && game.cover_url !== patch.cover_url) {
    await removeFiles(BUCKET_COVERS, [game.cover_url]);
  }
}

export async function deleteGame(game: Game) {
  const { data, error } = await supabase.from("backups").select("file_path").eq("game_id", game.id);
  if (error) throw error;
  const paths = (data ?? []).map((b) => b.file_path as string);
  const { data: legacy } = await supabase.from("saves").select("file_url").eq("game_id", game.id);
  for (const s of legacy ?? []) if (s.file_url && !paths.includes(s.file_url)) paths.push(s.file_url);

  if (paths.length) {
    const { error: filesError } = await supabase.storage.from(BUCKET_SAVES).remove(paths);
    if (filesError) throw filesError;
  }
  if (game.cover_source === "upload" && game.cover_url) await removeFiles(BUCKET_COVERS, [game.cover_url]);
  await supabase.from("saves").delete().eq("game_id", game.id);
  const { error: rowsError } = await supabase.from("backups").delete().eq("game_id", game.id);
  if (rowsError) throw rowsError;
  const { error: gameError } = await supabase.from("games").delete().eq("id", game.id);
  if (gameError) throw gameError;
}

// ---------- backups ----------

export async function downloadBackup(backup: Backup) {
  const { data, error } = await supabase.storage.from(BUCKET_SAVES).createSignedUrl(backup.file_path, 120, { download: backup.file_name });
  if (error || !data) throw error ?? new Error("sem URL");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function editBackup(id: string, fields: { file_name: string; note: string }) {
  let file_name = fields.file_name.trim();
  if (!file_name) throw new UserError("Digite um nome para o backup.");
  if (!/\.[a-z0-9]{1,5}$/i.test(file_name)) file_name += ".zip";
  const { error } = await supabase.from("backups").update({ file_name, note: fields.note.trim() || null }).eq("id", id);
  if (error) throw error;
}

export async function trashBackup(id: string) {
  const { error } = await supabase.from("backups").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function restoreBackup(id: string) {
  const { error } = await supabase.from("backups").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

export async function deleteBackupsForever(backups: Backup[]) {
  if (!backups.length) return;
  const paths = backups.map((b) => b.file_path);
  const { error } = await supabase.storage.from(BUCKET_SAVES).remove(paths);
  if (error) throw error;
  // linhas antigas de "saves" com o mesmo arquivo também saem, para a migração 007 não trazê-las de volta
  await supabase.from("saves").delete().in("file_url", paths);
  const { error: rowsError } = await supabase.from("backups").delete().in("id", backups.map((b) => b.id));
  if (rowsError) throw rowsError;
}

export function isOldTrash(b: Backup, now = Date.now()) {
  return Boolean(b.deleted_at) && now - new Date(b.deleted_at as string).getTime() > TRASH_DAYS * 24 * 60 * 60 * 1000;
}
