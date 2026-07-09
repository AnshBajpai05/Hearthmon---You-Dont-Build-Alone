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
  items: ItemPos[];                      // full-circle positions; empty when popover
}
export type Layout =
  | { mode: "ring"; rCat: number; cats: CatLayout[] }
  | { mode: "sheet" };

// ── tunables (px) ────────────────────────────────────────────
const CAT_BTN = 40;   // category button diameter
const SUB_W = 58;     // sub pill footprint incl. widest label
const SUB_H = 46;
const MARGIN = 8;     // keep-out from window edges
const CAT_FLOOR = 64; // below this category radius, a ring is dishonest → sheet
const CAT_MIN_SEP = 44;  // min angular separation between category buttons

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function pos(angle: number, r: number) {
  return { x: r * Math.cos(rad(angle)), y: r * Math.sin(rad(angle)) };
}

function angDist(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return d;
}

/** Would a button (half-size hw×hh) centred at (angle, r) leave the window or hit chrome? */
function blocked(input: SolveInput, angle: number, r: number, hw: number, hh: number): boolean {
  const cx = input.W / 2 + r * Math.cos(rad(angle));
  const cy = input.H / 2 + r * Math.sin(rad(angle));
  if (cx - hw < MARGIN || cx + hw > input.W - MARGIN) return true;
  if (cy - hh < MARGIN || cy + hh > input.H - MARGIN) return true;
  for (const c of input.chrome) {
    if (cx + hw > c.x && cx - hw < c.x + c.w && cy + hh > c.y && cy - hh < c.y + c.h) return true;
  }
  return false;
}

/** Drill-down ladder for one category: full-circle Orbit → Popover.
 *  The category vacates its ring spot for the widget centre, so its items get
 *  all 360° at a compact radius — capacity is huge compared to any fan. */
function solveOrbit(input: SolveInput, n: number, rMax: number): Pick<CatLayout, "mode" | "items"> {
  // rectangle-safe capacity: neighbouring chord must clear the pill diagonal.
  // The radius STRETCHES toward the window cap when the item count needs it.
  const minChord = Math.hypot(SUB_W, SUB_H) + 2;
  const rNeeded = minChord / (2 * Math.sin(Math.PI / n));
  const r = Math.min(Math.max(90, input.petSize / 2 + 26, rNeeded), rMax);
  if (2 * r * Math.sin(Math.PI / n) < minChord) return { mode: "popover", items: [] };

  // Free-space distribution: mask the angles where a pill would leave the
  // window or hit chrome, then spread the items evenly through the FREE
  // degrees. Neighbours that straddle a blocked sector only ever get FURTHER
  // apart — crowding is impossible by construction. (A per-item nudge can
  // clear the chrome yet slide into its neighbour; this can't.)
  const RES = 2;
  const slots = 360 / RES;
  const mask: boolean[] = [];
  let freeDeg = 0;
  for (let s = 0; s < slots; s++) {
    const ok = !blocked(input, s * RES, r, SUB_W / 2, SUB_H / 2);
    mask.push(ok);
    if (ok) freeDeg += RES;
  }
  const sReq = deg(2 * Math.asin(Math.min(0.95, minChord / (2 * r))));
  if (freeDeg < n * sReq) return { mode: "popover", items: [] };

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
    const p = pos(a, r);
    items.push({ angle: a, radius: r, x: Math.round(p.x), y: Math.round(p.y) });
  }
  return { mode: "orbit", items };
}

export function solveRadial(input: SolveInput): Layout {
  const { W, H, petSize } = input;
  // two independent caps: sub-pills orbit the CENTRE (not the category ring),
  // so the category ring only has to fit its own buttons
  const rMax = Math.min(W, H) / 2 - Math.max(SUB_W, SUB_H) / 2 - MARGIN; // orbit cap
  const rCatMax = Math.min(W, H) / 2 - CAT_BTN / 2 - MARGIN;            // category-ring cap
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
      ...solveOrbit(input, cat.n, rMax),
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
