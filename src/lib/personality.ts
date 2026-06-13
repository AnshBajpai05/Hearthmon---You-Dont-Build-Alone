// Emergent personality — the companion quietly forms a read on HOW you work,
// from real signals (when you show up, how much you ship, what you log). Not a
// quiz; it just emerges. Surfaced gently in the Journey. Never judgemental.

export interface PersonaStats {
  nightSessions: number; // launches in 22:00–06:00
  daySessions: number; // launches in 06:00–22:00
  commits: number;
  learned: number;
  wins: number;
  goodRatio: number; // good moods / all mood check-ins (0..1)
  days: number;
}

export interface Persona {
  label: string;
  icon: string;
  blurb: string;
}

/** Derive an emergent personality, or null when there isn't enough signal yet. */
export function derivePersona(s: PersonaStats): Persona | null {
  const sessions = s.nightSessions + s.daySessions;
  if (sessions < 5 && s.commits < 5) return null; // too early — don't guess

  // Most distinctive first.
  if (s.commits >= 30 && s.nightSessions > s.daySessions) {
    return { label: "Chaotic Goblin", icon: "👺", blurb: "Late nights, lots of commits, zero chill. Respect." };
  }
  if (s.nightSessions >= 4 && s.nightSessions > s.daySessions * 1.3) {
    return { label: "Night Owl", icon: "🦉", blurb: "You do your best thinking after dark." };
  }
  if (s.daySessions >= 4 && s.daySessions > s.nightSessions * 1.6) {
    return { label: "Early Bird", icon: "🌅", blurb: "Mornings are yours." };
  }
  if (s.learned >= 8 && s.learned >= s.wins) {
    return { label: "Thoughtful Nerd", icon: "🧠", blurb: "You collect what you learn." };
  }
  if (s.days >= 21 && s.goodRatio >= 0.5) {
    return { label: "Steady Soul", icon: "🌿", blurb: "You keep showing up, kindly." };
  }
  if (s.commits >= 15) {
    return { label: "Quiet Builder", icon: "🔧", blurb: "Heads down, shipping." };
  }
  return { label: "Still Becoming", icon: "🌱", blurb: "We're still finding your rhythm." };
}
