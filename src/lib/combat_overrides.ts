// Per-species attack overrides (v4b). The generic animKind() mapper is good across all 1025; this
// is the small "must feel exactly right" exception list for the iconic — a species' signature move,
// or a move the generic map reads wrong on that particular mon. Keyed by dexId → lowercased move
// name → kind. Merge point: animKind(move, dexId) checks here FIRST, before SIGNATURE/patterns.
// Pure data — extend freely. (Mega/forms keep the base dexId, so an override covers the form too.)
import type { AnimKind } from "./fx";

export const MOVE_OVERRIDES: Record<number, Record<string, AnimKind>> = {
  3: { "frenzy plant": "quake" }, // Venusaur — roots erupt from the ground
  6: { "blast burn": "nova", "wing attack": "blade" }, // Charizard
  9: { "hydro cannon": "thick-beam" }, // Blastoise — a pressurized cannon, not a loose spray
  65: { "future sight": "thin-ray" }, // Alakazam
  68: { "dynamic punch": "heavy-slam", "cross chop": "blade" }, // Machamp
  94: { "dream eater": "orb-lob", hex: "orb-lob" }, // Gengar
  130: { "aqua tail": "wave" }, // Gyarados
  149: { "dragon rush": "blitz" }, // Dragonite
  282: { "stored power": "orb-lob" }, // Gardevoir
  376: { "meteor mash": "heavy-slam" }, // Metagross
  384: { "dragon ascent": "blitz" }, // Rayquaza
  445: { "dual chop": "multi-slash" }, // Garchomp
  448: { "vacuum wave": "fast-shot" }, // Lucario
  658: { "water shuriken": "multi-shot" } // Greninja — signature
};

export function overrideKind(dexId: number, moveName: string): AnimKind | undefined {
  return MOVE_OVERRIDES[dexId]?.[moveName.toLowerCase()];
}
