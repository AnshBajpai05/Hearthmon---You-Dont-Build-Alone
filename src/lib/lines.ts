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
// ---- Build / Training awareness (nvidia-smi) ----
export const trainStartLines = [
  "That one looks heavy. I'll stay nearby.",
  "Big run starting — I've got the watch.",
  "Tensors are flowing. I'll keep you company.",
  "Here we go. I'll sit with you through this one."
];
export const trainHeavyLines = [
  "GPU's pinned. You've got this — I'll keep watch.",
  "It's working hard. So are you. Breathe.",
  "Still cooking. I'm right here.",
  "That's a lot of heat. Steady — I'm with you."
];
// outcome-agnostic on purpose — we can't tell success from a crash via nvidia-smi,
// so we honour the effort, not the result (soul: presence > outcome).
export const trainDoneLines = [
  "Training's done — and it finished clean. Proud of that.",
  "Run complete. Look what you trained.",
  "It's done! Go stretch — that was a real session.",
  "Finished. The work paid off — nice one."
];
export const trainProgressLines = [
  "It's learning — the loss is dropping.",
  "Steady progress. Keep going.",
  "Numbers are moving the right way.",
  "Look at it go."
];
// a crash/error: sympathy, never blame (soul: never guilt). "we", not "you".
export const trainCrashLines = [
  "Oof — that one hurt. Want to look at it together?",
  "It stopped early. Bugs happen — we'll get it.",
  "Hit an error. Take a breath; we'll sort it out.",
  "That one broke. Not your fault — let's see why."
];

// ---- "Alongside you": quiet long-term awareness of the project you keep
// returning to. Escalates with the number of days you've worked on it.
export const ALONGSIDE_STAGES = [3, 7, 14, 30, 60, 100];
export function alongsideLine(stage: number, project: string): string {
  switch (stage) {
    case 3: return `Still working on ${project}, huh?`;
    case 7: return `Feels like ${project} matters to you.`;
    case 14: return `${project} — you've really stayed with this one.`;
    case 30: return `A month with ${project}. Quietly impressed.`;
    case 60: return `${project} has been with us a long while now.`;
    default: return `Still here, still on ${project}. I like that about you.`;
  }
}
// ---- Flow awareness (working-tree save cadence) ----
// said ONCE when you drop into deep work — then the companion goes quiet (the
// presence IS the silence). Never naggy.
export const flowLines = [
  "You're in it. I'll keep quiet.",
  "Deep focus — I'll just be here.",
  "Flow state. I've got the quiet covered.",
  "You're locked in. I'll hold the space."
];
// OBSERVATIONAL, never emotional — we notice the EFFORT, never claim the feeling.
// "stuck" pattern: lots of editing over a long stretch, no commit landing.
export const frictionStuckLines = [
  "This one seems stubborn.",
  "Looks like you've been deep in this one.",
  "Knotty problem, huh? You'll untangle it.",
  "You've been at this a while. I'm right here."
];
// "bouncing" pattern: lots of back-and-forth between apps WHILE editing.
export const frictionBounceLines = [
  "You've been bouncing between things a lot.",
  "Lot of back-and-forth on this one.",
  "Chasing this across a few windows, huh?"
];
// a commit that ENDED a long struggle — hard-won, celebrated louder than a
// routine commit. the companion witnessed the fight.
export const breakthroughLines = [
  "THAT'S the one. You cracked it.",
  "After all that — you got it. I saw the fight.",
  "Breakthrough. That was hard-won.",
  "You stayed with it till it broke open. Proud of that."
];

