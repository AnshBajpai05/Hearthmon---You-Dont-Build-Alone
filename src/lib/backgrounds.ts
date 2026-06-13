// Type-themed biome backdrops — original layered CSS gradients (no external art),
// tuned to each type's habitat. Four scene variants per type; a species picks one
// by its dex id, so different Pokémon of the same type get different scenes.

export interface Palette {
  sky: string; // top
  mid: string; // middle
  ground: string; // bottom
  accent: string; // light/glow
}

// sky → mid → ground → accent, evoking each type's environment
export const TYPE_PALETTE: Record<string, Palette> = {
  normal: { sky: "#dcd6c4", mid: "#bcae90", ground: "#92805e", accent: "#f3ecd6" },
  grass: { sky: "#a9e3f6", mid: "#73c862", ground: "#3f8f3c", accent: "#dff7a8" },
  fire: { sky: "#3a1410", mid: "#8a230f", ground: "#d2400f", accent: "#ffb648" },
  water: { sky: "#a6daf2", mid: "#3f8fd6", ground: "#1d5aa8", accent: "#d6f1fc" },
  electric: { sky: "#2c2b40", mid: "#6f5f1c", ground: "#b89e1c", accent: "#ffe85a" },
  ice: { sky: "#e0f5fc", mid: "#a3dbee", ground: "#6cb2d6", accent: "#ffffff" },
  fighting: { sky: "#3a2420", mid: "#823a26", ground: "#b1543a", accent: "#f0ad66" },
  poison: { sky: "#2c1838", mid: "#5b2f70", ground: "#833f96", accent: "#cf83e6" },
  ground: { sky: "#ecd49a", mid: "#c89a54", ground: "#946b34", accent: "#f0cf86" },
  flying: { sky: "#bfe6f9", mid: "#8cc1ee", ground: "#c5def2", accent: "#ffffff" },
  psychic: { sky: "#3a1f52", mid: "#933a92", ground: "#cb4f86", accent: "#ffa6d6" },
  bug: { sky: "#d3ea9a", mid: "#8caa38", ground: "#5b7a22", accent: "#c8df66" },
  rock: { sky: "#dcc6a4", mid: "#a8855a", ground: "#735436", accent: "#cfae84" },
  ghost: { sky: "#191430", mid: "#392a58", ground: "#523c74", accent: "#9b7fe0" },
  dragon: { sky: "#1d1742", mid: "#472f8e", ground: "#6a3aa6", accent: "#9a7bff" },
  dark: { sky: "#121019", mid: "#272234", ground: "#3a3450", accent: "#6f63a6" },
  steel: { sky: "#c6ccd8", mid: "#8b93a8", ground: "#5d6678", accent: "#e2e7f0" },
  fairy: { sky: "#ffe2f1", mid: "#f2acdb", ground: "#d97cbb", accent: "#ffffff" }
};

// Glossy energy-orb spheres: bright specular core near the top, the type colour
// through the body, and a dark rim — like the type medallions, with the pet in front.
const rim = (c: string) => `color-mix(in srgb, ${c} 42%, #000)`;
const TEMPLATES = [
  // 1 — classic top-lit sphere
  (p: Palette) =>
    `radial-gradient(circle at 42% 28%, ${p.accent} 0%, ${p.mid} 38%, ${p.ground} 72%, ${rim(p.ground)} 100%)`,
  // 2 — bright high sun
  (p: Palette) =>
    `radial-gradient(circle at 50% 20%, #ffffff 0%, ${p.accent} 14%, ${p.mid} 44%, ${p.ground} 78%, ${rim(p.ground)} 100%)`,
  // 3 — side-lit, moodier
  (p: Palette) =>
    `radial-gradient(circle at 30% 38%, ${p.accent} 0%, ${p.mid} 40%, ${p.ground} 74%, ${rim(p.ground)} 100%)`,
  // 4 — deep orb (more body colour, smaller core)
  (p: Palette) =>
    `radial-gradient(circle at 44% 32%, ${p.accent} 0%, ${p.mid} 26%, ${p.ground} 66%, ${rim(p.ground)} 100%)`
];

export function typeBackgrounds(type: string): string[] {
  const p = TYPE_PALETTE[type] ?? TYPE_PALETTE.normal;
  return TEMPLATES.map((t) => t(p));
}

/** Stable per-species scene: same Pokémon → same backdrop, varied across the dex. */
export function backgroundFor(type: string, dexId: number): string {
  const v = typeBackgrounds(type);
  return v[dexId % v.length];
}
