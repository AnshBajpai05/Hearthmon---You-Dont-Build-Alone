// Radial-menu layout solver — pure geometry, no DOM.
//
// The action model (categories + items) is fixed; this module decides the best
// PRESENTATION for the current space. The menu is a DRILL-DOWN: level 1 shows
// the five categories; tapping one hands it the WHOLE space — the others
// collapse, the active category becomes a centre Back button, and its items
// orbit it in a full circle. Deterministic ladder:
//
//   whole menu:  Ring → Sheet      (sheet only when a category ring can't exist)
//   each drill:  Orbit → Popover   (popover only when even a full circle can't
//                                   hold the items — degradation stays LOCAL)
//
// Key invariants:
//  • window-aware: every radius is capped by the widget rect, not just the pet
//  • rectangle-aware: pills are 58×46 boxes, not points — orbit capacity uses
//    the box diagonal as the minimum chord between neighbours
//  • chrome-aware: items that land on reserved rects (trigger, opacity bar)
//    nudge along the circle to the nearest clear angle
//  • sticky: callers pass the previous solve's angles as anchors so categories
//    stay where muscle memory expects them unless space actually forces a move
//
// Angles in degrees, 0° = +x (right), y grows DOWN (CSS): 270° = top.

export interface Rect { x: number; y: number; w: number; h: number }

export interface CatInput {
  id: string;
  n: number;          // item count → drives the fan ladder
  baseAngle: number;  // canonical home position
  prevAngle?: number; // last solved angle (stickiness anchor)
}

export interface SolveInput {
  W: number;
  H: number;
  petSize: number;
  chrome: Rect[];     // reserved rects in widget coords (already-ducked chrome excluded)
  cats: CatInput[];
}

export interface ItemPos { angle: number; radius: number; x: number; y: number }
export interface CatLayout {
  id: string;
  angle: number;
  x: number; y: number;                  // px offset from widget centre
  mode: "orbit" | "popover";
  mini?: boolean;                        // orbit of icon-only 36px pills (tight windows)
  items: ItemPos[];                      // full-circle positions; empty when popover
}
export type Layout =
  | { mode: "ring"; rCat: number; cats: CatLayout[] }
  | { mode: "sheet" };

// ── tunables (px) ────────────────────────────────────────────
const CAT_BTN = 40;   // category button diameter
const SUB_W = 58;     // sub pill footprint incl. widest label
const SUB_H = 46;
const MINI = 36;      // icon-only pill (tight windows) — label moves to a hover caption
const MARGIN = 8;     // keep-out from window edges
const CAT_FLOOR = 64; // below this category radius, a ring is dishonest → sheet
const CAT_MIN_SEP = 44;  // min angular separation between category buttons

const rad = (d: number) => (d * Math.PI) / 180;

function pos(angle: number, r: number) {
  return { x: r * Math.cos(rad(angle)), y: r * Math.sin(rad(angle)) };
}

function angDist(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return d;
}

/** Would a button (half-size hw×hh) centred at (cx, cy) leave the window or hit chrome? */
function blockedXY(input: SolveInput, cx: number, cy: number, hw: number, hh: number): boolean {
  if (cx - hw < MARGIN || cx + hw > input.W - MARGIN) return true;
  if (cy - hh < MARGIN || cy + hh > input.H - MARGIN) return true;
  for (const c of input.chrome) {
    if (cx + hw > c.x && cx - hw < c.x + c.w && cy + hh > c.y && cy - hh < c.y + c.h) return true;
  }
  return false;
}

/** Same, for a point on the circle (angle, r) around the widget centre. */
function blocked(input: SolveInput, angle: number, r: number, hw: number, hh: number): boolean {
  return blockedXY(input, input.W / 2 + r * Math.cos(rad(angle)), input.H / 2 + r * Math.sin(rad(angle)), hw, hh);
}

/** Drill-down ladder for one category: Orbit → mini-Orbit → Popover.
 *  The category vacates its ring spot for the widget centre, so its items get
 *  the full perimeter. The orbit starts as a circle and STRETCHES toward the
 *  window's aspect (an ellipse) when the circle can't hold the items. If even
 *  the full ellipse can't hold LABELLED pills, the pills shrink to icon-only
 *  36px circles — the radial identity survives; the panel is a last resort. */
function solveOrbit(input: SolveInput, n: number): Pick<CatLayout, "mode" | "mini" | "items"> {
  const full = orbitSearch(input, n, SUB_W, SUB_H, 10, Math.max(90, input.petSize / 2 + 26));
  if (full) return { mode: "orbit", items: full };
  const mini = orbitSearch(input, n, MINI, MINI, 6, Math.max(66, input.petSize / 2 + 10));
  if (mini) return { mode: "orbit", mini: true, items: mini };
  return { mode: "popover", items: [] };
}

