import JSZip from "jszip";
import { formatBytes } from "./format";
import { MAX_FILE_BYTES, UserError } from "./supabase";

export type FolderFile = { path: string; file: File };
export type Folder = { name: string; files: FolderFile[]; bytes: number };

export type Progress =
  | { phase: "lendo"; done: number; total: number; bytes: number }
  | { phase: "compactando"; percent: number }
  | { phase: "enviando"; loaded: number; total: number }
  | { phase: "salvando" };

/** Pasta grande demais para ser de saves: provavelmente é a pasta do jogo. */
export const MAX_FOLDER_BYTES = 1024 * 1024 * 1024;

type DirHandle = {
  name: string;
  kind: "directory";
  values: () => AsyncIterable<DirHandle | FileHandle>;
};
type FileHandle = { name: string; kind: "file"; getFile: () => Promise<File> };

async function walk(dir: DirHandle, prefix: string, out: FolderFile[]) {
  for await (const entry of dir.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "file") out.push({ path, file: await entry.getFile() });
    else await walk(entry, path, out);
  }
}

function pickWithInput(): Promise<Folder | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.style.display = "none";
    document.body.appendChild(input);
    let settled = false;
    const done = (value: Folder | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", () => {
      const list = Array.from(input.files ?? []);
      if (!list.length) return done(null);
      const root = list[0].webkitRelativePath.split("/")[0] || "pasta";
      const files = list.map((file) => ({ path: file.webkitRelativePath.split("/").slice(1).join("/") || file.name, file }));
      done({ name: root, files, bytes: files.reduce((s, f) => s + f.file.size, 0) });
    });
    input.addEventListener("cancel", () => done(null));
    input.click();
  });
}

/** Abre o seletor de pasta. Devolve null se a pessoa cancelar. */
export async function pickFolder(): Promise<Folder | null> {
  const picker = (window as unknown as { showDirectoryPicker?: (o?: object) => Promise<DirHandle> }).showDirectoryPicker;
  if (!picker) return pickWithInput();
  let dir: DirHandle;
  try {
    dir = await picker.call(window, { mode: "read" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    if (err instanceof DOMException && err.name === "SecurityError") return pickWithInput();
    throw new UserError("Não foi possível abrir a pasta. Tente outra pasta ou outro navegador.");
  }
  const files: FolderFile[] = [];
  try {
    await walk(dir, "", files);
  } catch {
    throw new UserError("Não foi possível ler todos os arquivos da pasta. Feche o jogo e tente de novo.");
  }
  return { name: dir.name, files, bytes: files.reduce((s, f) => s + f.file.size, 0) };
}

export function checkFolder(folder: Folder) {
  if (!folder.files.length) throw new UserError(`A pasta "${folder.name}" está vazia. Escolha a pasta que tem os arquivos do save.`);
  if (folder.bytes > MAX_FOLDER_BYTES) {
    throw new UserError(`A pasta "${folder.name}" tem ${formatBytes(folder.bytes)}. Escolha só a pasta de saves, não a pasta do jogo.`);
  }
}

/** Lê os arquivos e gera o ZIP no navegador. */
export async function zipFolder(folder: Folder, onProgress: (p: Progress) => void): Promise<Blob> {
  checkFolder(folder);
  const zip = new JSZip();
  const root = zip.folder(folder.name) ?? zip;
  let bytes = 0;
  for (let i = 0; i < folder.files.length; i++) {
    const { path, file } = folder.files[i];
    let data: ArrayBuffer;
    try {
      data = await file.arrayBuffer();
    } catch {
      throw new UserError(`Não foi possível ler "${path}". Feche o jogo e tente de novo.`);
    }
    root.file(path, data, { date: new Date(file.lastModified) });
    bytes += file.size;
    onProgress({ phase: "lendo", done: i + 1, total: folder.files.length, bytes });
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (meta) =>
    onProgress({ phase: "compactando", percent: meta.percent })
  );
  if (blob.size > MAX_FILE_BYTES) {
    throw new UserError(`O ZIP ficou com ${formatBytes(blob.size)}. O limite é 50 MB por arquivo no plano grátis do Supabase.`);
  }
  return blob;
}

export async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function progressText(p: Progress | null): string {
  if (!p) return "";
  switch (p.phase) {
    case "lendo":
      return `Lendo arquivos: ${p.done} de ${p.total} (${formatBytes(p.bytes)})`;
    case "compactando":
      return `Criando o ZIP: ${Math.round(p.percent)}%`;
    case "enviando":
      return `Enviando: ${Math.round((p.loaded / Math.max(1, p.total)) * 100)}% (${formatBytes(p.loaded)} de ${formatBytes(p.total)})`;
    case "salvando":
      return "Salvando na sua conta…";
  }
}

export function progressValue(p: Progress | null): number {
  if (!p) return 0;
  switch (p.phase) {
    case "lendo":
      return (p.done / Math.max(1, p.total)) * 30;
    case "compactando":
      return 30 + p.percent * 0.3;
    case "enviando":
      return 60 + (p.loaded / Math.max(1, p.total)) * 38;
    case "salvando":
      return 99;
  }
}

/** Baixa um Blob como arquivo. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
