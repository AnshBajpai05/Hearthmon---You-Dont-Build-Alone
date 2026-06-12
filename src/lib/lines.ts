// Curated line banks. Tone rules from the vision doc (non-negotiable):
//   - never guilt, ever
//   - grounded hope, not "YOU GOT THIS"
//   - short; presence > conversation
//   - warmth over efficiency
import type { Mood } from "./db";

export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ---- greetings ----
const morning = ["Morning.", "New day. No rush.", "Hi. Coffee first, probably."];
const afternoon = ["Hey.", "Afternoon.", "Good to see you."];
const evening = ["Evening.", "Hey. How'd today treat you?", "We're here again. Good."];
const night = ["Late one tonight.", "Night shift, huh.", "Quiet hours. The good ones."];

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return pick(morning);
  if (hour >= 12 && hour < 17) return pick(afternoon);
  if (hour >= 17 && hour < 23) return pick(evening);
  return pick(night);
}

// Returning after days away — only warmth, never guilt.
export const welcomeBackLines = [
  "Welcome back.",
  "Good to see you.",
  "You're here. That's what matters."
];

export const longSessionLines = [
  "Long session today.",
  "We've been at this a while.",
  "Still going. Noted."
];

export const lateNightLines = [
  "Late one tonight.",
  "I'll stay up with you.",
  "Quiet hours. I like these."
];

// Rare ambient murmurs — most of the time the pet says nothing at all.
export const ambientLines = [
  "…",
  "*stretches*",
  "Still here.",
  "Take your time.",
  "I like this time of day."
];

// Tiny reactions when poked. Sometimes nothing. That's intentional.
export const pokeReactions = ["?", "♪", "Hi.", "*blinks*", "Mm?"];

// ---- mood responses: grounded, never toxic positivity ----
export const moodResponses: Record<Mood, string[]> = {
  good: [
    "Logged. Today goes in the good column.",
    "I'll remember this one.",
    "Quiet wins still count."
  ],
  stressed: [
    "Okay. One thing at a time.",
    "We don't have to carry it all at once.",
    "Heavy weeks have passed before. This one will too."
  ],
  tired: [
    "Rest is allowed.",
    "Long days add up. Be gentle with yourself.",
    "Maybe tea soon."
  ],
  low: [
    "Thanks for telling me.",
    "We don't have to fix anything right now.",
    "I'll sit with you a while."
  ],
  frustrated: [
    "This feels hard. But hard things are not new for us.",
    "That bug has no idea who it's dealing with.",
    "Stuck is a phase, not a verdict."
  ],
  uncertain: [
    "Not knowing yet is a fair place to stand.",
    "We've started from unsure before.",
    "Clarity usually shows up after we begin."
  ]
};

// "We've been here before" — memory retrieval beats generic comfort.
export function familiarLine(mood: Mood, when: string): string {
  return `This feels familiar. Back in ${when}, you felt ${mood} too — and you're still here.`;
}

// ---- logging acknowledgements ----
export const winSaved = [
  "That one goes in the jar.",
  "Saved. Future you will want to see this.",
  "Noted. Quietly proud."
];
export const learnedSaved = [
  "New tool acquired.",
  "Added to the list of things you couldn't do before.",
  "The brain grows."
];
export const survivedSaved = [
  "Into the Hard Things Archive it goes.",
  "Survived and recorded.",
  "We'll remember this one was hard."
];

// First meeting — the seed memory response.
export const firstMeetingClose = [
  "Then we build it together.",
  "Alright. I'm in.",
  "Okay. That's ours now."
];

// After a form switch — the body changes, the history doesn't.
export const switchLines = [
  "New form. Same memories.",
  "Still me in here.",
  "Different shape — same journey."
];

// Gentle burnout awareness — no diagnosis, no advice. Just noticing.
export const burnoutLines = [
  "Feels like we've been carrying a lot lately.",
  "Heavy week. We don't have to fix it tonight.",
  "You've been pushing hard. I noticed."
];

// Anniversaries — memory > motivation.
export function anniversaryLine(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365;
    return years === 1
      ? "One year, side by side. Look how far we've come."
      : `${years} years together. Still here.`;
  }
  const months = Math.round(days / 30);
  return months === 1
    ? "A month together already."
    : `${months} months of building together.`;
}

export function monthOf(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const m = months[d.getMonth()] ?? "a while back";
  const thisYear = new Date().getFullYear();
  return d.getFullYear() === thisYear ? m : `${m} ${d.getFullYear()}`;
}

export function shortDate(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---- daily opening ritual — first launch of the day, once only ----
export const dailyRitualLines = [
  "New day. Still here. Let's see what it brings.",
  "Morning. You made it to another one.",
  "Today's a blank page. No mistakes yet.",
  "Hey. Good to see you again.",
  "Here we go. One day at a time.",
  "Another morning. You've got this one."
];

// Good Things Jar — the one line the pet says when you open it
export const jarLines = [
  "Want to see something?",
  "I've been saving these.",
  "Open the jar.",
  "Look what we've collected."
];

// Letter read-back — what the pet says when a note is waiting
export const letterReadyLines = [
  "You left something for yourself.",
  "Past you had something to say.",
  "There's a note waiting for you."
];
