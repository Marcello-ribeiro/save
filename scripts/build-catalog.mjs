// Gera src/data/catalog.json: ~350 jogos populares de PC, com capa da
// Steam e as pastas de saves no Windows tiradas da PCGamingWiki.
//
//   node scripts/build-catalog.mjs
//
// Não precisa de chave. Leva alguns minutos porque consulta a PCGamingWiki
// jogo por jogo, com uma pausa entre as chamadas. As imagens não são
// baixadas: o catálogo guarda só a URL da CDN da Steam.
//
// Se a API da PCGamingWiki recusar acesso automático (ela fica atrás de uma
// checagem da Cloudflare), o script usa o manifesto do Ludusavi, que é
// gerado a partir das mesmas páginas da PCGamingWiki e fica no GitHub.
import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

const TARGET = 360;
const OUT = path.join(import.meta.dirname, "..", "src", "data", "catalog.json");
const HEADERS = { "User-Agent": "SaveVault-catalog-builder/1.0 (script local)" };
const WIKI = "https://www.pcgamingwiki.com/w/api.php";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) return await res.json();
      if (res.status === 429) await sleep(5000 * (i + 1));
    } catch {
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

// Programas que aparecem nas listas da Steam mas não são jogos
const NOT_GAMES = new Set([431960, 228980, 250820, 1070560, 1391110, 1493710, 404790, 365670, 755790, 2420110, 1905180, 1172470]);

// ---------- 1. Lista de jogos: mais jogados da Steam ----------

async function candidates() {
  const order = [];
  const seen = new Set();
  const add = (appid) => {
    appid = Number(appid);
    if (!appid || NOT_GAMES.has(appid) || seen.has(appid)) return;
    seen.add(appid);
    order.push(appid);
  };

  const charts = await getJson("https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/");
  for (const r of charts?.response?.ranks || []) add(r.appid);
  console.log("Steam (mais jogados agora):", order.length);

  // A Steam só devolve 100; a SteamSpy completa com outras listas
  for (const request of ["top100in2weeks", "top100forever", "top100owned"]) {
    const data = await getJson(`https://steamspy.com/api.php?request=${request}`);
    for (const g of Object.values(data || {})) add(g.appid);
    console.log(`SteamSpy ${request}:`, order.length);
    await sleep(1200);
  }
  if (order.length < TARGET * 1.6) {
    const data = await getJson("https://steamspy.com/api.php?request=all&page=0");
    const all = Object.values(data || {}).sort((a, b) => (b.ccu || 0) - (a.ccu || 0));
    for (const g of all) add(g.appid);
    console.log("SteamSpy all (por jogadores):", order.length);
  }
  return { order };
}

// ---------- 2. Página de cada jogo na PCGamingWiki ----------

async function pagesFor(appids) {
  const pages = new Map();
  for (let i = 0; i < appids.length; i += 20) {
    const chunk = appids.slice(i, i + 20);
    const where = chunk.map((id) => `Infobox_game.Steam_AppID HOLDS "${id}"`).join(" OR ");
    const url = `${WIKI}?action=cargoquery&format=json&limit=100&tables=Infobox_game`
      + `&fields=Infobox_game._pageName=Page,Infobox_game.Steam_AppID=AppID&where=${encodeURIComponent(where)}`;
    const data = await getJson(url);
    for (const row of data?.cargoquery || []) {
      const ids = String(row.title.AppID || "").split(",").map((s) => Number(s.trim()));
      for (const id of chunk) if (ids.includes(id) && !pages.has(id)) pages.set(id, row.title.Page);
    }
    await sleep(700);
  }
  return pages;
}

// ---------- 3. Caminhos de saves ----------

const PLACEHOLDERS = {
  appdata: "%APPDATA%",
  localappdata: "%LOCALAPPDATA%",
  "userprofile\\documents": "%USERPROFILE%\\Documents",
  "userprofile\\appdata\\locallow": "%USERPROFILE%\\AppData\\LocalLow",
  userprofile: "%USERPROFILE%",
  programdata: "%PROGRAMDATA%",
  public: "%PUBLIC%",
  username: "%USERNAME%",
  steam: "Pasta da Steam",
  game: "Pasta do jogo",
  uid: "<ID do perfil>",
  ubisoftconnect: "Pasta do Ubisoft Connect",
  uplay: "Pasta do Ubisoft Connect",
  windir: "%WINDIR%"
};

const STORES = {
  windows: "Windows",
  steam: "Steam",
  "microsoft store": "Microsoft Store",
  "epic games store": "Epic Games Store",
  "epic games launcher": "Epic Games Store",
  "gog.com": "GOG",
  gog: "GOG",
  "ubisoft connect": "Ubisoft Connect",
  uplay: "Ubisoft Connect",
  "ea app": "EA app",
  origin: "EA app"
};

function cleanPath(raw) {
  let s = raw;
  s = s.replace(/<ref[^>]*\/>/gi, "").replace(/<ref[\s\S]*?<\/ref>/gi, "");
  s = s.replace(/\{\{p\|([^}]+)\}\}/gi, (_, key) => {
    const k = key.trim().toLowerCase();
    return PLACEHOLDERS[k] ?? `%${k.toUpperCase()}%`;
  });
  s = s.replace(/\{\{[^{}]*\}\}/g, "");               // notas, {{CN}} etc.
  s = s.replace(/<user[- ]?id>/gi, "<ID do perfil>");
  s = s.replace(/<steam[- ]?id[^>]*>/gi, "<ID do perfil>");
  s = s.replace(/<[a-z/][^>]*>/gi, "");                // html que sobrou
  s = s.replace(/'''?/g, "").replace(/\s+/g, " ").trim();
  return s;
}

function savePathsFrom(wikitext) {
  const start = wikitext.search(/===\s*Save game data location\s*===/i);
  if (start < 0) return [];
  const rest = wikitext.slice(start + 10);
  const end = rest.search(/\n===?[^=]/);
  const section = end >= 0 ? rest.slice(0, end) : rest;

  const out = [];
  // {{Game data/saves|Plataforma|caminho1|caminho2...}} com {{p|...}} dentro
  const re = /\{\{Game data\/saves\|([^|}]+)\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/gi;
  let m;
  while ((m = re.exec(section))) {
    const store = STORES[m[1].trim().toLowerCase()];
    if (!store) continue;                              // Mac, Linux, PlayStation...
    for (const part of m[2].split(/\|(?![^{]*\}\})|<br\s*\/?>/i)) {
      const p = cleanPath(part);
      if (!p || /^HKEY_|registry/i.test(p) || p.length < 4) continue;
      if (!out.some((o) => o.store === store && o.path === p)) out.push({ store, path: p });
    }
  }
  return out;
}

async function wikitextOf(page) {
  const url = `${WIKI}?action=parse&format=json&prop=wikitext&page=${encodeURIComponent(page)}`;
  const data = await getJson(url);
  return data?.parse?.wikitext?.["*"] || "";
}

// ---------- 4. Capa ----------

const coverUrl = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;

async function hasCover(appid) {
  try {
    const res = await fetch(coverUrl(appid), { method: "HEAD", headers: HEADERS });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- 5. Alternativa: manifesto do Ludusavi ----------

const LUDUSAVI = "https://raw.githubusercontent.com/mtkennerly/ludusavi-manifest/master/data/manifest.yaml";

const LUDU_STORES = {
  steam: "Steam",
  gog: "GOG",
  epic: "Epic Games Store",
  microsoft: "Microsoft Store",
  uplay: "Ubisoft Connect",
  ubisoft: "Ubisoft Connect",
  origin: "EA app",
  ea: "EA app"
};

const LUDU_PLACEHOLDERS = {
  "<winAppData>": "%APPDATA%",
  "<winLocalAppData>": "%LOCALAPPDATA%",
  "<winLocalAppDataLow>": "%USERPROFILE%/AppData/LocalLow",
  "<winDocuments>": "%USERPROFILE%/Documents",
  "<winPublic>": "%PUBLIC%",
  "<winProgramData>": "%PROGRAMDATA%",
  "<winDir>": "%WINDIR%",
  "<home>": "%USERPROFILE%",
  "<base>": "Pasta do jogo",
  "<storeUserId>": "<ID do perfil>",
  "<osUserName>": "%USERNAME%"
};

// Guarda a pasta, não o arquivo: "x/remote/*.sav" vira "x/remote"
function folderOf(p) {
  const parts = p.split("/");
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (/[*?]/.test(last) || /\.[a-z0-9]{1,5}$/i.test(last)) parts.pop();
    else break;
  }
  return parts.join("/");
}

function ludusaviPaths(entry, appid) {
  const out = [];
  for (const [raw, info] of Object.entries(entry.files || {})) {
    const tags = info?.tags || [];
    if (tags.length && !tags.includes("save")) continue;
    if (/^<(xdg|regHk)/.test(raw) || raw.includes("/Library/")) continue;
    const whens = info?.when?.length ? info.when : [{}];
    for (const when of whens) {
      if (when.os && when.os !== "windows") continue;
      const store = when.store ? LUDU_STORES[when.store] : "Windows";
      if (!store) continue;
      if (raw.startsWith("<home>") && when.os !== "windows" && !when.store) continue;
      let p = folderOf(raw);
      if (p.startsWith("<root>")) {
        if (when.store !== "steam") continue;
        p = p.replace("<root>", "Pasta da Steam");
      }
      p = p.replace("<game>", entry.installDir ? Object.keys(entry.installDir)[0] : "Pasta do jogo");
      p = p.replace("<storeGameId>", String(appid));
      for (const [k, v] of Object.entries(LUDU_PLACEHOLDERS)) p = p.split(k).join(v);
      if (/<[a-zA-Z]+>/.test(p.replace("<ID do perfil>", ""))) continue;
      p = p.replace(/\//g, "\\");
      if (!out.some((o) => o.store === store && o.path === p)) out.push({ store, path: p });
    }
  }
  // Se uma pasta já está na lista, as subpastas dela sobram
  const kept = out.filter((o) => !out.some((x) => x !== o && x.store === o.store && o.path.startsWith(x.path + "\\")));
  return kept.slice(0, 8);
}

async function fromLudusavi(order) {
  console.log("Baixando o manifesto do Ludusavi...");
  const res = await fetch(LUDUSAVI, { headers: HEADERS });
  if (!res.ok) throw new Error(`Manifesto indisponível (${res.status})`);
  const manifest = loadYaml(await res.text());
  const bySteam = new Map();
  for (const [name, entry] of Object.entries(manifest)) {
    const id = entry?.steam?.id;
    if (id && !bySteam.has(id)) bySteam.set(id, [name, entry]);
  }
  const rows = [];
  for (const appid of order) {
    const hit = bySteam.get(appid);
    if (!hit) continue;
    const savePaths = ludusaviPaths(hit[1], appid);
    if (savePaths.length) rows.push({ appid, page: hit[0], savePaths });
  }
  return rows;
}

// ---------- Montagem ----------

async function wikiAvailable() {
  const data = await getJson(`${WIKI}?action=query&format=json&meta=siteinfo`, 1);
  return Boolean(data?.query);
}

const { order } = await candidates();
let rows = [];

if (await wikiAvailable()) {
  console.log("Buscando páginas na PCGamingWiki...");
  const pages = await pagesFor(order);
  console.log("Com página:", pages.size);
  for (const appid of order) {
    if (rows.length >= TARGET * 1.1) break;
    const page = pages.get(appid);
    if (!page) continue;
    const savePaths = savePathsFrom(await wikitextOf(page));
    await sleep(500);
    if (savePaths.length) rows.push({ appid, page, savePaths });
  }
} else {
  console.log("A API da PCGamingWiki recusou o acesso automático. Usando o manifesto do Ludusavi.");
  rows = await fromLudusavi(order);
}

const games = [];
for (const { appid, page, savePaths } of rows) {
  if (games.length >= TARGET) break;
  games.push({
    id: String(appid),
    name: page.replace(/_/g, " "),
    steamAppId: appid,
    savePaths,
    sourceUrl: `https://www.pcgamingwiki.com/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`,
    cover: (await hasCover(appid)) ? coverUrl(appid) : null
  });
  if (games.length % 50 === 0) console.log(`${games.length} jogos...`);
}

games.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(games, null, 1) + "\n");
console.log(`Pronto: ${games.length} jogos em ${path.relative(process.cwd(), OUT)}`);
console.log("Sem capa:", games.filter((g) => !g.cover).length);
