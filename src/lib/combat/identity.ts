// Pokemon Identity Engine — L1 resolver (docs/COMBAT_IDENTITY.md).
// Turns the compact generated COMBAT_IDENTITY tuple into a typed SpeciesIdentity, resolving the
// palette from TYPE_FX (single source of type colour) and the signature from the real learnset.
// Renderer-agnostic: presentation reads this; it never reaches into a skin.
import { COMBAT_IDENTITY, type IdentityTuple } from "../combat_identity";
import { TYPE_FX, signatureMove } from "../attackfx";

export interface SpeciesIdentity {
  dex: number;
  t1: string;
  t2: string; // "" when single-typed
  tempo: number; // 0..1 from Speed → wind-up / recovery pacing
  scale: number; // 0..1 from height+weight → FX size + impact weight
  power: number; // 0..1 from max(Atk, SpAtk) → magnitude bias
  bias: "phys" | "spec" | "bal";
  legendary: boolean;
  stage: 1 | 2 | 3;
  motifs: string[];
  temperament: string[];
  palette: [string, string]; // [primary, secondary] hex (secondary = primary when single-typed)
  signature: string; // iconic/strongest move name
}

// Used for any dex missing from the table (shouldn't happen for 1..1025, but stays safe).
const DEFAULT: IdentityTuple = ["normal", "", 0.4, 0.4, 0.5, "bal", 0, 1, ["normal"], ["calm"]];

// ── L4 Species Flavor — tint a move toward the species' SECONDARY type so two same-type mons
// differ (Charizard fire→flying-lift, Houndoom fire→dark-depth, Reshiram fire→dragon). A single-
// typed mon has palette[1]===palette[0] → no shift (its type IS its flavour). Renderer-agnostic.
function hexInt(h: string): number {
  return parseInt(h.replace("#", ""), 16) || 0;
}
function blendHex(a: string, b: string, t: number): string {
  const pa = hexInt(a);
  const pb = hexInt(b);
  const mix = (sh: number) => {
    const x = (pa >> sh) & 255;
    const y = (pb >> sh) & 255;
    return Math.round(x + (y - x) * t) & 255;
  };
  return "#" + ((1 << 24) | (mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).slice(1);
}
/** Move's type colour, tinted ~30% toward the species' secondary type → its signature flavour. */
export function attackFlavor(moveColor: string, id: SpeciesIdentity): string {
  return blendHex(moveColor, id.palette[1], 0.3);
}

export function speciesIdentity(dex: number): SpeciesIdentity {
  const [t1, t2, tempo, scale, power, bias, leg, stage, motifs, temperament] =
    COMBAT_IDENTITY[dex] ?? DEFAULT;
  const c1 = TYPE_FX[t1]?.color ?? "#d8d8c0";
  const c2 = t2 ? (TYPE_FX[t2]?.color ?? c1) : c1;
  return {
    dex,
    t1,
    t2,
    tempo,
    scale,
    power,
    bias,
    legendary: leg === 1,
    stage,
    motifs,
    temperament,
    palette: [c1, c2],
    signature: signatureMove(dex).name
  };
}
