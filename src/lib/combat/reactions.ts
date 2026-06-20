// Pokemon Identity Engine — L? Reaction Identity (docs/COMBAT_IDENTITY.md, v3).
// How a species answers being poked/irritated, BEFORE any attack. Picked from its identity
// (motifs + temperament) so Charizard ≠ Gengar ≠ Snorlax ≠ Lucario the instant you click.
// Renderer-agnostic: both skins render the ReactionKind. Soul: a delight, rare + gentle, never a nag.
import type { SpeciesIdentity } from "./identity";

export type ReactionKind =
  | "flare" // a fiery huff / challenger flare-up
  | "phase" // ghostly vanish + reappear
  | "doze" // sleepy: barely stirs, slumps back
  | "aura" // psychic / regal: a slow lift + aura ring
  | "spark" // electric crackle
  | "shiver" // icy shudder
  | "bounce" // playful happy hop
  | "turn"; // aloof: turns away, unimpressed

// Iconic MOTIFS win (a Gengar phases whatever its temperament); then temperament; then a motif
// fallback; else a warm bounce. Keep the mapping small + legible.
export function reactionFor(id: SpeciesIdentity): ReactionKind {
  const m = id.motifs;
  const t = id.temperament;
  if (m.includes("ghostly")) return "phase";
  if (t.includes("sleepy")) return "doze";
  if (t.includes("challenger")) return "flare";
  if (m.includes("electric")) return "spark";
  if (m.includes("icy")) return "shiver";
  if (m.includes("psychic") || m.includes("regal")) return "aura";
  if (m.includes("infernal")) return "flare";
  if (t.includes("aloof")) return "turn";
  return "bounce";
}

/** Sleepy mons never rile into an attack from poking; everyone else can. */
export function rilesToAttack(id: SpeciesIdentity): boolean {
  return !id.temperament.includes("sleepy");
}

/** Rapid pokes needed before a real move comes out — challengers snap fast, others take a lot. */
export function rileThreshold(id: SpeciesIdentity): number {
  return id.temperament.includes("challenger") ? 4 : 8;
}
