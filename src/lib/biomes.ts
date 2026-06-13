// Type Habitats — every Pokémon type lives in its own tiny sanctuary, not a
// generic "room". One universal layered template renders them (atmosphere →
// window scene → light beam → floor → ground interaction → pet → particles →
// foreground vignette); only the biome DATA below changes per type.
//
// Philosophy: a Tiny Living Sanctuary — "this Pokémon carved out a tiny
// emotional corner beside your desk." Pokémon × Ghibli × Spirit City × cozy.
// Water (Moonlit Shore) is the gold-standard biome; the rest are templated.

export type GroundKind =
  | "water" // reflective puddle + ripples (Moonlit Shore)
  | "ember" // warm coals glow + flicker
  | "moss" // soft green pad
  | "cyber" // thin neon ring
  | "stone" // flat grey pad
  | "snow" // soft white mound
  | "fog" // low drifting mist
  | "cosmic" // starlit disc
  | "warm"; // gentle warm glow (default)

export type ParticleKind =
  | "firefly"
  | "ember"
  | "pollen"
  | "spark"
  | "dust"
  | "snow"
  | "star"
  | "mist";

export type SceneKind =
  | "ocean" // moonlit sea horizon
  | "forest" // soft foliage + light rays
  | "snowfall" // falling snow
  | "stars" // night sky dots
  | "city" // skyline silhouette
  | "cave" // dark stone + crystal glint
  | "neon" // horizontal light strips
  | "cosmos" // nebula + stars
  | "forge" // fire glow + heat shimmer
  | "plain"; // warm pane

// the window/opening SILHOUETTE — different shape per biome so each feels like a
// different world, not the same square room recolored.
export type WindowShape =
  | "square" // default framed window
  | "ocean" // wide low landscape opening
  | "arch" // rounded-top forge mouth
  | "greenhouse" // tall arched glasshouse
  | "panel" // monitor / light panel
  | "cave" // organic rock opening
  | "round" // porthole / moon window
  | "frost" // frosted cabin pane
  | "shrine" // pointed mountain-shrine opening
  | "dome"; // observatory dome

export interface Biome {
  id: string;
  name: string;
  types: string[]; // Pokémon primary types served
  wall: [string, string]; // background atmosphere gradient (top→bottom)
  floor: [string, string]; // ground gradient (top→bottom)
  light: string; // window / light-source tint
  rim: string; // rim light cast on the pet
  ground: GroundKind;
  groundColor: string; // accent color for the ground interaction
  particle: ParticleKind;
  particleColor: string;
  scene: SceneKind; // what the window shows
  window: WindowShape; // the opening's silhouette
}

