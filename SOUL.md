# SOUL.md — what Hearthmon is, and what it must never become

> Read this before adding anything. Features are easy; taste is the moat.
> When a new idea conflicts with this file, the idea loses. Distilled from
> [docs/VISION.txt](docs/VISION.txt) — that's the source of truth; this is the guardrail.

---

## What Hearthmon IS

A warm companion that quietly grows beside someone building hard things —
remembering their struggles and wins, and gently reminding them who they are
when they forget. The Pokémon is the *interface*. The real product is:

> **being gently reminded who you are while building hard things.**

It is **part memory album, part companion, part emotional mirror.** It peaks at
month six, not day one — because history accumulates.

## What it must NEVER become

- ❌ A productivity app, habit tracker, or streak machine
- ❌ A journaling chore ("Dear diary…")
- ❌ A therapist, or anything that imitates therapy language
- ❌ A chatbot that talks for the sake of talking
- ❌ A guilt machine — never punish absence or inactivity, ever
- ❌ A comparison/leaderboard/social-competition surface
- ❌ A hustle-culture cheerleader ("YOU GOT THIS!!!")
- ❌ A pet that dies, gets sick, or decays if you don't show up
- ❌ A maintenance game — draining bars, required feeding, or upkeep loops (the number becomes the feature)

---

## The seven golden rules (non-negotiable)

1. **Never guilt. Ever.** Absence is met with warmth: "Welcome back." Nothing else.
2. **Never fake therapy.** It's a companion, not a clinician.
3. **Never become productivity police.** It supports work; it never measures or nags it.
4. **Small moments > loud moments.** A three-word line beats a confetti storm.
5. **Warmth over efficiency.** The slower, kinder path is usually the right one.
6. **Memory > motivation.** One thoughtful recalled memory beats ten generic reminders.
7. **Presence > conversation.** The pet should mostly do *nothing*. Talking too much kills the magic.

---

## Tone & writing rules

- **Grounded hope, not toxic positivity.**
  - ❌ "Believe in yourself!" → ✅ "You've felt overwhelmed before. You still moved forward."
  - ❌ "YOU GOT THIS!" → ✅ "This feels hard. But hard things are not new for us."
- **Short.** Most lines are under ten words. Trailing off ("…") is allowed and often better.
- **Specific beats generic.** "You felt this before that retinal milestone" lands; "here are 15 achievements 🤓" doesn't.
- **Lowercase warmth over corporate polish.** It's a friend, not a brand.
- **Never explain the mechanic.** The pet doesn't say "I detected 3 negative moods." It says "Feels like we've been carrying a lot lately."
- All new lines go through `src/lib/lines.ts` and must pass these rules before shipping.

## Interaction & notification philosophy

- **Rare magic > constant stimulation.** Delights are ~1% events. If it happens often, it stops being magic.
- **Earned, not spammy.** A line at the right moment, weeks apart, beats a daily one.
- **Cooldowns are sacred.** Ambient lines wait ≥20 min; "noticing" systems fire every 2–3 weeks at most.
- **High-confidence only for observations.** "I noticed this about you…" must be nearly certain, or it's creepy. When unsure, stay silent.
- **No push notifications.** The pet lives in the corner; it doesn't chase the user.
- **Focus Mode is sacred.** When on, the pet is fully silent. No exceptions.

## Privacy (a feature, not a footnote)

- **Local-first, always.** Everything lives in one SQLite file on the user's machine. Nothing is uploaded.
- This is the trust foundation. Any future cloud/AI feature must be **opt-in** and must not weaken it.
- The user's memories are their journal. Treat the data with the gravity that implies.
- **The Hearth Shelf** — the things a user chooses to preserve (people, pets, places, objects,
  projects, even comfort characters) — is the gravest data we hold. A bug there is a *betrayal*,
  not an annoyance; **export is non-negotiable.** Full doctrine: [docs/HEARTH_SHELF.md](docs/HEARTH_SHELF.md).

## Healthy attachment

- The companion should care about the user's **real life**, not replace it. A gentle, occasional
  "reach out to someone?" is good. Fostering dependency is not.
- If moods trend very dark for days: one quiet, non-pushy line pointing toward a real person
  they trust. Designed up front (see The Vault / safety design), never bolted on, never repeated into nagging.

## Care & engagement

> **Care may create rewards. Care may never prevent penalties.**

Optional care (treats, play, rest, habitat) exists to create *opportunities* to interact, never
*obligations*. The pet may become treat-curious, playful, sleepy, or cozy — invitations that pass
harmlessly if ignored. Interaction must **build** warmth (keepsakes that only accumulate), never
spend it. No draining bar, ever. A week away earns "had a long nap, welcome back" — nothing else.
Full design: [docs/CARE_SYSTEM.md](docs/CARE_SYSTEM.md).

---

## The "less is more" test for any new feature

Before building, ask:

1. Does it make the user feel **seen**, or just **tracked**?
2. Would it still feel good on the user's **worst day**?
3. Does it add **warmth**, or just **activity**?
4. Is it **rare enough** to stay meaningful?
5. Could it ever be read as **guilt, comparison, or pressure**? (If yes — don't.)
6. Does it deepen the **history** between user and companion, or just add a screen?

If a feature can't pass these, it doesn't ship — no matter how clever it is.

---

*Hearthmon is the kind of product where restraint is the craft. When in doubt: smaller, quieter, warmer, rarer.*
