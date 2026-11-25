import data from "../data/catalog.json";
import { normalize } from "./format";

export type SavePath = { store: string; path: string };
export type CatalogGame = {
  id: string;
  name: string;
  steamAppId: number;
  savePaths: SavePath[];
  sourceUrl: string;
  cover: string | null;
};

export const catalog = data as CatalogGame[];
const keyed = catalog.map((g) => ({ game: g, key: normalize(g.name) }));

export function searchCatalog(query: string): CatalogGame[] {
  const q = normalize(query);
  if (!q) return catalog;
  const words = q.split(" ");
  return keyed.filter(({ key }) => words.every((w) => key.includes(w))).map(({ game }) => game);
}

export function catalogById(id: string | null | undefined): CatalogGame | null {
  if (!id) return null;
  return catalog.find((g) => g.id === id) ?? null;
}

export function catalogByName(name: string): CatalogGame | null {
  const q = normalize(name);
  if (!q) return null;
  return keyed.find(({ key }) => key === q)?.game ?? null;
}

/** Agrupa os caminhos por loja, na ordem em que aparecem. */
export function pathsByStore(paths: SavePath[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const p of paths) groups.set(p.store, [...(groups.get(p.store) ?? []), p.path]);
  return [...groups.entries()];
}