export const BIOMES: Biome[] = [
  {
    id: "shore",
    name: "Moonlit Shore Sanctuary",
    types: ["water"],
    wall: ["#1b2742", "#0d1422"],
    floor: ["#3b4254", "#242a39"], // wet reflective sand
    light: "#bcd2ff", // pale moon
    rim: "rgba(188,210,255,0.58)",
    ground: "water",
    groundColor: "rgba(150,200,245,0.55)",
    particle: "firefly",
    particleColor: "rgba(255,235,160,0.85)",
    scene: "ocean",
    window: "ocean"
  },
  {
    id: "campfire",
    name: "Campfire Workshop",
    types: ["fire"],
    wall: ["#36241c", "#1d130e"],
    floor: ["#42291d", "#271810"], // burnt wood
    light: "#ffb066",
    rim: "rgba(255,170,90,0.55)",
    ground: "ember",
    groundColor: "rgba(255,140,70,0.6)",
    particle: "ember",
    particleColor: "rgba(255,150,70,0.9)",
    scene: "forge",
    window: "arch"
  },
  {
    id: "greenhouse",
    name: "Ghibli Greenhouse",
    types: ["grass", "bug"],
    wall: ["#2a3a26", "#16210f"],
    floor: ["#37402b", "#23291b"], // mossy wood
    light: "#d2e6a0",
    rim: "rgba(200,228,150,0.5)",
    ground: "moss",
    groundColor: "rgba(150,210,130,0.5)",
    particle: "pollen",
    particleColor: "rgba(220,235,150,0.8)",
    scene: "forest",
    window: "greenhouse"
  },
  {
    id: "neon",
    name: "Neon Tech Corner",
    types: ["electric", "steel"],
    wall: ["#1a2336", "#0c1018"],
    floor: ["#1d2738", "#10141d"], // dark desk
    light: "#7fd9ff",
    rim: "rgba(130,220,255,0.55)",
    ground: "cyber",
    groundColor: "rgba(110,220,255,0.6)",
    particle: "spark",
    particleColor: "rgba(180,240,255,0.9)",
    scene: "neon",
    window: "panel"
  },
  {
    id: "cliff",
    name: "Mini Cliff Workshop",
    types: ["rock", "ground"],
    wall: ["#3a3024", "#201a12"],
    floor: ["#403626", "#262017"], // stone floor
    light: "#e6c489",
    rim: "rgba(230,196,137,0.5)",
    ground: "stone",
    groundColor: "rgba(210,180,130,0.45)",
    particle: "dust",
    particleColor: "rgba(225,200,150,0.7)",
    scene: "cave",
    window: "cave"
  },
  {
    id: "attic",
    name: "Moonlit Attic",
    types: ["ghost", "dark", "poison"],
    wall: ["#241a38", "#120c1f"],
    floor: ["#2a2238", "#171022"], // dark wood
    light: "#c9a9ff",
    rim: "rgba(200,168,255,0.52)",
    ground: "fog",
    groundColor: "rgba(180,150,235,0.45)",
    particle: "mist",
    particleColor: "rgba(190,160,235,0.6)",
    scene: "city",
    window: "round"
  },
  {
    id: "snow",
    name: "Snow Cabin Window",
    types: ["ice"],
    wall: ["#28394e", "#152233"],
    floor: ["#3a4658", "#222d3b"], // pale cabin wood
    light: "#dbeeff",
    rim: "rgba(220,238,255,0.55)",
    ground: "snow",
    groundColor: "rgba(225,240,255,0.5)",
    particle: "snow",
    particleColor: "rgba(240,250,255,0.9)",
    scene: "snowfall",
    window: "frost"
  },
  {
    id: "shrine",
    name: "Stargazing Shrine",
    types: ["dragon", "flying"],
    wall: ["#1d2746", "#0c1124"],
    floor: ["#2b3350", "#171c30"], // ancient stone
    light: "#9fd0ff",
    rim: "rgba(160,205,255,0.52)",
    ground: "cosmic",
    groundColor: "rgba(150,190,255,0.5)",
    particle: "star",
    particleColor: "rgba(210,225,255,0.95)",
    scene: "stars",
    window: "shrine"
  },
  {
    id: "observatory",
    name: "Dream Observatory",
    types: ["psychic", "fairy"],
    wall: ["#2c1f44", "#150f26"],
    floor: ["#352a4c", "#1d1730"], // soft dark
    light: "#e7b6ff",
    rim: "rgba(225,180,255,0.55)",
    ground: "cosmic",
    groundColor: "rgba(220,170,245,0.5)",
    particle: "star",
    particleColor: "rgba(235,200,255,0.95)",
    scene: "cosmos",
    window: "dome"
  },
  {
    id: "hearth",
    name: "Cozy Corner",
    types: ["normal", "fighting"],
    wall: ["#2c2446", "#1a1528"],
    floor: ["#3c2d24", "#251b15"], // warm wood
    light: "#f6cf90",
    rim: "rgba(246,207,144,0.55)",
    ground: "warm",
    groundColor: "rgba(246,207,144,0.45)",
    particle: "dust",
    particleColor: "rgba(246,210,150,0.7)",
    scene: "plain",
    window: "square"
  }
];

const HEARTH = BIOMES[BIOMES.length - 1];

/** The habitat a Pokémon of this primary type lives in. */
export function biomeForType(type: string): Biome {
  return BIOMES.find((b) => b.types.includes(type)) ?? HEARTH;
}
