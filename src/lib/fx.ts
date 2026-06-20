// Visual-effects director (attack v4): every move maps to a distinct FEEL via
//   archetype (motion) × type-flavor (palette/particles) × power-tier (intensity) × signature.
// v4 "deeper": 8 render FAMILIES (one code branch each, in all 3 consumers) × ~24 KINDS that
// MODULATE the family via VARIANT params (spread/speed/shape/…). Variety = combinatorics, not 24
// bespoke render paths. So Flamethrower (flame-cone) vs Bubble Beam (spray) vs Gust (wind) vs Smog
// (gas) all ride the "breath" branch but read differently. CHANGING THIS IS ATOMIC across +page
// (Classic), PixiStage (Alive) and BattleScene — every consumer switches on FAMILY, never miss one.
import type { Move } from "./attackfx";
import { overrideKind } from "./combat_overrides";

/** The 8 render families — each has exactly one branch per renderer (the v1 archetypes). */
export type AnimFamily =
  | "breath" | "projectile" | "claw" | "dash" | "bite" | "burst" | "beam" | "status";

/** The ~24 semantic move feels. Each belongs to a family (FAMILY) and tweaks it (VARIANT). */
export type AnimKind =
  | "flame-cone" | "spray" | "wind" | "gas" // breath: exhaled/sprayed cones
  | "orb-lob" | "fast-shot" | "multi-shot" | "bomb" // projectile: thrown/shot energy
  | "thick-beam" | "thin-ray" | "sky-strike" // beam: focused rays / strike-from-above
  | "quake" | "nova" | "wave" | "storm" // burst: ground / radial / sweep / weather
  | "rake" | "blade" | "multi-slash" // claw: slashes
  | "chomp" | "throw" // bite: jaws / grabs
  | "quick-dash" | "heavy-slam" | "blitz" // dash: charges
  | "buff" | "guard" | "heal"; // status: self FX

export const FAMILY: Record<AnimKind, AnimFamily> = {
  "flame-cone": "breath", spray: "breath", wind: "breath", gas: "breath",
  "orb-lob": "projectile", "fast-shot": "projectile", "multi-shot": "projectile", bomb: "projectile",
  "thick-beam": "beam", "thin-ray": "beam", "sky-strike": "beam",
  quake: "burst", nova: "burst", wave: "burst", storm: "burst",
  rake: "claw", blade: "claw", "multi-slash": "claw",
  chomp: "bite", throw: "bite",
  "quick-dash": "dash", "heavy-slam": "dash", blitz: "dash",
  buff: "status", guard: "status", heal: "status"
};

/** Per-kind modulation of its family's base render. Renderers read these atop the family branch. */
export interface Variant {
  spread: number; // cone width / scatter (breath, burst)
  len: number; // reach / length (breath, beam, dash)
  count: number; // particle / segment count (projectile, claw, burst)
  speed: number; // travel speed (projectile, dash)
  arc: number; // 0 flat … 1 high lob (projectile)
  alpha: number; // opacity (gas faint, beam solid)
  waver: number; // flicker / turbulence
  shape: "soft" | "sharp" | "cloud" | "streak" | "droplet" | "bolt"; // particle / edge feel
}
const D: Variant = { spread: 1, len: 1, count: 1, speed: 1, arc: 0.3, alpha: 1, waver: 1, shape: "soft" };
const v = (o: Partial<Variant>): Variant => ({ ...D, ...o });
export const VARIANT: Record<AnimKind, Variant> = {
  "flame-cone": v({ waver: 1.1 }),
  spray: v({ shape: "droplet", spread: 0.85, waver: 0.5, count: 1.4 }),
  wind: v({ shape: "streak", spread: 1.35, len: 1.2, alpha: 0.6, waver: 0.7 }),
  gas: v({ shape: "cloud", spread: 1.5, len: 0.7, speed: 0.5, alpha: 0.5, waver: 0.3 }),
  "orb-lob": v({ arc: 0.8, speed: 0.85 }),
  "fast-shot": v({ shape: "sharp", arc: 0.05, speed: 1.6 }),
  "multi-shot": v({ shape: "sharp", arc: 0.15, speed: 1.3, count: 3 }),
  bomb: v({ arc: 1, speed: 0.8 }),
  "thick-beam": v({ len: 1.2, spread: 1.4 }),
  "thin-ray": v({ shape: "sharp", len: 1.3, spread: 0.5 }),
  "sky-strike": v({ shape: "bolt", spread: 0.6 }),
  quake: v({ shape: "sharp", spread: 1.1, count: 1.2 }),
  nova: v({ spread: 1.3, count: 1.4 }),
  wave: v({ spread: 1.5, len: 1.2 }),
  storm: v({ shape: "streak", spread: 1.6, count: 1.6, alpha: 0.8 }),
  rake: v({ shape: "sharp", count: 3 }),
  blade: v({ shape: "sharp", count: 1, len: 1.3 }),
  "multi-slash": v({ shape: "sharp", count: 5, speed: 1.4 }),
  chomp: v({ shape: "sharp" }),
  throw: v({ arc: 0.6 }),
  "quick-dash": v({ shape: "streak", speed: 1.5, len: 0.9 }),
  "heavy-slam": v({ speed: 0.8, len: 1.2, count: 1.4 }),
  blitz: v({ shape: "streak", speed: 1.3, len: 1.1, waver: 1.2 }),
  buff: v({}),
  guard: v({ shape: "sharp" }),
  heal: v({ waver: 0.5 })
};

