// Companion personality DRIFT — the companion's temperament quietly shifts from
// HOW YOU interact with it, so your companion becomes unlike anyone else's.
// (Per-species quirks in quirks.ts give baseline character; this layers your
// own relationship on top.) Computed from real signals, never a quiz.

export interface DriftStats {
  pets: number; // strokes
  feeds: number; // treats given
  plays: number; // zoomies + Fun-mode bouts
  comforts: number; // times Comfort Mode kicked in
  lowMoods: number; // heavy check-ins
  nightSessions: number;
  daySessions: number;
  commits: number;
  learned: number;
}

export interface Trait {
  key: string;
  label: string; // adjective for the summary
  score: number; // 0..1
}

export interface Temperament {
  traits: Trait[]; // ranked, strongest first
  top: string; // key of the dominant trait ("" if none strong yet)
  summary: string; // e.g. "playful · affectionate"
}

// saturating normaliser: more events → closer to 1, with diminishing returns
const sat = (x: number, k: number) => x / (x + k);

export function deriveTemperament(s: DriftStats): Temperament {
  const sessions = s.nightSessions + s.daySessions;
  const traits: Trait[] = [
    { key: "affectionate", label: "affectionate", score: sat(s.pets + s.feeds * 2, 10) },
    { key: "playful", label: "playful", score: sat(s.plays, 8) },
    { key: "calm", label: "calm", score: sat(s.comforts * 2 + s.lowMoods, 8) },
    { key: "nocturnal", label: "a night owl", score: sessions ? s.nightSessions / (sessions + 1) : 0 },
    { key: "diligent", label: "diligent", score: sat(s.commits, 30) },
    { key: "curious", label: "curious", score: sat(s.learned, 8) }
  ].sort((a, b) => b.score - a.score);

  // a trait is "real" only once it's clearly above the noise floor
  const strong = traits.filter((t) => t.score >= 0.34);
  const top = strong[0]?.key ?? "";
  const summary = strong.length
    ? strong.slice(0, 2).map((t) => t.label).join(" · ")
    : "still finding its temperament";
  return { traits, top, summary };
}

// a gentle line when a NEW dominant trait emerges (fired once per change).
export function driftLine(topKey: string): string {
  const m: Record<string, string> = {
    affectionate: "I've gotten softer around you, haven't I?",
    playful: "I think you've made me more playful.",
    calm: "We've found a calm rhythm together. I like it.",
    nocturnal: "I've become a night creature, same as you.",
    diligent: "I've picked up your habit of just… showing up.",
    curious: "You've made me curious about everything."
  };
  return m[topKey] ?? "I've changed a little, being around you.";
}
