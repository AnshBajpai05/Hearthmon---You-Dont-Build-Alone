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

export const STARTERS: Creature[] = [
  { id: "rowlet", name: "Rowlet", dexId: 722, vibe: "sleepy night owl" },
  { id: "eevee", name: "Eevee", dexId: 133, vibe: "warm and loyal" },
  { id: "gengar", name: "Gengar", dexId: 94, vibe: "chaotic goblin" },
  { id: "pikachu", name: "Pikachu", dexId: 25, vibe: "classic spark" },
  { id: "mudkip", name: "Mudkip", dexId: 258, vibe: "easygoing optimist" },
  { id: "snorlax", name: "Snorlax", dexId: 143, vibe: "professional napper" }
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
