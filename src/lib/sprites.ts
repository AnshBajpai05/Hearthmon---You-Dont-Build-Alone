// Swappable sprite layer.
// v1 uses real Pokémon via the PokéAPI sprites repo (personal use only).
// To swap in original art later, only this file changes: point spriteUrl()
// at a local sprite sheet instead.

export interface Creature {
  id: string;
  name: string;
  dexId: number;
  vibe: string;
}

// The first six — the classic starters + Pikachu, plus Abra and Gastly for the
// quiet/mischief vibes. (Any of the full dex is still reachable later via Switch.)
export const STARTERS: Creature[] = [
  { id: "squirtle", name: "Squirtle", dexId: 7, vibe: "cool-headed splash" },
  { id: "charmander", name: "Charmander", dexId: 4, vibe: "small flame, big heart" },
  { id: "bulbasaur", name: "Bulbasaur", dexId: 1, vibe: "steady green thumb" },
  { id: "pikachu", name: "Pikachu", dexId: 25, vibe: "classic spark" },
  { id: "abra", name: "Abra", dexId: 63, vibe: "half-asleep genius" },
  { id: "gastly", name: "Gastly", dexId: 92, vibe: "mischief in the dark" }
];

/** Animated sprite (Pokémon Showdown set — covers all generations). */
export function spriteUrl(dexId: number, shiny = false): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${shiny ? "shiny/" : ""}${dexId}.gif`;
}

/** Animated back sprite — the player's side of a battle. */
export function spriteBackUrl(dexId: number, shiny = false): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${shiny ? "shiny/" : ""}${dexId}.gif`;
}

