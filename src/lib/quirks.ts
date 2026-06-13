// Personality quirks — the companion is intentionally NOT flawless. Each species
// gets a small, STABLE set of quirks (loves, habits, pet peeves) seeded by its
// dex id, so "your" companion always behaves like itself. Some are observant
// (it notices it's Monday, or that it's raining); some are just habits.
// Imperfection is what creates attachment. Surfaced as rare ambient murmurs.

export interface QuirkCtx {
  hour: number; // 0–23
  weekday: number; // 0 Sun … 6 Sat
  weather: string; // "none" | "rain" | "snow" | "wind" | "storm" | …
  isNight: boolean;
  isWinter: boolean;
}

interface Quirk {
  id: string;
  active: (c: QuirkCtx) => boolean;
  lines: string[];
}

// Observant quirks — only fire when the world matches, so it feels like the pet
// is paying attention to your actual life.
const OBSERVANT: Quirk[] = [
  {
    id: "night_owl",
    active: (c) => c.isNight || c.hour >= 22 || c.hour < 5,
    lines: [
      "This is my hour. The quiet's good, isn't it?",
      "Late again? Good. I like the company.",
      "The world's asleep. Just us and the screen."
    ]
  },
  {
    id: "early_bird",
    active: (c) => c.hour >= 6 && c.hour <= 9,
    lines: ["Mornings are underrated.", "Fresh start. I can feel it.", "Early light suits you."]
  },
  {
    id: "afternoon_snooze",
    active: (c) => c.hour >= 14 && c.hour <= 16,
    lines: ["Is it nap o'clock? Feels like nap o'clock.", "I could go for a tiny doze right about now."]
  },
  {
    id: "monday_blues",
    active: (c) => c.weekday === 1,
    lines: ["Mondays. We'll get through it together.", "Ugh, a Monday. Pace yourself, okay?"]
  },
  {
    id: "friday_joy",
    active: (c) => c.weekday === 5,
    lines: ["It's Friday. I can feel it in my pixels.", "Friday. Whatever happens, you made it here."]
  },
  {
    id: "weekend_lazy",
    active: (c) => c.weekday === 0 || c.weekday === 6,
    lines: ["Weekend. No rush today, hm?", "Slow mornings are the best kind."]
  },
  {
    id: "rain_lover",
    active: (c) => c.weather === "rain" || c.weather === "storm",
    lines: ["I love the rain. Let's just listen a moment.", "Rain on the window. Perfect, honestly."]
  },
  {
    id: "sun_lover",
    active: (c) => !c.isNight && (c.weather === "none" || c.weather === "wind"),
    lines: ["The light's nice today.", "Clear skies. Good day to build something."]
  },
  {
    id: "cold_sneeze",
    active: (c) => c.isWinter,
    lines: ["*tiny sneeze* …the cold gets me.", "Brr. Mind if I sit a little closer?"]
  }
];

// Habits — always available, fire rarely, give each companion a signature tic.
const HABITS: Quirk[] = [
  {
    id: "star_collector",
    active: () => true,
    lines: ["Found another star for my collection.", "Shh — I'm counting stars. …I lost count.", "I keep the shiny ones. Don't tell anyone."]
  },
  {
    id: "snacker",
    active: () => true,
    lines: ["Do you ever just… think about snacks?", "Is it snack time? It's always snack time.", "I'd trade one (1) bug-fix for a berry."]
  },
  {
    id: "tidy_jokes",
    active: () => true,
    lines: ["I alphabetized your bugs. …Kidding.", "Your code's tidy today. I noticed.", "I lined up the semicolons while you were away."]
  },
  {
    id: "hummer",
    active: () => true,
    lines: ["*humming quietly*", "♪ …oh, were you listening?", "I had a little song stuck. It's about you, kind of."]
  },
  {
    id: "daydreamer",
    active: () => true,
    lines: ["I was just imagining what we'll build next.", "Sometimes I drift off. You bring me back.", "I wonder what's past the edge of the screen."]
  }
];

function seed(dexId: number): number {
  let x = (dexId * 2654435761) >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296; // 0..1
}

function pickStable<T>(arr: T[], s: number, n: number): T[] {
  // deterministic, distinct selection from arr using a single seed
  const idx: number[] = [];
  let cur = s;
  while (idx.length < Math.min(n, arr.length)) {
    cur = (cur * 9301 + 49297) % 233280;
    const i = Math.floor((cur / 233280) * arr.length);
    if (!idx.includes(i)) idx.push(i);
  }
  return idx.map((i) => arr[i]);
}

/** The stable quirk set for a given companion (2 observant + 1 habit). */
export function companionQuirks(dexId: number): Quirk[] {
  const s = seed(dexId);
  return [...pickStable(OBSERVANT, s, 2), ...pickStable(HABITS, s + 0.37, 1)];
}

/** A short, plain summary like "night owl · collects stars" (for the Journey). */
export function quirkSummary(dexId: number): string {
  const label: Record<string, string> = {
    night_owl: "night owl", early_bird: "early riser", afternoon_snooze: "afternoon napper",
    monday_blues: "hates Mondays", friday_joy: "lives for Fridays", weekend_lazy: "slow on weekends",
    rain_lover: "loves the rain", sun_lover: "chases the sun", cold_sneeze: "sensitive to cold",
    star_collector: "collects stars", snacker: "always hungry", tidy_jokes: "secretly tidy",
    hummer: "hums to itself", daydreamer: "a daydreamer"
  };
  return companionQuirks(dexId).map((q) => label[q.id] ?? q.id).join(" · ");
}

/** A quirk line that fits right now, or null. Prefers an observant (context-
 *  matching) quirk so it feels attentive; falls back to a habit. */
export function quirkLine(dexId: number, ctx: QuirkCtx): string | null {
  const set = companionQuirks(dexId);
  const live = set.filter((q) => q.active(ctx));
  if (live.length === 0) return null;
  // bias toward observant quirks (those that aren't always-on habits)
  const observant = live.filter((q) => OBSERVANT.some((o) => o.id === q.id));
  const pool = observant.length && Math.random() < 0.7 ? observant : live;
  const q = pool[Math.floor(Math.random() * pool.length)];
  return q.lines[Math.floor(Math.random() * q.lines.length)];
}
