// Attack effects driven by each Pokémon's real learnset (latest-gen level-up moves).
// Damage class decides the animation archetype:
//   physical → charge-lunge into the hit
//   special  → charge-up glow, then a projectile shot
//   status   → glowing aura pulse around self
import { MOVESETS, type MoveTuple } from "./movesets";

export interface TypeFx {
  emoji: string;
  color: string;
}

export const TYPE_FX: Record<string, TypeFx> = {
  normal: { emoji: "💥", color: "#d8d8c0" },
  fire: { emoji: "🔥", color: "#ff8c42" },
  water: { emoji: "💧", color: "#58a8f0" },
  electric: { emoji: "⚡", color: "#ffd94a" },
  grass: { emoji: "🍃", color: "#6fcf5f" },
  ice: { emoji: "❄️", color: "#9fe8f0" },
  fighting: { emoji: "👊", color: "#d56723" },
  poison: { emoji: "☠️", color: "#a85ad1" },
  ground: { emoji: "🪨", color: "#d8b96a" },
  flying: { emoji: "🌪️", color: "#a890f0" },
  psychic: { emoji: "🔮", color: "#f85888" },
  bug: { emoji: "🐛", color: "#a8b820" },
  rock: { emoji: "🪨", color: "#b8a038" },
  ghost: { emoji: "👻", color: "#705898" },
  dragon: { emoji: "🐉", color: "#7038f8" },
  dark: { emoji: "🌑", color: "#705848" },
  steel: { emoji: "⚙️", color: "#b8b8d0" },
  fairy: { emoji: "✨", color: "#f0a8d8" }
};

export interface Move {
  name: string; // display-ready, e.g. "Thunderbolt"
  type: string;
  cls: 1 | 2 | 3; // 1 status, 2 physical, 3 special
  power: number;
  emoji: string;
  color: string;
}

function toMove(t: MoveTuple): Move {
  const fx = TYPE_FX[t[1]] ?? TYPE_FX.normal;
  return {
    name: t[0].split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    type: t[1],
    cls: (t[2] as 1 | 2 | 3) || 2,
    power: t[3],
    emoji: fx.emoji,
    color: fx.color
  };
}

const FALLBACK: MoveTuple = ["tackle", "normal", 2, 40];

/** Random move from this Pokémon's real learnset; damaging moves favored 4:1. */
export function randomMove(dexId: number): Move {
  const set = MOVESETS[dexId];
  if (!set?.length) return toMove(FALLBACK);
  const damaging = set.filter((m) => m[2] !== 1);
  const status = set.filter((m) => m[2] === 1);
  const pool = damaging.length && (Math.random() < 0.8 || !status.length) ? damaging : status;
  const src = pool.length ? pool : set;
  return toMove(src[Math.floor(Math.random() * src.length)]);
}

/** The pokémon's strongest damaging move — for big celebrations. */
export function signatureMove(dexId: number): Move {
  const set = MOVESETS[dexId];
  const damaging = set?.filter((m) => m[2] !== 1);
  return toMove(damaging?.length ? damaging[0] : (set?.[0] ?? FALLBACK));
}

export interface Particle {
  id: number;
  emoji: string;
  dx: number; // px, signed by attack direction
  dy: number; // px, negative = up
  delay: number; // ms
  size: number; // px font size
}

let particleSeq = 0;

export function makeParticles(move: Move, dir: 1 | -1): Particle[] {
  // special moves throw particles further; status moves rise around self
  const count = move.cls === 1 ? 8 : 9;
  return Array.from({ length: count }, (_, i) => ({
    id: ++particleSeq,
    emoji: move.emoji,
    dx:
      move.cls === 1
        ? (Math.random() - 0.5) * 80
        : dir * (move.cls === 3 ? 60 + Math.random() * 90 : 22 + Math.random() * 70),
    dy: -(8 + Math.random() * (move.cls === 1 ? 90 : 64)),
    delay: i * (move.cls === 3 ? 60 : 42),
    size: 11 + Math.random() * 9
  }));
}
