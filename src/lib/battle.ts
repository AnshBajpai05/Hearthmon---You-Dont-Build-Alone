// Battle engine: real type chart (gen 6+), STAB, crits, and move picking
// from each Pokémon's real learnset.
import { MOVESETS } from "./movesets";
import { STATS } from "./stats";
import { randomMove, signatureMove, TYPE_FX, type Move } from "./attackfx";

// CHART[attackType][defendType] = multiplier (1 if absent)
const CHART: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: {
    fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5,
    rock: 2, dragon: 0.5, steel: 0.5
  },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: {
    normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2,
    ghost: 0, dark: 2, steel: 2, fairy: 0.5
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: {
    fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2,
    ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

export function effectiveness(moveType: string, defenderType: string): number {
  return CHART[moveType]?.[defenderType] ?? 1;
}

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

const DEFAULT_STATS: BaseStats = { hp: 70, atk: 70, def: 70, spa: 70, spd: 70, spe: 70 };

export function statsFor(dexId: number): BaseStats {
  const s = STATS[dexId];
  if (!s) return DEFAULT_STATS;
  return { hp: s[0], atk: s[1], def: s[2], spa: s[3], spd: s[4], spe: s[5] };
}

/** Real HP pools: a Blissey (255 hp) tanks, a Diglett (10 hp) folds. */
export function maxHpFor(dexId: number): number {
  return Math.round(statsFor(dexId).hp * 1.5 + 55);
}

/** Faster Pokémon moves first, like the games. */
export function firstSide(leftId: number, rightId: number): "L" | "R" {
  const l = statsFor(leftId).spe;
  const r = statsFor(rightId).spe;
  if (l === r) return Math.random() < 0.5 ? "L" : "R";
  return l > r ? "L" : "R";
}

export interface TurnResult {
  move: Move;
  damage: number;
  eff: number; // 0 | 0.5 | 1 | 2
  crit: boolean;
}

/** Battles want action: 90% damaging moves, status only as flavor. */
export function pickBattleMove(dexId: number): Move {
  const set = MOVESETS[dexId];
  if (!set?.length) return randomMove(dexId);
  for (let i = 0; i < 4; i++) {
    const m = randomMove(dexId);
    if (m.cls !== 1 || Math.random() < 0.1) return m;
  }
  return signatureMove(dexId);
}

/** Game-style damage: move power × attacker's Atk/SpA vs defender's Def/SpD. */
export function calcTurn(
  move: Move,
  attackerId: number,
  defenderId: number,
  attackerType: string,
  defenderType: string
): TurnResult {
  if (move.cls === 1) return { move, damage: 0, eff: 1, crit: false };
  const a = statsFor(attackerId);
  const d = statsFor(defenderId);
  const A = move.cls === 2 ? a.atk : a.spa;
  const D = move.cls === 2 ? d.def : d.spd;
  const eff = effectiveness(move.type, defenderType);
  const stab = move.type === attackerType ? 1.5 : 1;
  const crit = Math.random() < 0.07;
  const spread = 0.85 + Math.random() * 0.3;
  const base = (22 * move.power * (A / Math.max(1, D))) / 50 + 2;
  const damage = Math.max(1, Math.round(base * stab * eff * (crit ? 1.5 : 1) * spread));
  return { move, damage: eff === 0 ? 0 : damage, eff, crit };
}

export function effText(eff: number): string | null {
  if (eff === 0) return "It had no effect…";
  if (eff <= 0.5) return "Not very effective…";
  if (eff >= 2) return "It's super effective!";
  return null;
}

export { TYPE_FX };
