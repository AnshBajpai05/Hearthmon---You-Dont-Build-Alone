// The Presence System — Rule 7: presence > conversation.
// The pet should mostly do nothing. Lines are rare and time-aware.
import { getMeta, setMeta, oldMilestone } from "./db";
import {
  pick,
  greetingFor,
  returnDaysLines,
  returnWeeksLines,
  returnMonthLines,
  firstSessionLines,
  longSessionLines,
  lateNightLines,
  quietProudLines,
  deepBondLines,
  energyLowLines,
  ambientLines,
  personaAmbient,
  monthOf,
  lifeCallbackLine
} from "./lines";
import type { CompanionMode } from "./lines";

// Trust Escalation tiers (mirror bond.ts indices).
const TIER_FAMILIAR = 1;        // small warmth unlocks
const TIER_TRUSTED = 2;         // quiet-proud / "I noticed" depth unlocks
const TIER_COMPANION = 3;       // vulnerable deep-bond callbacks unlock

export type PetState = "idle" | "sleeping" | "happy";

export interface PresenceCallbacks {
  say: (line: string, ms?: number) => void;
  setState: (state: PetState) => void;
}

// Interaction Budget (SOUL RULE): the companion must never feel like it's
// "always talking." A proactive line fires at most once every 45 minutes.
const PROACTIVE_COOLDOWN_MS = 45 * 60 * 1000;
const SLEEP_AFTER_MS = 15 * 60 * 1000; // doze off after 15 min without interaction
const LONG_SESSION_MIN = 180;          // ~3 h: "someone noticed" the long haul
const ENERGY_MIN = 300;                // ~5 h: energy dips, the pet softens its pace

let cb: PresenceCallbacks;
let sessionStart = 0;
let lastInteraction = 0;
let lastLineAt = 0;
let saidLongSession = false;
let saidLateNight = false;
let saidEnergy = false;
let lowEnergy = false;   // after a very long session — quieter, gentler presence
let sleeping = false;
let focused = false;
let mode: CompanionMode = "default";
let bondTier = 0;   // 0 Stranger … 5 Lifetime Companion (Trust Escalation)
let persona = "";   // emergent personality label — flavors ambient murmurs
let timer: ReturnType<typeof setInterval> | undefined;

/** Focus Mode: the pet stays present but says nothing at all. */
export function setFocus(on: boolean): void {
  focused = on;
}

/**
 * Companionship mode — user-controlled presence level.
 *   default    → standard interaction budget
 *   just_there → silent presence, zero proactive lines (actions still respond)
 *   fun        → more frequent ambient murmurs
 */
export function setMode(m: CompanionMode): void {
  mode = m;
}

/** Trust Escalation: current bond tier (0 Stranger … 5 Lifetime). */
export function setBondTier(n: number): void {
  bondTier = n;
}

/** Emergent personality label (from lib/personality) — flavors ambient lines. */
export function setPersona(label: string): void {
  persona = label;
}

export async function initPresence(
  callbacks: PresenceCallbacks,
  opts: { greet?: boolean; onRitual?: () => void; onReturn?: () => void } = {}
): Promise<void> {
  cb = callbacks;
  sessionStart = Date.now();
  lastInteraction = Date.now();

  const now = new Date();
  const lastSeen = await getMeta("last_seen");
  await setMeta("last_seen", now.toISOString());

  if (opts.greet !== false) {
    // Launch greeting — return-without-shame: longer absence gets more warmth,
    // never a word about broken streaks or where you've been.
    const daysAway = lastSeen
      ? (now.getTime() - new Date(lastSeen).getTime()) / 86_400_000
      : 0;
    // first launch of a new calendar day → a gentle "let's begin" ritual line
    const today = now.toDateString();
    const firstOfDay = (await getMeta("last_greet_day")) !== today;
    await setMeta("last_greet_day", today);

    let line: string;
    if (daysAway >= 30) line = pick(returnMonthLines);
    else if (daysAway >= 7) line = pick(returnWeeksLines);
    else if (daysAway >= 3) line = pick(returnDaysLines);
    else if (firstOfDay) line = pick(firstSessionLines);
    else line = greetingFor(now.getHours());
    // small delay so the pet appears first, then speaks
    setTimeout(() => speak(line, 9000), 1800);
    // returning after an absence — a tiny dust-off, "I kept things warm"
    if (daysAway >= 3 && opts.onReturn) setTimeout(() => opts.onReturn!(), 2400);
    // opening ritual: a gentle stretch shortly after the greeting
    if (opts.onRitual) setTimeout(() => opts.onRitual!(), 3200);
  }

  if (timer) clearInterval(timer);
  timer = setInterval(tick, 60_000);
}