// ---- Chapter Memory: a day worth remembering (effort density) ----
// said when a chapter is quietly kept — companion warmth, never "productivity".
export const chapterMomentLines = [
  "Today's one I'll remember.",
  "A lot happened today. I was here for it.",
  "We went a long way today. I'll hold onto this one.",
  "Today felt like one of the big ones."
];
// a rare, sacred recollection — shared memory, NOT data recall. Internally the
// chapter has a kind (sprint / long_night / breakthrough) but the user only ever
// experiences quiet remembering.
export function arcCallbackLine(project: string, kind = "sprint"): string {
  const night = [
    "We've spent a lot of late nights with this one.",
    `This room feels different from those early ${project} nights.`
  ];
  const breakthrough = [
    "We've cracked some hard things together.",
    "We've carried a few things together now."
  ];
  const general = [
    "We've carried a few things together now.",
    `We've gone a long way with ${project}.`,
    "We've put real time into this, you and me."
  ];
  const bank = kind === "long_night" ? night : kind === "breakthrough" ? breakthrough : general;
  return bank[Math.floor(Math.random() * bank.length)];
}
// returning to a project after a long gap — observational, warm.
export function projectRevisitLine(project: string): string {
  const bank = [
    `Been a while since we touched ${project}.`,
    `${project} again — good to be back in it.`,
    `We're back on ${project}. I remember this one.`
  ];
  return bank[Math.floor(Math.random() * bank.length)];
}

// fired once when you move on from a project you stuck with — honours the effort.
export function projectStayedLine(project: string): string {
  const bank = [
    `You stayed with ${project} all the way. We saw it through.`,
    `${project} — that chapter's behind us now. You showed up for it.`,
    `We gave ${project} what it needed. Onto the next, together.`
  ];
  return bank[Math.floor(Math.random() * bank.length)];
}
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

// Persona-flavored ambient murmurs — keyed by the emergent personality label
// (see lib/personality.ts). Used occasionally in place of generic ambient lines.
export const personaAmbient: Record<string, string[]> = {
  "Night Owl": ["The quiet hours suit you.", "Us and the dark again. I like this.", "Late, but you're in the zone."],
  "Chaotic Goblin": ["Chaos — but it's working.", "Wild run today. I'm here for it.", "No plan, all momentum. Respect."],
  "Early Bird": ["You and the morning. Good combo.", "Early start, calm hours.", "Fresh light, fresh page."],
  "Thoughtful Nerd": ["You really chew on things. I notice.", "Another thing understood, quietly.", "You go deep. It suits you."],
  "Steady Soul": ["Steady as ever — that's rare.", "You just keep showing up. It counts.", "Quiet consistency. I see it."],
  "Quiet Builder": ["Heads down, building. I'll keep watch.", "Bit by bit. That's how things get made.", "Less talk, more made."],
  "Still Becoming": ["Still finding our rhythm. No rush.", "Early days for us. I'm curious.", "We're just getting started."]
};

// Life-event callback — the pet remembers a specific old moment, months later.
export function lifeCallbackLine(when: string, text: string): string {
  return pick([
    `Remember ${when}? "${text}". You figured that out.`,
    `Back in ${when} — "${text}". Look how that turned out.`,
    `I still think about ${when}: "${text}". That was all you.`
  ]);
}

// Tiny-wins auto-capture — a coding streak quietly noticed. Never a nag, never
// a "don't break it" guilt-trip; just warmth for showing up.
export function streakLine(days: number): string {
  return pick([
    `${days} days in a row. Quietly proud of you.`,
    `That's ${days} days you kept showing up. It adds up.`,
    `${days} days running. No pressure to keep it — just noticing.`,
    `${days} days together at this. Steady.`
  ]);
}

// Chapter closed — a period of life, sealed. Warm, a little proud.
export function chapterCloseLine(name: string): string {
  return pick([
    `"${name}" — that chapter's closed. We lived it.`,
    `End of "${name}". You carried it the whole way.`,
    `"${name}", done. Onto whatever's next.`
  ]);
}

// Bond tier deepened — a quiet, earned milestone (never triumphant).
export function bondUpLine(stage: string): string {
  return pick([
    `Something shifted. We're ${stage} now.`,
    `${stage}. I feel it too.`,
    `We crossed into ${stage}. Quietly big.`,
    `${stage} — it took real time to get here.`
  ]);
}

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
