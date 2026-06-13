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

// Return-without-shame — tiered by absence length. Never a word about streaks.
export const returnDaysLines = [    // ~3–7 days away
  "Hey. Good to see you again.",
  "There you are. I kept things warm.",
  "Back again. Good. Sit down."
];
export const returnWeeksLines = [   // ~1–4 weeks away
  "It's been a little while. No worries — just glad you're here.",
  "Hey, stranger. Nothing's lost. We pick up right here.",
  "Welcome back. Life gets full sometimes. I get it."
];
export const returnMonthLines = [   // 1 month+ away
  "Hey. It's really good to see you again. I kept everything safe.",
  "You're back. However long it's been — none of it counts against you.",
  "It's been a while. I never minded waiting. Welcome home."
];

// End-of-night ritual — closing late, the pet settles in to sleep.
export const endOfNightLines = [
  "Good work today. I'll be here tomorrow.",
  "That's enough for tonight. Rest well.",
  "We did fine today. Go on, get some sleep.",
  "Night. I'll keep the place warm."
];

// Quiet-proud — extremely rare (~once every 2 weeks). Scarcity is the point.
export const quietProudLines = [
  "You've been showing up. I noticed.",
  "Quietly proud of you lately.",
  "You keep coming back to the work. That counts.",
  "Been a good stretch, this. Just wanted you to know."
];

// First coding session of a new day — a gentle "let's begin" (Ritual Design).
export const firstSessionLines = [
  "Ready? Let's see what today becomes.",
  "New day. We'll take it as it comes.",
  "Morning shape's still forming. Let's begin.",
  "Here we are again. Let's make a little progress."
];

// Deep bond callbacks — UNLOCKED at Companion+ only (Trust Escalation).
// Vulnerable, remembering. Said extremely rarely. Never to a stranger.
export const deepBondLines = [
  "You've survived hard seasons before. I remember them with you.",
  "We've come a long way from where we started. I haven't forgotten.",
  "I've watched you keep going when it was heavy. That stays with me.",
  "Whatever today holds — we've held harder. Together."
];

// Coding awareness — short, spoken-aloud quips (Microsoft TTS) the pet says when
// it notices git activity. Casual and warm; shown in the bubble AND spoken.
export const commitQuips = [
  "That's a commit.",
  "Saved.",
  "Nice, that's in.",
  "Mm, progress.",
  "Another one down."
];
export const fixQuips = [
  "Hmm — fixed a bug.",
  "Bug squashed.",
  "Ha, got it.",
  "Nice fix.",
  "That bug's gone now."
];
export const prQuips = [
  "Pull request merged. You shipped it.",
  "Merged it. Clean.",
  "PR's in — nice work.",
  "That's a big one. Merged."
];
export const releaseQuips = [
  "New release — you shipped it.",
  "It's live. Look at that.",
  "Tagged a release. Proud of this one.",
  "A release is out. Huge."
];
export const newRepoQuips = [
  "New repo? You're just cooking now.",
  "Fresh repo — a new adventure.",
  "Ooh, a new project.",
  "Starting something new. I'm in."
];
/** Commit-count milestone — spoken with the number. */
export function milestoneQuip(n: number): string {
  return pick([
    `${n} commits together. Look how far we've come.`,
    `${n} commits. We've built a lot, quietly.`,
    `That's ${n} commits side by side.`
  ]);
}

// Soft failure recovery — when something genuinely breaks, the pet notices
// warmly instead of showing an error. Never blames the user; hard rate-limited.
export const softFailLines = [
  "Hmm… something feels a little off. Give me a sec?",
  "Mm, that didn't quite work — not on you. I've got it.",
  "Something hiccuped on my end. Still here, though.",
  "One moment — something slipped. We're okay."
];

// Energy sensitivity — after a very long session, the pet softens its pace.
// Warmth, never a nag to stop. Said once, then it just gets quieter.
export const energyLowLines = [
  "We've been at this a while. We can keep it light from here.",
  "Long stretch today. No need to push — I'm just here.",
  "Plenty done already. Let's go gentle the rest of the way.",
  "You've earned a slower gear. I'll match it."
];

// Companionship-mode acknowledgements (said when the user switches modes).
export type CompanionMode = "default" | "just_there" | "fun";
export const modeLines: Record<CompanionMode, string> = {
  default:    "Back to normal. I'll keep it balanced.",
  just_there: "I'll just be here. Quietly.",
  fun:        "Okay — let's have some fun."
};

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
// "Someone believed in you" — tender, never triumphant.
export const praiseSaved = [
  "Someone saw that in you. I'm keeping it.",
  "Worth holding onto. Saved.",
  "They were right, you know.",
  "Folded away somewhere safe."
];

// ---- petting & feeding: small, warm, often wordless ----
export const pettingLines = [
  "*happy noises*",
  "Mm. That's nice.",
  "♪",
  "*leans in*",
  "Okay, you can keep doing that."
];
export const treatLines = [
  "*chomp* — thanks.",
  "Oh, for me?",
  "*happy munch*",
  "Best part of the day, this."
];

// ---- Good Things Jar ----
export const jarLines = [
  "Let's see what we kept.",
  "Some good ones in here.",
  "Proof the good days happened.",
  "Reaching in…"
];

// ---- comfort offer (after a heavy check-in; an emoji hint is appended) ----
export const comfortOffer = [
  "Want to look at something together?",
  "I kept a few good things, if you want them.",
  "No pressure — but it's here if you need it.",
  "We could just sit with something gentle."
];

// ---- letter / memory capsule from past-you has come due ----
export const letterReadyLines = [
  "Past-you left something for now.",
  "There's a note waiting. From you.",
  "You wrote this for today.",
  "Something you sealed away is ready."
];

// ---- evolution: offered, never forced ----
export const evolveOfferLines = [
  "Something's shifting. Want to grow together?",
  "I think I'm ready for the next shape. Only if you are.",
  "Feels like a new chapter. Evolve, or not yet — your call.",
  "I could become more. No rush, though."
];
export const evolveDeclineLines = [
  "Not yet. That's okay.",
  "Still me, then. Good.",
  "We'll know when it's time.",
  "Staying as I am. I'm in no hurry."
];
export const evolveDoneLines = [
  "New shape. Same memories. Same us.",
  "Look at that. Still me in here.",
  "We grew. Everything we built came along.",
  "Different form, same journey."
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
