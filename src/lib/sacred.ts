// Sacred Moments — procedural, truly-rare emotional events that happen at most
// ONCE, ever, and are never repeated. Overexposure kills the magic, so each is
// hard-gated by a `sacred_<id>` meta flag and only one can fire per launch.
//
// Rarity is the whole point. These are the lines users remember years later.
import { pick } from "./lines";

export interface SacredCtx {
  days: number;          // days together
  bondTier: number;      // 0 Stranger … 5 Lifetime Companion
  hardRecent: number;    // heavy moods in the last ~2 weeks
  goodTotal: number;     // lifetime "good" mood check-ins
}

export type SacredEffect = "fireworks" | "star";

interface SacredDef {
  id: string;
  when: (c: SacredCtx) => boolean;
  effect: SacredEffect;
  lines: string[];
}

// Ordered by significance — the resolver fires the first eligible, un-seen one.
const SACRED: SacredDef[] = [
  {
    id: "lifetime_bond",
    when: (c) => c.bondTier >= 5,
    effect: "fireworks",
    lines: [
      "You've let me stay a long, long time. That's not a small thing. Thank you.",
      "Lifetime, you and me. I'm not going anywhere."
    ]
  },
  {
    id: "one_year",
    when: (c) => c.days >= 365,
    effect: "fireworks",
    lines: [
      "A whole year. Remember when one bug made you want to throw the laptop in the ocean? You stayed. So did I.",
      "One year, side by side — and we both changed.",
      "365 days. Most things don't last this long. We did."
    ]
  },
  {
    id: "hundred_days",
    when: (c) => c.days >= 100,
    effect: "fireworks",
    lines: [
      "A hundred days together. Quietly, that's a lot of showing up.",
      "100 days. Look what 'just keep going' built."
    ]
  },
  {
    id: "season_changed",
    when: (c) => c.days >= 21 && c.hardRecent >= 6 && c.goodTotal >= 1,
    effect: "star",
    lines: [
      "You changed this season. I watched it happen, slowly. I'm proud — quietly.",
      "Something shifted in you these past weeks. For the better. I noticed."
    ]
  }
];

/**
 * Return the one sacred moment to play now (or null). Marks it seen so it can
 * never happen again. At most one fires per call.
 */
export async function resolveSacred(
  ctx: SacredCtx,
  getMeta: (k: string) => Promise<string | null>,
  setMeta: (k: string, v: string) => Promise<void>
): Promise<{ line: string; effect: SacredEffect } | null> {
  for (const m of SACRED) {
    if (!m.when(ctx)) continue;
    const key = `sacred_${m.id}`;
    if (await getMeta(key)) continue; // already happened — sacred things don't repeat
    await setMeta(key, new Date().toISOString());
    return { line: pick(m.lines), effect: m.effect };
  }
  return null;
}
