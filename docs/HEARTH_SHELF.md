# Hearthmon — The Hearth Shelf (doctrine)

> Captured 2026-06-18 from a long design conversation. **Doctrine, not a backlog.**
> Defines what the Shelf *is* and what it must never become. v0.1 implements almost none of
> it on purpose — see "V0.1 scope." When anything here conflicts with [SOUL.md](../SOUL.md)
> or [EMOTIONAL_SAFETY.md](EMOTIONAL_SAFETY.md), those win. Strategic journey + staging lives
> in [V3_thought_and_plan.md](V3_thought_and_plan.md).

---

## The one-line idea

A shelf where someone places the things that shaped them — and the things that bring them peace.

Working name: **the Hearth Shelf** (placeholder — do not lock it). When the idea broadened
past people, the honest title became **"Things I Hold Close."** That's more powerful *and*
more dangerous: the wider it gets, the easier the soul is to lose.

Not "upload a photo → generate a companion." That's a novelty. The real thing:

> **preserve what made you who you are.**

---

## What it must NEVER become

The broadening's whole danger is one slide:

- ❌ **Favorites**
- ❌ **Bookmarks**
- ❌ a **collection of cool things**

The instant it asks *"what do you like?"*, the soul evaporates. It may only ever ask:

> **"what helped make you who you are?"**

Those are completely different questions. Likes are disposable. The shelf is not.

---

## The belonging test

There are **no banned categories** — only a banned *reason*. The filter is never the object;
it is whether a **story that shaped you** is attached.

- **Belongs** (a story shaped you): Dad · Mom · a grandmother · the childhood dog · a first
  laptop · a first guitar · Pokémon · Totoro · Harry Potter · the library you studied in · a
  project you bled into · an offer letter · Hearthmon itself.
- **Doesn't belong** (the only reason is "I like it"): a random meme · a cool wallpaper ·
  pizza · a random video · "my favorite keyboard."

The subtlety that makes this robust: a keyboard *can* belong — *"the keyboard I wrote my first
program on"* — and a laptop *can't* if it's just "nice." Same object, opposite verdicts.
**The object isn't sacred. The story is.** That is why the architecture asks *why* before *what*.

---

## The architecture: ask WHY, never WHAT

The shelf must never lead with a category picker —

> "What is this?"

It leads with —

> "Why does this matter?"

The category is *secondary metadata*: captured quietly so beta can read the distribution
(below), never the gate for entry. An entry earns its place through its story:

```
Pikachu       → "I grew up watching Pokémon with my brother."        ✅ belongs
First Laptop  → "Dad bought it when we couldn't really afford it."    ✅ belongs
Hearthmon     → "The first thing I built that felt truly mine."       ✅ belongs
```

---

## The four questions (broadened)

1. **What is this?**
2. **Why does it matter?**
3. **How does it still shape you?**
4. **What happens when carrying it hurts?**

(Broadened from "Who are they? / How are they still with you?" so it holds people, pets,
places, projects, objects, and fictional characters without changing the architecture.)

The first three are about *holding on*; the fourth is about *letting go*. A sanctuary needs
both — preservation without release becomes a haunting, not a hearth.

They are a **gradient of trust over time**, not rival features. You can't deliver Q3 on day 0
(no trust yet); you can't reach Q2 without Q1 (no anchor). Recognition isn't powerful — it is
the *on-ramp that funds* the rest. "That *feels* like it shaped me" is earned over time;
"that's a real thing in my life" is the only thing deliverable on day one.

---

## What belongs (the kinds)

| Kind | Examples |
|---|---|
| People | a parent, a mentor, a friend |
| Animals | the dog you grew up with |
| Places | a childhood home, a grandfather's farm, the library |
| Objects | a first laptop, an old guitar, a notebook |
| Projects | the thing you spent eight months building |
| Moments | a graduation, a first publication, an offer letter |
| Comfort / fiction | Pokémon, Totoro, a game or character that steadies you |

**Open tension — do NOT resolve yet.** "What *shaped* you" (identity) and "what *brings you
peace*" (refuge) are different axes. An estranged parent shaped you but brings no peace; a
comfort character brings peace but shaped little. v0.1 exists to learn which one people reach
for — and *that* answer decides what this product is.

---

## Principles (this is the "be careful")

**Scarcity.** If everything belongs, nothing is sacred. A shelf with no cost to add is a junk
drawer, and a junk drawer has no sanctity. Placing something here should take a little
deliberation. Few, weighted, chosen.

**Timing — pull-first for anything heavy.** The deeper the memory, the *less* the system
should initiate it. Light things may surface on their own; deep things wait behind "sit with
this" / "visit the hearth." The system never knows whether the user is coding late or
grieving — so for heavy memories it does not guess. (Extends SOUL.md *Presence > conversation*
and the EMOTIONAL_SAFETY interaction budget.)