/** Scale one pill size from its preferred circle toward the full window ellipse. */
function orbitSearch(input: SolveInput, n: number, w: number, h: number, gap: number, rPref: number): ItemPos[] | null {
  const rxMax = input.W / 2 - w / 2 - MARGIN; // per-axis caps, not min-dim
  const ryMax = input.H / 2 - h / 2 - MARGIN;
  const rNeeded = (Math.hypot(w, h) + 2) / (2 * Math.sin(Math.PI / n)); // circle estimate
  const r0 = Math.max(rPref, rNeeded);
  const rx0 = Math.min(r0, rxMax);
  const ry0 = Math.min(r0, ryMax);
  for (let s = 0; s <= 1.001; s += 0.2) {
    const rx = rx0 + s * Math.max(0, rxMax - rx0);
    const ry = ry0 + s * Math.max(0, ryMax - ry0);
    const fit = orbitAt(input, n, rx, ry, w, h, gap);
    if (fit) return fit;
    if (rx >= rxMax && ry >= ryMax) break;
  }
  return null;
}

/** Try one ellipse: mask blocked param-angles, spread the items evenly through
 *  the FREE ones (neighbours straddling a blocked sector only get FURTHER
 *  apart), then EXACT-validate: no two pill boxes may come within `gap`px of
 *  each other. Geometry approximations propose; boxes decide. */
function orbitAt(input: SolveInput, n: number, rx: number, ry: number, w: number, h: number, gap: number): ItemPos[] | null {
  const RES = 2;
  const slots = 360 / RES;
  const mask: boolean[] = [];
  let free = 0;
  for (let s = 0; s < slots; s++) {
    const a = rad(s * RES);
    const ok = !blockedXY(input, input.W / 2 + rx * Math.cos(a), input.H / 2 + ry * Math.sin(a), w / 2, h / 2);
    mask.push(ok);
    if (ok) free++;
  }
  if (free < n) return null;

  // walk the free slots clockwise from the top (or the first free angle after it)
  let s0 = Math.round(270 / RES) % slots;
  for (let k = 0; k < slots && !mask[s0]; k++) s0 = (s0 + 1) % slots;
  const freeList: number[] = [];
  for (let k = 0; k < slots; k++) {
    const j = (s0 + k) % slots;
    if (mask[j]) freeList.push(j * RES);
  }

  const items: ItemPos[] = [];
  for (let i = 0; i < n; i++) {
    const a = freeList[Math.floor((i * freeList.length) / n)];
    items.push({
      angle: a,
      radius: rx,
      x: Math.round(rx * Math.cos(rad(a))),
      y: Math.round(ry * Math.sin(rad(a))),
    });
  }
  // exact pairwise clearance — every pill box vs every other, plus the centred Back button
  for (let i = 0; i < n; i++) {
    if (Math.abs(items[i].x) < (w + CAT_BTN) / 2 + 4 && Math.abs(items[i].y) < (h + CAT_BTN) / 2 + 4) return null;
    for (let j = i + 1; j < n; j++) {
      const dx = Math.abs(items[i].x - items[j].x);
      const dy = Math.abs(items[i].y - items[j].y);
      if (dx < w + gap && dy < h + gap) return null;
    }
  }
  return items;
}

export function solveRadial(input: SolveInput): Layout {
  const { W, H, petSize } = input;
  // orbit caps are per-axis (inside solveOrbit); the category ring only has
  // to fit its own buttons in the short dimension
  const rCatMax = Math.min(W, H) / 2 - CAT_BTN / 2 - MARGIN;
  if (rCatMax < CAT_FLOOR) return { mode: "sheet" };

  const rCat = Math.min(Math.max(86, petSize / 2 + 18), rCatMax);

  // ── category placement: nearest clear angle to the sticky anchor ──
  const placed: number[] = [];
  const cats: CatLayout[] = input.cats.map((cat) => {
    const anchor = cat.prevAngle ?? cat.baseAngle;
    let best = anchor;
    let found = false;
    for (let off = 0; off <= 90 && !found; off += 5) {
      for (const a of off === 0 ? [anchor] : [anchor + off, anchor - off]) {
        if (blocked(input, a, rCat, CAT_BTN / 2, CAT_BTN / 2)) continue;
        if (placed.some((p) => angDist(p, a) < CAT_MIN_SEP)) continue;
        best = a; found = true; break;
      }
    }
    placed.push(best);
    const p = pos(best, rCat);
    return {
      id: cat.id,
      angle: best,
      x: Math.round(p.x),
      y: Math.round(p.y),
      ...solveOrbit(input, cat.n),
    };
  });

  return { mode: "ring", rCat, cats };
}

/** Whisper/label side, derived from the SOLVED angle — always INWARD, toward
 *  the ring centre: the interior is the one region guaranteed to have room
 *  (the ring fits the window by construction), so a whisper can never clip. */
export function sideFor(angle: number): "top" | "right" | "left" | "bottom" {
  const c = Math.cos(rad(angle));
  if (c > 0.4) return "left";   // button on the right half → whisper toward centre
  if (c < -0.4) return "right"; // button on the left half → whisper toward centre
  return Math.sin(rad(angle)) < 0 ? "bottom" : "top"; // top of ring → under the button
}

export function dirHintFor(angle: number): 1 | -1 | 0 {
  const c = Math.cos(rad(angle));
  return c > 0.3 ? 1 : c < -0.3 ? -1 : 0;
}
