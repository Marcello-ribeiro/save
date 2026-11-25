import JSZip from "jszip";
import { fetchBackups, fetchGames, uploadWithProgress, type Backup, type Game } from "./data";
import { normalize, stamp } from "./format";
import { saveBlob, sha256 } from "./folder";
import { BUCKET_COVERS, BUCKET_SAVES, UserError, supabase } from "./supabase";

/*
  Arquivo .savevault: um ZIP com manifest.json, as capas enviadas pela
  pessoa (covers/) e todos os backups, inclusive os da lixeira (backups/).
*/

const FORMAT = "savevault";
const VERSION = 1;

type ManifestBackup = {
  file: string;
  file_name: string;
  size_bytes: number;
  file_count: number | null;
  sha256: string;
  note: string | null;
  created_at: string;
  deleted_at: string | null;
};

type ManifestGame = {
  name: string;
  catalog_id: string | null;
  cover_source: "catalog" | "upload" | null;
  cover_url: string | null;
  cover_file: string | null;
  created_at: string;
  backups: ManifestBackup[];
};

type Manifest = { format: string; version: number; exported_at: string; games: ManifestGame[] };

export type TransferProgress = { label: string; done: number; total: number };

async function download(bucket: string, path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error("download vazio");
  return data;
}

export async function exportLibrary(onProgress: (p: TransferProgress) => void) {
  const [games, backups] = await Promise.all([fetchGames(), fetchBackups()]);
  if (!games.length) throw new UserError("A biblioteca está vazia. Cadastre um jogo antes de exportar.");
  const zip = new JSZip();
  const manifest: Manifest = { format: FORMAT, version: VERSION, exported_at: new Date().toISOString(), games: [] };
  const total = games.length + backups.length;
  let done = 0;

  for (const game of games) {
    let cover_file: string | null = null;
    if (game.cover_source === "upload" && game.cover_url && !/^https?:/.test(game.cover_url)) {
      try {
        const blob = await download(BUCKET_COVERS, game.cover_url);
        cover_file = `covers/${game.id}.${game.cover_url.split(".").pop() || "img"}`;
        zip.file(cover_file, blob);
      } catch {
        cover_file = null; // capa sumiu do Storage: exporta o jogo sem ela
      }
    }
    onProgress({ label: `Capas: ${game.name}`, done: ++done, total });

    const entries: ManifestBackup[] = [];
    for (const b of backups.filter((x) => x.game_id === game.id)) {
      const blob = await download(BUCKET_SAVES, b.file_path);
      const file = `backups/${b.id}/${b.file_name}`;
      zip.file(file, blob);
      entries.push({
        file,
        file_name: b.file_name,
        size_bytes: blob.size,
        file_count: b.file_count,
        sha256: b.sha256 || (await sha256(blob)),
        note: b.note,
        created_at: b.created_at,
        deleted_at: b.deleted_at
      });
      onProgress({ label: `Backups: ${game.name}`, done: ++done, total });
    }

    manifest.games.push({
      name: game.name,
      catalog_id: game.catalog_id,
      cover_source: game.cover_source,
      cover_url: game.cover_source === "catalog" ? game.cover_url : null,
      cover_file,
      created_at: game.created_at,
      backups: entries
    });
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  onProgress({ label: "Montando o arquivo", done: total, total });
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  saveBlob(blob, `biblioteca-${stamp()}.savevault`);
  return { games: games.length, backups: backups.length, bytes: blob.size };
}

// ---------- importar ----------

type PlannedGame = {
  source: ManifestGame;
  existing: Game | null;
  newBackups: ManifestBackup[];
  duplicates: number;
};

export type ImportPlan = {
  zip: JSZip;
  fileName: string;
  games: PlannedGame[];
  newGames: number;
  matchedGames: number;
  newBackups: number;
  duplicates: number;
  bytes: number;
};

export async function readArchive(file: File): Promise<ImportPlan> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new UserError("Este arquivo não é um .savevault válido.");
  }
  const entry = zip.file("manifest.json");
  if (!entry) throw new UserError("O arquivo não tem manifest.json. Exporte de novo pelo SaveVault.");
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await entry.async("string"));
  } catch {
    throw new UserError("O manifest.json do arquivo está corrompido.");
  }
  if (manifest.format !== FORMAT || !Array.isArray(manifest.games)) throw new UserError("Este arquivo não é um .savevault válido.");
  if (manifest.version > VERSION) throw new UserError("O arquivo foi criado por uma versão mais nova do SaveVault.");

  const [games, backups] = await Promise.all([fetchGames(), fetchBackups()]);
  const planned: PlannedGame[] = manifest.games.map((g) => {
    const existing =
      (g.catalog_id && games.find((x) => x.catalog_id === g.catalog_id)) || games.find((x) => normalize(x.name) === normalize(g.name)) || null;
    const known = new Set(existing ? backups.filter((b: Backup) => b.game_id === existing.id && b.sha256).map((b) => b.sha256) : []);
    const fresh: ManifestBackup[] = [];
    let duplicates = 0;
    for (const b of g.backups ?? []) {
      if (known.has(b.sha256)) duplicates++;
      else {
        known.add(b.sha256);
        fresh.push(b);
      }
    }
    return { source: g, existing, newBackups: fresh, duplicates };
  });

  return {
    zip,
    fileName: file.name,
    games: planned,
    newGames: planned.filter((p) => !p.existing).length,
    matchedGames: planned.filter((p) => p.existing).length,
    newBackups: planned.reduce((s, p) => s + p.newBackups.length, 0),
    duplicates: planned.reduce((s, p) => s + p.duplicates, 0),
    bytes: planned.reduce((s, p) => s + p.newBackups.reduce((t, b) => t + (b.size_bytes || 0), 0), 0)
  };
}