// Iconic moves forced to a signature KIND (overrides the generic mapping below). The richer the
// signature list, the more the famous moves read exactly right; per-species overrides (v4b) layer on.
const SIGNATURE: Record<string, AnimKind> = {
  flamethrower: "flame-cone", "heat wave": "flame-cone", overheat: "flame-cone", "fire blast": "nova",
  "hyper beam": "thick-beam", "solar beam": "thick-beam", "flash cannon": "fast-shot",
  "giga impact": "heavy-slam", "body slam": "heavy-slam",
  "seismic toss": "throw", "aura sphere": "fast-shot", "shadow ball": "orb-lob", moonblast: "orb-lob",
  psystrike: "thin-ray", psychic: "nova", "focus blast": "fast-shot",
  thunderbolt: "sky-strike", thunder: "sky-strike", "volt tackle": "blitz", discharge: "nova",
  "water shuriken": "multi-shot", "hydro pump": "spray", surf: "wave", "bubble beam": "spray",
  earthquake: "quake", "rock slide": "quake", "stone edge": "quake",
  "dragon claw": "rake", "shadow claw": "rake", "dragon rush": "blitz", "draco meteor": "storm",
  crunch: "chomp", "close combat": "multi-slash", "leaf blade": "blade", "sacred sword": "blade",
  "psycho cut": "blade", "sludge bomb": "bomb", "quick attack": "quick-dash", "extreme speed": "quick-dash",
  "flare blitz": "blitz", "wild charge": "blitz", blizzard: "storm", hurricane: "storm",
  "swords dance": "buff", "calm mind": "buff", protect: "guard", recover: "heal", roost: "heal"
};

/** Map a move to one of the ~24 kinds: per-species OVERRIDE → signature → name patterns → type×class.
 *  Pass dexId to honour the iconic per-species exceptions in combat_overrides.ts. */
export function animKind(move: Move, dexId?: number): AnimKind {
  const n = move.name.toLowerCase();
  if (dexId != null) {
    const o = overrideKind(dexId, n);
    if (o) return o;
  }
  if (SIGNATURE[n]) return SIGNATURE[n];
  // status: shield / heal / generic buff
  if (move.cls === 1) {
    if (/protect|detect|guard|shield|withdraw|harden|barrier|wall|coil/.test(n)) return "guard";
    if (/recover|roost|rest|heal|synthesis|moonlight|morning|wish|soft|milk|slack/.test(n)) return "heal";
    return "buff";
  }
  // beams / rays / strikes-from-above
  if (/\bray\b|aurora beam|signal beam|moongeist|luster/.test(n)) return "thin-ray";
  if (/beam|cannon|laser/.test(n)) return "thick-beam";
  if (move.type === "electric" && /thunder|\bbolt\b|\bzap\b|volt|smite|spark/.test(n)) return "sky-strike";
  // breath cones: spray (water) / gas (poison-powder) / wind (air) / flame (fire)
  if (/spray|bubble|water gun|hydro|\bpump\b|scald|steam|brine|octazooka/.test(n)) return "spray";
  if (/gas|smog|powder|spore|smokescreen|acid|haze|defog|scent/.test(n)) return "gas";
  if (/breath|gust|whirlwind|aeroblast|air slash|air cutter|tailwind|twister/.test(n)) return /twister/.test(n) ? "storm" : "wind";
  if (/flame|fire spin|inferno|ember|incinerate|searing|magma|lava/.test(n)) return "flame-cone";
  // area / ground / sweep / weather
  if (/quake|magnitude|bulldoze|fissure|\bslide\b|\bstone\b|\brock\b|landslide|tectonic|stomping/.test(n)) return "quake";
  if (/surf|tsunami|whirlpool|muddy|\bwave\b|flip turn|aqua/.test(n)) return "wave";
  if (/storm|blizzard|sandstorm|meteor|eruption|avalanche|petal dance|leaf storm/.test(n)) return "storm";
  if (/explosion|self-?destruct|discharge|boomburst|detonate/.test(n)) return "nova";
  // bites / grabs
  if (/bite|fang|crunch|chomp|\bjaw\b|maul/.test(n)) return "chomp";
  if (/toss|throw|grab|suplex|seismic|fling/.test(n)) return "throw";
  // claws / blades / flurries
  if (/blade|psycho cut|sacred sword|\bcut\b|secret sword|night slash|cross|x-scissor|\bsword\b/.test(n)) return "blade";
  if (/fury|double|triple|multi|barrage|comet|arm thrust|close combat|rapid|tail slap|bone rush/.test(n)) return "multi-slash";
  if (/claw|slash|rake|scratch|lacerat/.test(n)) return "rake";
  // projectiles: volleys / bombs / orbs / fast shots
  if (/shuriken|missile|\bseed\b|spike|spear|rock blast|bullet|\bpin\b|icicle/.test(n)) return "multi-shot";
  if (/bomb|grenade|mine|egg/.test(n)) return "bomb";
  if (/ball|sphere|\borb\b|pulse|aura/.test(n)) return "orb-lob";
  if (/shot|gunk|focus blast|\bblast\b/.test(n)) return "fast-shot";
  // dashes / charges
  if (/quick|extreme ?speed|agility|sucker|mach|accel|feint/.test(n)) return "quick-dash";
  if (/blitz|charge|tackle|take ?down|double-?edge|brave bird|wood hammer|head/.test(n)) return "blitz";
  if (/impact|\bslam\b|body|heavy|crash|press|steamroll|punch|hammer arm|\bkick\b/.test(n)) return "heavy-slam";
  // generic: physical → a quick dash; special → a lobbed orb
  return move.cls === 2 ? "quick-dash" : "orb-lob";
}