/** Static fallback if the animated sprite fails to load (e.g. offline). */
export function fallbackUrl(dexId: number, shiny = false): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? "shiny/" : ""}${dexId}.png`;
}

/** Lightweight static sprite for search-result thumbnails. */
export function thumbUrl(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
}

/** The trainer who throws the ball during switches (Showdown trainer sprite set). */
export const TRAINER_URL = "https://play.pokemonshowdown.com/sprites/trainers/ash.png";

// ── Special forms (Mega / Primal / Ash-Greninja) ──────────────────────────────────────────────
// "Special ones only": a curated map of dex → form(s). A mon NOT here can't mega — the map IS the
// gate. Sprites come from PokeAPI's Showdown set keyed by the form's OWN id (megas aren't keyed by
// the base dexId) — served off githubusercontent so it's CORS-friendly, which lets the Alive decoder
// fetch + animate them too (Showdown's play.* host can't be decoded cross-origin).
// A reward unlocked by real time together (see +page), never a grind — soul: a gift, no penalty.
export interface SpecialForm {
  label: string; // "Mega Charizard X"
  formId: number; // PokeAPI form id (e.g. Charizard-X = 10034); the showdown gif is keyed by this
  type?: string; // element/habitat shift while in this form (omit = keep the base type)
}
export const MEGA_FORMS: Record<number, SpecialForm[]> = {
  3: [{ label: "Mega Venusaur", formId: 10033 }],
  6: [
    { label: "Mega Charizard X", formId: 10034, type: "dragon" },
    { label: "Mega Charizard Y", formId: 10035 }
  ],
  9: [{ label: "Mega Blastoise", formId: 10036 }],
  15: [{ label: "Mega Beedrill", formId: 10090 }],
  18: [{ label: "Mega Pidgeot", formId: 10073 }],
  65: [{ label: "Mega Alakazam", formId: 10037 }],
  80: [{ label: "Mega Slowbro", formId: 10071 }],
  94: [{ label: "Mega Gengar", formId: 10038 }],
  115: [{ label: "Mega Kangaskhan", formId: 10039 }],
  127: [{ label: "Mega Pinsir", formId: 10040 }],
  130: [{ label: "Mega Gyarados", formId: 10041, type: "dark" }],
  142: [{ label: "Mega Aerodactyl", formId: 10042 }],
  150: [
    { label: "Mega Mewtwo X", formId: 10043, type: "fighting" },
    { label: "Mega Mewtwo Y", formId: 10044 }
  ],
  181: [{ label: "Mega Ampharos", formId: 10045, type: "dragon" }],
  208: [{ label: "Mega Steelix", formId: 10072 }],
  212: [{ label: "Mega Scizor", formId: 10046 }],
  214: [{ label: "Mega Heracross", formId: 10047 }],
  229: [{ label: "Mega Houndoom", formId: 10048 }],
  248: [{ label: "Mega Tyranitar", formId: 10049 }],
  254: [{ label: "Mega Sceptile", formId: 10065, type: "dragon" }],
  257: [{ label: "Mega Blaziken", formId: 10050 }],
  260: [{ label: "Mega Swampert", formId: 10064 }],
  282: [{ label: "Mega Gardevoir", formId: 10051 }],
  302: [{ label: "Mega Sableye", formId: 10066 }],
  303: [{ label: "Mega Mawile", formId: 10052 }],
  306: [{ label: "Mega Aggron", formId: 10053 }],
  308: [{ label: "Mega Medicham", formId: 10054 }],
  310: [{ label: "Mega Manectric", formId: 10055 }],
  319: [{ label: "Mega Sharpedo", formId: 10070 }],
  323: [{ label: "Mega Camerupt", formId: 10087 }],
  334: [{ label: "Mega Altaria", formId: 10067, type: "fairy" }],
  354: [{ label: "Mega Banette", formId: 10056 }],
  359: [{ label: "Mega Absol", formId: 10057 }],
  362: [{ label: "Mega Glalie", formId: 10074 }],
  373: [{ label: "Mega Salamence", formId: 10089 }],
  376: [{ label: "Mega Metagross", formId: 10076 }],
  380: [{ label: "Mega Latias", formId: 10062 }],
  381: [{ label: "Mega Latios", formId: 10063 }],
  382: [{ label: "Primal Kyogre", formId: 10077 }],
  383: [{ label: "Primal Groudon", formId: 10078, type: "fire" }],
  384: [{ label: "Mega Rayquaza", formId: 10079 }],
  428: [{ label: "Mega Lopunny", formId: 10088, type: "fighting" }],
  445: [{ label: "Mega Garchomp", formId: 10058 }],
  448: [{ label: "Mega Lucario", formId: 10059 }],
  460: [{ label: "Mega Abomasnow", formId: 10060 }],
  475: [{ label: "Mega Gallade", formId: 10068 }],
  531: [{ label: "Mega Audino", formId: 10069, type: "fairy" }],
  658: [{ label: "Ash-Greninja", formId: 10117, type: "dark" }],
  719: [{ label: "Mega Diancie", formId: 10075 }]
};

export function hasMega(dexId: number): boolean {
  return !!MEGA_FORMS[dexId]?.length;
}
export function megaForms(dexId: number): SpecialForm[] {
  return MEGA_FORMS[dexId] ?? [];
}
/** Animated sprite for a special form — PokeAPI Showdown set keyed by the form's own id (megas
 *  aren't keyed by the base dexId). githubusercontent = CORS-friendly, so the Alive decoder can
 *  fetch + animate it; Showdown's play.* host can't be decoded cross-origin. */
export function formSpriteUrl(formId: number, shiny = false): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${shiny ? "shiny/" : ""}${formId}.gif`;
}

/** Static fallback for a special form (offline / gif failed) — its OWN png, keyed by formId, so a
 *  failed mega never silently drops to the base form. (Verified present in the pokemon/ png set.) */
