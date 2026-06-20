# 02 — The Meaning Graph

> **Central question: are entries isolated cards, or a graph of the things that shaped you?**

## The idea

```
Dad
 ├─ First Laptop      (he bought it)
 ├─ First Internship  (he drove me there)
 ├─ Graduation        (he cried)
 └─ Hearthmon         (built at his old desk)
```

The shelf stops being a list of cards and becomes **a graph of what shaped you** — and the graph
can *reveal* something the cards can't: that everything traces back to one person, one place, one loss.

## Refinement — constellations, not folders; scenes, not cards (2026-06-18)

Two upgrades to this frame:

- **Scenes, not cards.** Memory doesn't store "Person #1 + Location #4." It stores a *scene*:
  *"Saturday mornings watching Pokémon with my brother at grandma's house."* People, a place, a
  show, a feeling — one moment. So the real unit may be a **scene that holds several entities**,
  not an isolated card. (Feeds [01](01_core_entity.md): is the atom an entity or a scene?)
- **Constellations, not "spaces"/folders.** Do **not** call these spaces — *space* implies *folder*,
  folders invite *organizing*, organizing becomes *administration*, and administration kills the
  magic. Instead: entities that **repeatedly appear together** gradually form a *constellation* —
  emergent, never authored. (The word also surfaced independently as a *Presence* candidate in
  [05](05_presence_models.md) — a quiet sign it's resonant. Still a placeholder; don't lock it.)

**The principle underneath both (this corrects an earlier mistake):** structure must be
**meaning-derived, never category-derived.** "A Naruto room next to a Family room" is wrong *as a
rule* — but not because Naruto is trivial. For someone, Naruto is *"the thing that got me through
depression."* You can never decide at the **category** level whether something is sacred; only the
*why* knows. That is the exact reason category-grouping (folders/spaces) fails and constellations
(meaning-grouping) is right. The belonging test in [HEARTH_SHELF](../HEARTH_SHELF.md) already said
it — *no banned categories, only a banned reason.*

## The hard part — how a constellation forms *without lying*

If users place one thing at a time (slowly, scarcely), what makes things "appear together"? Either
the user links them, or the system *infers* connection from text/time — and a **wrong** inference is
an emotional injury (*"Dad and your ex are part of the same story"* — no). So constellations inherit
the SOUL rule: **high-confidence only; when unsure, stay silent; let the user confirm or dissolve.**
A constellation is *offered and confirmed*, never *asserted*. And scenes likely **crystallize** from
placed things — *you don't author them* (see [01](01_core_entity.md)).

## The risk (seed this tension loudly)

A graph can become **a junk drawer with edges.** "Everything connects to everything" *dilutes*
scarcity and re-introduces the database/collection feeling the doctrine exists to prevent. Connection
must **deepen** meaning, not **inflate** it. A web of 200 lightly-linked nodes is not a sanctuary.

## Design stance to test

- **Reveal, don't require.** Links should be *noticed and offered* ("these three all trace back to
  Dad — connect them?"), never a mandatory linking chore. Forced linking = admin, not meaning.
- **Does the graph ever surface, or stay quiet substrate?** It may be more powerful as something the
  Hearth *quietly knows* than as a visible node-graph UI (which screams "tool," not "hearth").

## Open questions

- Directed or undirected edges? Typed edges (*taught-me*, *given-by*, *happened-at*, *reminds-me-of*)?
- Does a connection ever *increase* an entry's weight/presence, or is that gameable?
- Is the graph for the *user* (meaning) or just *clever* (engineering vanity)? Kill it if it's the latter.

## Sources

Memory studies on associative recall; Zettelkasten (links as thinking) **and its failure mode**
(link-hoarding); knowledge-graph UX cautionary tales. See [07](07_sources_and_influences.md).