/** Call on any user interaction — wakes the pet, resets the doze timer. */
export function poke(): void {
  lastInteraction = Date.now();
  if (sleeping) {
    sleeping = false;
    cb.setState("idle");
  }
}

function speak(line: string, ms = 8000): void {
  if (focused) return;            // protect focus — presence without interruption
  if (mode === "just_there") return; // silent presence — zero proactive lines
  lastLineAt = Date.now();
  cb.say(line, ms);
}

async function tick(): Promise<void> {
  const now = new Date();
  const elapsed = Date.now() - sessionStart;
  await setMeta("last_seen", now.toISOString());

  // doze off when ignored — quietly, no announcement
  if (!sleeping && Date.now() - lastInteraction > SLEEP_AFTER_MS) {
    sleeping = true;
    cb.setState("sleeping");
  }

  // Interaction Budget: at most one proactive line per 45 min, ever.
  const cooledDown = Date.now() - lastLineAt > PROACTIVE_COOLDOWN_MS;
  if (sleeping || !cooledDown) return;

  // long session — once per session, a tiny "someone noticed"
  if (!saidLongSession && elapsed > LONG_SESSION_MIN * 60_000) {
    saidLongSession = true;
    speak(pick(longSessionLines));
    return;
  }

  // energy sensitivity — after a very long haul the pet softens its pace and
  // says so once, then stays quieter. Warmth, never a nag to stop.
  // (Familiar+ — a stranger commenting on your stamina would feel presumptuous.)
  if (!saidEnergy && bondTier >= TIER_FAMILIAR && elapsed > ENERGY_MIN * 60_000) {
    saidEnergy = true;
    lowEnergy = true;
    speak(pick(energyLowLines), 9000);
    return;
  }

  // late night — once per session
  const h = now.getHours();
  if (!saidLateNight && h >= 0 && h < 5) {
    saidLateNight = true;
    speak(pick(lateNightLines));
    return;
  }

  // quiet-proud — sacred rarity (~once every 2 weeks) AND earned: Trusted Friend+.
  if (mode !== "just_there" && bondTier >= TIER_TRUSTED && Math.random() < 0.0015) {
    const last = Number((await getMeta("last_quiet_proud")) ?? 0);
    if (Date.now() - last > 14 * 86_400_000) {
      await setMeta("last_quiet_proud", String(Date.now()));
      speak(pick(quietProudLines), 9000);
      return;
    }
  }

  // life-event callback — a specific old win/lesson, resurfaced months later
  // ("Remember June? You figured that out."). Trusted Friend+, ≥ ~18 days apart.
  if (mode !== "just_there" && bondTier >= TIER_TRUSTED && Math.random() < 0.0012) {
    const last = Number((await getMeta("last_lifecallback")) ?? 0);
    if (Date.now() - last > 18 * 86_400_000) {
      const mem = await oldMilestone(30);
      if (mem?.text) {
        await setMeta("last_lifecallback", String(Date.now()));
        speak(lifeCallbackLine(monthOf(mem.created_at), mem.text), 12000);
        return;
      }
    }
  }

  // deep-bond callback — vulnerable, remembering. Companion+ only, and rarer
  // still than quiet-proud: at most once a month. Vulnerability must be earned.
  if (mode !== "just_there" && bondTier >= TIER_COMPANION && Math.random() < 0.0008) {
    const last = Number((await getMeta("last_deep_bond")) ?? 0);
    if (Date.now() - last > 30 * 86_400_000) {
      await setMeta("last_deep_bond", String(Date.now()));
      speak(pick(deepBondLines), 10000);
      return;
    }
  }

  // rare ambient murmur — Fun chatters a little more; low energy goes quieter still.
  const ambientChance = mode === "fun" ? 0.011 : lowEnergy ? 0.002 : 0.004;
  if (Math.random() < ambientChance) {
    // sometimes a personality-flavored line instead of a generic one
    const pa = personaAmbient[persona];
    const line = pa?.length && Math.random() < 0.5 ? pick(pa) : pick(ambientLines);
    speak(line, 5000);
  }
}
