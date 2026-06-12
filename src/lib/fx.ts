// Visual-effects director: picks an animation archetype from the move itself,
// so Hyper Beam fires a beam, Shadow Ball lobs an orb, Earthquake shakes rocks loose.
import type { Move } from "./attackfx";

export type AnimKind = "beam" | "orb" | "stream" | "slash" | "bolt" | "quake" | "status";

export function animKind(move: Move): AnimKind {
  if (move.cls === 1) return "status";
  const n = move.name.toLowerCase();
  if (/beam|cannon|laser|ray$|flash cannon/.test(n)) return "beam";
  if (move.type === "electric" && move.cls === 3) return "bolt";
  if (
    (move.type === "ground" || move.type === "rock") &&
    /quake|slide|rock|stone|fissure|stomping|bulldoze|avalanche/.test(n)
  )
    return "quake";
  if (/ball|bomb|sphere|shot|pulse|orb|spit|seed|egg/.test(n)) return "orb";
  if (move.cls === 2) return "slash";
  return "stream";
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
