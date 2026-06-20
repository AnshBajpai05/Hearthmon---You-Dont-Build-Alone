# Hearthmon V3 — Thought & Plan

> Status: **exploration, not a committed build.** This is the *thinking* and the *staged plan*
> behind V3 — the "things that shaped you" direction. The **law** lives in
> [HEARTH_SHELF.md](HEARTH_SHELF.md); the **guardrails** in [SOUL.md](../SOUL.md) and
> [EMOTIONAL_SAFETY.md](EMOTIONAL_SAFETY.md). This doc is the *why* and the *order*.
> Captured 2026-06-18.

---

## Where V3 came from (the journey)

It started as "let the companion visually represent the people who matter," and walked itself
somewhere much larger:

1. **Photo → Pokémon sprite** ❌ — uncanny, identity mismatch, months of sprite-fighting; and
   a face is *appearance*, while what matters is *relationship*.
2. **Photo → essence → spirit** — capture who someone *is*, not their face. Better, but an
   abstract spirit risks "that doesn't look like them," and the system must never *decree* an
   archetype.
3. **Recognition → Meaning → Presence** — not rival outputs but a **gradient of trust over
   time.** Recognition is the on-ramp that funds meaning; meaning funds presence. "Feels like
   them" is a t=∞ value you earn; "looks like them" is all you can deliver at t=0.
4. **+ Release** — relationships change; without a way to let go, preservation becomes a
   *haunting*. Living / Archived / Resting / Legacy — but the **transition** (which happens
   when someone is hurting) is the hard part, kept as doctrine only.
5. **Broaden past people** — pets, places, objects, projects, moments, even comfort
   characters. "People Who Matter" → **"Things I Hold Close."** More powerful, more dangerous.

The keystone that fell out: **the shelf is not a feature beside Hearthmon — it is the
foundation underneath it.**

```
the shelf (what shaped you)
   → builder identity (who you became)
      → Hearthmon (the companion at your side)
```

The companion exists *because of* the shelf. That resolves the tonal clash between a playful
desktop pet and a memory vault: the pet is the shelf's *expression*, not its neighbor.

---

## The core bet — and the open question

**Bet:** people will voluntarily preserve the things that shaped them, and a companion built
*on top of that* is deeper than one that merely reacts to commits.

**Open question — do not answer from the armchair:** is this a **sanctuary** (people, pets,
loss) or a **builder's trophy case** (projects, objects, milestones)? Those are different
products with different souls. The *first thing people place on the shelf* answers it. Until
then, "Hearth Shelf" stays a placeholder and the soul stays undefined on purpose.

---

## The plan — staged, each stage gated by the one before

**Stage 0 — Doctrine + Discovery (in progress, 2026-06-18).** [HEARTH_SHELF.md](HEARTH_SHELF.md) +
this doc, plus the **V3 research phase** in [v3_research/](v3_research/) — core entity, meaning graphs,
memory rituals, emotional safety, presence models, open questions, and an annotated sources/influences
list (continuing-bonds grief theory, Winnicott's transitional objects, the Bhagavad Gita on
non-attachment, *mono no aware* / kintsugi, StoryCorps, griefbot ethics). **No code.** Runs *in
parallel with V2 validation*: V2 collects reality while V3 matures on paper. Any V3 code is decided
*only* after V2 has real feedback **and** this doctrine is crystal clear.

**Stage 1 — The Shelf (v0.1).** Add a thing → *why it matters* (choose a door) → store → export.
No AI, portraits, spirits, presence. *(Full spec in HEARTH_SHELF.md.)*
- **Gate to continue:** users add a **second** entry, unprompted, weeks later — and the
  first-entry category distribution begins telling you what this is.
- **If it fails:** you learned the soul isn't there *before* building the cathedral. Cheap, and
  the most valuable thing you could learn.

**Stage 2 — The page per entry.** Gentle additional prompts, the scrapbook/page view, dates,
optional voice notes/photos. Still no generation. Only if Stage 1's gate is green.

**Stage 3 — Recognition (the Hearth Portrait).** A warm, *own-style* portrait — **not** literal
Ghibli (brand + anti-AI landmine). User confirms; system never decrees. Generated once, stored
forever.

**Stage 4 — Presence (the spirit).** A *symbolic* companion the user **picks** from a small set
the traits merely *rank*. Presence models: living = present/reactive; mentor = at crossroads;
passed = rare, encountered, never summoned. Pull-first for anything heavy.

**Stage 5 — Release.** Living / Archived / Resting / Legacy — reversible, never deletes, Legacy
ideally *emergent* not declared. Design the **transition** last and most carefully; it's a
human problem, not a UI one.

---

## Risk register (what kills this)

| Risk | Guard |
|---|---|
| Becomes Favorites / Bookmarks / a junk drawer | Ask *why*, never *what*; the belonging test; scarcity |
| Soul defined prematurely | Don't name or commit the philosophy until the first-entry distribution speaks |
| Data loss = **betrayal**, not annoyance | Export/backup/migration/corruption-recovery before any beautiful layer |
| A heavy memory surfaces at the wrong moment | Pull-first for anything deep; the system never guesses the user's state |
| Sanctuary tone vs. the playful pet collide | The shelf is the *foundation*; the pet is its *expression*, not a neighbor |
| Ghibli brand / consent for the deceased | Own-style portraits; deceased entries never auto-generate, deeply opt-in |

---

## What NOT to build yet

Portraits · spirits · generation · AI · presence · archetypes · anniversaries · reminders ·
release UI · category gating · **intent lenses** (a later, *observed* lean toward people /
projects / comfort — must never appear before several entries exist, or it poisons the
first-entry signal). All captured above so they aren't lost — none ship until their stage's
gate is green.

---

*Capture the cathedral. Ship the shelf.*