/** Power → 0..1 intensity, scaling each archetype's size / particle count / duration. */
export function attackIntensity(move: Move): number {
  if (move.cls === 1) return 0.35;
  return Math.max(0.25, Math.min(1, move.power / 130));
}

/** Famous moves get a touch more flair (extra particles / a brighter impact). */
export function isSignatureMove(move: Move): boolean {
  return move.name.toLowerCase() in SIGNATURE;
}

export interface Spark {
  id: number;
  dx: number;
  dy: number;
  delay: number;
  size: number;
  color: string;
  emoji: string | null;
}

let seq = 0;

/** Radial explosion sparks at an impact point. */
export function impactSparks(color: string, emoji: string, count = 12): Spark[] {
  return Array.from({ length: count }, () => {
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 70;
    return {
      id: ++seq,
      dx: Math.cos(ang) * dist,
      dy: Math.sin(ang) * dist,
      delay: Math.random() * 70,
      size: 8 + Math.random() * 10,
      color,
      emoji: Math.random() < 0.3 ? emoji : null
    };
  });
}

/** A continuous stream of energy from attacker toward (dx, dy). */
export function streamSparks(
  color: string,
  emoji: string,
  dx: number,
  dy: number,
  count = 16
): Spark[] {
  return Array.from({ length: count }, (_, i) => ({
    id: ++seq,
    dx: dx + (Math.random() - 0.5) * 90,
    dy: dy + (Math.random() - 0.5) * 70,
    delay: i * 42,
    size: 10 + Math.random() * 12,
    color,
    emoji: Math.random() < 0.35 ? emoji : null
  }));
}

/** Jagged lightning polyline from the sky down to height h (for an 80px-wide svg). */
export function boltPath(h: number): string {
  const pts: string[] = ["40,0"];
  const steps = 6;
  for (let i = 1; i < steps; i++) {
    const y = (h / steps) * i;
    const x = 40 + (Math.random() - 0.5) * 38;
    pts.push(`${Math.round(x)},${Math.round(y)}`);
  }
  pts.push(`40,${Math.round(h)}`);
  return pts.join(" ");
}

export interface Rock {
  id: number;
  x: number; // percent across arena
  delay: number;
  size: number;
}

export function quakeRocks(count = 7): Rock[] {
  return Array.from({ length: count }, () => ({
    id: ++seq,
    x: 8 + Math.random() * 84,
    delay: Math.random() * 380,
    size: 14 + Math.random() * 14
  }));
}

export interface Confetto {
  id: number;
  x: number; // percent
  delay: number;
  color: string;
  drift: number;
}

const CONFETTI_COLORS = ["#ff8c42", "#58a8f0", "#ffd94a", "#6fcf5f", "#f85888", "#a890f0", "#f0a8d8"];

export function confettiBurst(count = 22): Confetto[] {
  return Array.from({ length: count }, () => ({
    id: ++seq,
    x: 10 + Math.random() * 80,
    delay: Math.random() * 600,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    drift: (Math.random() - 0.5) * 80
  }));
}