/** Sobe tudo para a conta. Se algo falhar, desfaz o que já tinha subido. */
export async function runImport(plan: ImportPlan, onProgress: (p: TransferProgress) => void) {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new UserError("Entre na sua conta para importar.");

  const uploaded: { bucket: string; path: string }[] = [];
  const createdGames: string[] = [];
  const createdBackups: string[] = [];
  const total = plan.games.length + plan.newBackups;
  let done = 0;

  try {
    for (const item of plan.games) {
      const g = item.source;
      let gameId = item.existing?.id ?? null;
      if (!gameId) {
        gameId = crypto.randomUUID();
        let cover_url = g.cover_source === "catalog" ? g.cover_url : null;
        if (g.cover_file) {
          const blob = await plan.zip.file(g.cover_file)?.async("blob");
          if (blob) {
            const path = `${uid}/${gameId}/capa-${Date.now()}.${g.cover_file.split(".").pop()}`;
            const { error } = await supabase.storage.from(BUCKET_COVERS).upload(path, blob, { upsert: false });
            if (error) throw error;
            uploaded.push({ bucket: BUCKET_COVERS, path });
            cover_url = path;
          }
        }
        const { error } = await supabase.from("games").insert({
          id: gameId,
          user_id: uid,
          name: g.name,
          catalog_id: g.catalog_id,
          cover_url,
          cover_source: g.cover_file ? "upload" : g.cover_source ?? "upload",
          created_at: g.created_at
        });
        if (error) throw error;
        createdGames.push(gameId);
      }
      onProgress({ label: `Jogo: ${g.name}`, done: ++done, total });

      for (const b of item.newBackups) {
        const blob = await plan.zip.file(b.file)?.async("blob");
        if (!blob) throw new UserError(`O arquivo ${b.file_name} está faltando dentro do .savevault.`);
        const path = `${uid}/${gameId}/${stamp(new Date(b.created_at))}-${crypto.randomUUID().slice(0, 8)}.zip`;
        await uploadWithProgress(BUCKET_SAVES, path, blob, "application/zip");
        uploaded.push({ bucket: BUCKET_SAVES, path });
        const { data, error } = await supabase
          .from("backups")
          .insert({
            user_id: uid,
            game_id: gameId,
            file_path: path,
            file_name: b.file_name,
            size_bytes: blob.size,
            file_count: b.file_count,
            sha256: b.sha256,
            note: b.note,
            created_at: b.created_at,
            deleted_at: b.deleted_at
          })
          .select("id")
          .single();
        if (error) throw error;
        createdBackups.push(data.id);
        onProgress({ label: `Backup: ${b.file_name}`, done: ++done, total });
      }
    }
  } catch (err) {
    if (createdBackups.length) await supabase.from("backups").delete().in("id", createdBackups);
    if (createdGames.length) await supabase.from("games").delete().in("id", createdGames);
    for (const bucket of [BUCKET_SAVES, BUCKET_COVERS]) {
      const paths = uploaded.filter((u) => u.bucket === bucket).map((u) => u.path);
      if (paths.length) await supabase.storage.from(bucket).remove(paths);
    }
    throw err;
  }
  return { games: createdGames.length, backups: createdBackups.length };
}