**Release — nothing traps you in a past version of your life.**
- People and things change. The shelf must never freeze you to your worst day.
- Nothing is ever *deleted* (deletion is its own loss) — but nothing is *permanent* either.
- Release must be **reversible** (people reconcile; grief softens).
- The hard part is not the *states*, it's the *transition* — and transitions happen when
  someone is hurting. That's a human problem, not a UI problem. **Do not design it yet.**
  Doctrine only:
  > Relationships change. People must never feel trapped. Nothing is permanently deleted.
  > Release must be reversible.

**Sanctuary.** A sanctuary is defined not by what it preserves, but by **how safely it holds
it** — safe from loss, safe from intruding at the wrong moment, safe enough to set something
down when carrying it hurts.

---

## Data is no longer "save state" — it IS the product

When the app stored `bond_level` and `battle_wins`, a bug was annoying. When it stores *a
memory of a parent, the story behind a passed grandmother, a voice note from a mentor*, a bug
becomes a **betrayal.** So before any beautiful layer ships:

- **Export is non-negotiable.** A sanctuary you can't carry out will eventually betray you.
- **Backup, migration, and corruption-recovery** are first-class, not afterthoughts.
- Every data-integrity finding in [existing_issues.md](../existing_issues.md) just went up an
  order of magnitude in severity. Re-read them through that lens.

---

## Deferred layers (the cathedral — captured, NOT to build yet)

Real ideas, written down so they aren't lost — and explicitly **out of v0.1**:

- **Recognition portrait** — a warm, *own-style* "Hearth Portrait," not literal Ghibli
  (Ghibli's brand + public anti-AI stance is a landmine on a shipping product). The user
  chooses/confirms; the system never decrees.
- **Presence / spirit** — a *symbolic* companion (lantern, ember, starbird…), **picked by the
  user** from a small set the traits merely *rank*. Earned over time, never minted from one
  photo. Generate once, store forever, never silently re-roll — consistency *is* the bond.
- **Presence models** — not one behavior for all. Living = present/reactive; mentor = appears
  at crossroads; *passed = rare, encountered, never summoned, never "played with."*
- **Legacy may be emergent**, not declared. "Mark as deceased" is too grim to require — it can
  just be a gracefully-held *Resting*. Death ≠ breakup emotionally, but you may not need a
  separate declared state to honor that; you need Resting gentle enough to hold both.
- **Release states** — Living / Archived / Resting / Legacy. Doctrine above; transition deferred.
- **Anniversaries / rare crossovers** — once-per-year sacred, never repeated, pull-leaning.
- **Intent Lenses (a configurable *lean*, never a mode)** — over time the Hearth may *notice* a
  pattern (*"a lot of your shelf is people" / "…is projects" / "…is comfort"*) and **offer**,
  declinably, to lean toward it. Not a mode, not onboarding, not identity selection. Hard rules:
  (1) informed by **observed behavior**, never declared up front; (2) never appears before there
  are **several entries**; (3) **never biases the first-entry distribution signal.** This is
  *"reveal the soul, don't declare it"* applied to the shelf's own shape — the reason Hearthmon
  has no personality quiz or "what kind of builder are you?" The pattern is consistent: identity
  emerges from time + behavior + history, never from a button.

---

## V0.1 scope — the only thing to build now

The whole experiment answers **one** question:

> **Will people voluntarily preserve meaningful things here?**

Build:
- **add something** — give it a name; a **photo** is optional.
- lead with the **story, not the category** — **choose a door** (these are flavors of "why
  does it matter," never one fixed question):
  - something it/they taught you
  - a moment you'll never forget
  - something it/they always meant to you
  - a time it/they showed up for you
- a **light, optional category tag** (person / pet / place / object / project / moment /
  comfort) — captured quietly for the distribution metric, **never** the leading question.
- **store it** locally (the one SQLite file) and **export it.**

Nothing else. No portraits, spirits, generation, AI, presence, archetypes, anniversaries,
reminders, release UI, or ritual beyond the first prompt.

**The signal to watch — two of them:**
1. Do they come back and **add a second thing, unprompted?** (Re-reading is nostalgia; adding
   is investment.)
2. **What do they add *first*?** The first entry, across users, is the truest tell of what
   Hearthmon is. Skews to projects/objects → you built a *builder's trophy case*; skews to
   people/pets → the *sanctuary* thesis is winning. Different products, different souls.

> After five days of building, the biggest risk isn't a missing feature. It's **defining the
> soul before you've watched what people naturally place near the hearth.** Keep the name a
> placeholder, keep the architecture strict, and let real users tell you what belongs there.

---

*Capture the cathedral. Ship the shelf. When in doubt: smaller, quieter, warmer, rarer.*
