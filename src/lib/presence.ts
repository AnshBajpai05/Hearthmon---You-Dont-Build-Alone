// The Presence System — Rule 7: presence > conversation.
// The pet should mostly do nothing. Lines are rare and time-aware.
import { getMeta, setMeta } from "./db";
import {
  pick,
  greetingFor,
  welcomeBackLines,
  longSessionLines,
  lateNightLines,
  ambientLines,
  dailyRitualLines
} from "./lines";

export type PetState = "idle" | "sleeping" | "happy";

export interface PresenceCallbacks {
  say: (line: string, ms?: number) => void;
  setState: (state: PetState) => void;
}

export interface PresenceOpts {
  greet?: boolean;
  onRitual?: () => void;
}

const LINE_COOLDOWN_MS = 20 * 60 * 1000; // ambient lines at most every 20 min
const SLEEP_AFTER_MS = 15 * 60 * 1000; // doze off after 15 min without interaction
const LONG_SESSION_MIN = 180;

let cb: PresenceCallbacks;
let sessionStart = 0;
let lastInteraction = 0;
let lastLineAt = 0;
let saidLongSession = false;
let saidLateNight = false;
let sleeping = false;
let focused = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** Focus Mode: the pet stays present but says nothing at all. */
export function setFocus(on: boolean): void {
  focused = on;
}

export async function initPresence(
  callbacks: PresenceCallbacks,
  opts: PresenceOpts = {}
): Promise<void> {
  cb = callbacks;
  sessionStart = Date.now();
  lastInteraction = Date.now();

  const now = new Date();
  const lastSeen = await getMeta("last_seen");
  await setMeta("last_seen", now.toISOString());

  if (opts.greet !== false) {
    // Launch greeting: long absence gets warmth, never guilt.
    const daysAway = lastSeen
      ? (now.getTime() - new Date(lastSeen).getTime()) / 86_400_000
      : 0;
    const line = daysAway >= 3 ? pick(welcomeBackLines) : greetingFor(now.getHours());
    // small delay so the pet appears first, then speaks
    setTimeout(() => speak(line, 9000), 1800);
  }

  // Opening ritual — fires on every launch (every relaunch feels intentional).
  // Stretch animation fires immediately; the warm line comes after the greeting settles.
  if (opts.greet !== false) {
    setTimeout(() => speak(pick(dailyRitualLines), 10000), 4500);
    if (opts.onRitual) opts.onRitual();
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
  if (focused) return; // protect focus — presence without interruption
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

  const cooledDown = Date.now() - lastLineAt > LINE_COOLDOWN_MS;
  if (sleeping || !cooledDown) return;

  // long session — once per session, a tiny "someone noticed"
  if (!saidLongSession && elapsed > LONG_SESSION_MIN * 60_000) {
    saidLongSession = true;
    speak(pick(longSessionLines));
    return;
  }

  // late night — once per session
  const h = now.getHours();
  if (!saidLateNight && h >= 0 && h < 5) {
    saidLateNight = true;
    speak(pick(lateNightLines));
    return;
  }

  // rare ambient murmur (~0.4% per minute ≈ a few times a day, capped by cooldown)
  if (Math.random() < 0.004) {
    speak(pick(ambientLines), 5000);
  }
}