export function formFallbackUrl(formId: number, shiny = false): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? "shiny/" : ""}${formId}.png`;
}

/** A special form's signature flame colour, keyed by its (possibly overridden) element. Richer +
 *  more saturated than the biome's pale `light` tint so it reads as real fire. ONE source for the
 *  aura, the room atmosphere AND the attack/irritate FX — so a form's whole presence shares a colour
 *  (Mega Charizard X = blue fire → blue flames AND blue attacks). Elements not listed keep their
 *  normal type colour / biome light. */
export const FORM_FLAME: Record<string, string> = {
  fire: "#ff7a2a", // hearth orange
  dragon: "#2e7bff" // Charizard X cobalt-blue signature
};

/** "mr-mime" → "Mr Mime" */
export function displayName(raw: string): string {
  return raw
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---- full Pokédex (generated from PokeAPI data) ----
import { POKEDEX_RAW } from "./pokedex";

export interface DexEntry {
  id: number;
  name: string;
  type: string;
}

export const POKEDEX: DexEntry[] = POKEDEX_RAW.map(([id, name, type]) => ({ id, name, type }));

const byId = new Map(POKEDEX.map((e) => [e.id, e]));

export function dexEntry(dexId: number): DexEntry | undefined {
  return byId.get(dexId);
}

export function randomEntry(excludeId?: number): DexEntry {
  let e: DexEntry;
  do {
    e = POKEDEX[Math.floor(Math.random() * POKEDEX.length)];
  } while (e.id === excludeId);
  return e;
}

import { EVOLVES_INTO } from "./evolutions";

/** The form this companion can evolve into next, or null. Branching picks one. */
export function nextEvolution(dexId: number): DexEntry | null {
  const into = EVOLVES_INTO[dexId];
  if (!into?.length) return null;
  // branching (Eevee etc.): pick a random valid next form within our dex
  const pick = into[Math.floor(Math.random() * into.length)];
  return byId.get(pick) ?? null;
}

export function hasEvolution(dexId: number): boolean {
  return !!EVOLVES_INTO[dexId]?.length;
}

// reverse of EVOLVES_INTO: the (first) species that evolves INTO a given dex id
const EVOLVES_FROM: Record<number, number> = (() => {
  const m: Record<number, number> = {};
  for (const k in EVOLVES_INTO) for (const to of EVOLVES_INTO[k]) if (m[to] == null) m[to] = Number(k);
  return m;
})();

/** Evolution depth from the base form: 1 = base, 2 = first evolution, 3 = second. */
export function evoStage(dexId: number): number {
  let s = 1, cur = dexId, guard = 0;
  while (EVOLVES_FROM[cur] != null && guard++ < 6) { cur = EVOLVES_FROM[cur]; s += 1; }
  return s;
}

/** The final form of this line (follows the first branch). */
export function finalEvolution(dexId: number): number {
  let cur = dexId, guard = 0;
  while (EVOLVES_INTO[cur]?.length && guard++ < 6) cur = EVOLVES_INTO[cur][0];
  return cur;
}

/** How many evolutions remain ahead of this form (follows the first branch). */
export function evolutionStepsAhead(dexId: number): number {
  let steps = 0;
  let cur = dexId;
  const seen = new Set<number>();
  while (EVOLVES_INTO[cur]?.length && !seen.has(cur)) {
    seen.add(cur);
    cur = EVOLVES_INTO[cur][0];
    steps += 1;
  }
  return steps;
}

export function searchDex(query: string, limit = 12): DexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = POKEDEX.filter((e) => e.name.startsWith(q));
  const contains = POKEDEX.filter((e) => !e.name.startsWith(q) && e.name.includes(q));
  return [...starts, ...contains].slice(0, limit);
}

// generation boundaries by national dex id
export const GENERATIONS: [number, number][] = [
  [1, 151],
  [152, 251],
  [252, 386],
  [387, 493],
  [494, 649],
  [650, 721],
  [722, 809],
  [810, 905],
  [906, 1025]
];

// ── Local disk cache (429-proof sprite loading) ───────────────────────────────
// raw.githubusercontent.com rate-limits (429) under active use → a blank pet. So we
// resolve every sprite through a disk cache: read_sprite (Rust) returns cached bytes;
// on a miss the webview fetches remote ONCE and hands the bytes to save_sprite; on a
// cold miss + 429 we return the remote URL as a last resort. prefetchSprites() warms
// the whole set so nothing depends on the API after the first successful run.
import { invoke } from "@tauri-apps/api/core";

/** Stable cache filename for a remote sprite URL (path after the host, flattened). */
function spriteKey(url: string): string {
  return url.replace(/^https?:\/\/[^/]+\//, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}
function spriteMime(url: string): string {
  return url.endsWith(".png") ? "image/png" : "image/gif";
}
function b64FromBuf(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const _srcMemo = new Map<string, string>();

/** Local-first sprite source: disk cache → fetch-once + cache → remote (last resort).
 *  Returns a `data:` URL for cached/fetched bytes, else the remote URL. Never throws.
 *  Works in both renderers and for the GIF decoder (`fetch(dataUrl)` + `<img src>`). */
export async function localSrc(remoteUrl: string): Promise<string> {
  const memo = _srcMemo.get(remoteUrl);
  if (memo) return memo;
  const key = spriteKey(remoteUrl);
  const mime = spriteMime(remoteUrl);
  try {
    const b64 = await invoke<string | null>("read_sprite", { key });
    if (b64) {
      const u = `data:${mime};base64,${b64}`;
      _srcMemo.set(remoteUrl, u);
      return u;
    }
  } catch {
    return remoteUrl; // not under Tauri (plain browser dev) → just use remote
  }
  try {
    const resp = await fetch(remoteUrl, { mode: "cors" });
    if (!resp.ok) throw new Error(String(resp.status)); // 429 etc.
    const b64 = b64FromBuf(await resp.arrayBuffer());
    void invoke("save_sprite", { key, b64 }).catch(() => {}); // fire-and-forget persist
    const u = `data:${mime};base64,${b64}`;
    _srcMemo.set(remoteUrl, u);
    return u;
  } catch {
    return remoteUrl; // cold cache + rate-limited: nothing better to hand back
  }
}

/** Svelte action: `<img use:spriteSrc={url}>` or `use:spriteSrc={{ src, fallback }}`.
 *  Resolves the sprite through the local disk cache (localSrc) and sets node.src —
 *  the browser never fires the remote request itself, so a 429 can't blank the image.
 *  On error of the resolved source (corrupt file / cold miss + offline) it retries
 *  with `fallback` through the same cache. Reactive: updates when the param changes. */
export function spriteSrc(
  node: HTMLImageElement,
  param: string | { src: string; fallback?: string }
) {
  let opts = typeof param === "string" ? { src: param, fallback: undefined as string | undefined } : param;
  let cur = ""; // the URL we most recently asked for (guards stale async resolves)
  const onErr = () => {
    const f = opts.fallback;
    if (f && cur !== f) {
      cur = f;
      void localSrc(f).then((r) => { if (cur === f) node.src = r; });
    }
  };
  node.addEventListener("error", onErr);
  const apply = () => {
    const want = opts.src;
    cur = want;
    void localSrc(want).then((r) => { if (cur === want) node.src = r; });
  };
  apply();
  return {
    update(p: typeof param) {
      opts = typeof p === "string" ? { src: p, fallback: undefined } : p;
      apply();
    },
    destroy() {
      node.removeEventListener("error", onErr);
    }
  };
}

/** Warm the disk cache for the WHOLE dex + every mega/special form (animated + static
 *  fallback), throttled so the prefetch can't trigger the 429 it prevents. Idempotent:
 *  skips already-cached files; bails on a rate-limit streak (resumes on a later run). */
export async function prefetchSprites(onProgress?: (done: number, total: number) => void): Promise<void> {
  const urls = new Set<string>();
  for (const e of POKEDEX) {
    urls.add(spriteUrl(e.id));
    urls.add(fallbackUrl(e.id));
  }
  for (const forms of Object.values(MEGA_FORMS)) {
    for (const f of forms) {
      urls.add(formSpriteUrl(f.formId));
      urls.add(formFallbackUrl(f.formId));
    }
  }
  const list = [...urls];
  let done = 0;
  let failStreak = 0;
  for (const u of list) {
    try {
      if (!(await invoke<boolean>("sprite_cached", { key: spriteKey(u) }))) {
        const resp = await fetch(u, { mode: "cors" });
        if (resp.ok) {
          await invoke("save_sprite", { key: spriteKey(u), b64: b64FromBuf(await resp.arrayBuffer()) }).catch(() => {});
          failStreak = 0;
        } else {
          if (++failStreak >= 6) break; // rate-limited → stop; a later run resumes
        }
        await new Promise((r) => setTimeout(r, 130)); // throttle → don't self-429
      }
    } catch {
      break; // not under Tauri / offline → nothing to prefetch
    }
    onProgress?.(++done, list.length);
  }
}

/** Combined filter: type and/or generation and/or name query. */
export function filterDex(
  opts: { query?: string; type?: string; gen?: number; limit?: number } = {}
): DexEntry[] {
  const limit = opts.limit ?? 36;
  let pool = POKEDEX;
  if (opts.gen && GENERATIONS[opts.gen - 1]) {
    const [lo, hi] = GENERATIONS[opts.gen - 1];
    pool = pool.filter((e) => e.id >= lo && e.id <= hi);
  }
  if (opts.type) pool = pool.filter((e) => e.type === opts.type);
  const q = opts.query?.trim().toLowerCase();
  if (q) {
    const starts = pool.filter((e) => e.name.startsWith(q));
    const contains = pool.filter((e) => !e.name.startsWith(q) && e.name.includes(q));
    pool = [...starts, ...contains];
  }
  return pool.slice(0, limit);
}
