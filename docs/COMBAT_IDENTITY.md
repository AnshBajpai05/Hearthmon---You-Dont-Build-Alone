# COMBAT_IDENTITY.md — the Pokémon Identity Engine

> Goal: **make every Hearthmon feel like its species**, for all 1025 — without hand-authoring 1025.
> A Charizard must not attack like a Gengar; Charizard's Flamethrower must not look like its Dragon
> Claw. Read [SOUL.md](../SOUL.md) first — the soul gate at the end of this doc overrides everything.
>
> **Status:** v1 (the Attack Director + 8 archetypes + type-flavor + power-intensity + ~20
> signatures) is **shipped in both skins** (`src/lib/fx.ts`, `+page.svelte`, `PixiStage.svelte`,
> `BattleScene.svelte`, green). This doc is the architecture that v1 is the first slice of.

---

## 0. The one principle

**Derive, don't author.** Identity is *computed* from data we already have (typing, stats, Pokédex
text, evolution, signature move). A small **override** table hand-tunes only the iconic few. This is
the same call V2 made for rendering ("any Pokémon is the product"): combinatorics, not bespoke.

```
PokéAPI data ─► Species Identity ─► Move Identity ─► Attack Director ─► { Classic | Alive }
 (build time)     (derived+override)   (archetype map)   (renderer-agnostic)   (presentation only)
```

---

## 1. Full architecture (the layers)

- **L1 Species Identity** — per dex: tempo, scale, power-bias, palette, motifs, signature, stage.
  Derived at build; ~20–50 overrides for iconic species.
- **L2 Move Identity** — every move → one archetype (the taxonomy, §4) + intensity from power.
  Already live in `fx.ts` `animKind` / `attackIntensity`.
- **L3 Attack Director** — pure function `(dex, move, identity) → AttackProfile`. **No renderer code.**
- **L4 Species Flavor** — the profile's `speciesFlavor` modulates the render (scale, palette bias,
  tempo, motif particles) so Charizard-vs-Typhlosion Flamethrower differ.
- **L5 Renderers** — Classic (CSS) and Alive (Pixi) each consume `AttackProfile`. Parity is law.
- **L6 Battle foundation** — same identity + director feed future battles; **simulation (stats→damage)
  stays separate from presentation (identity→FX)**. Clean seam from day one.

---

## 1b. Behavioral Identity — the bigger prize (Idle + Reaction + Temperament)

Attack identity is only one third. The recognition *"this is **my** Charizard"* comes most from how
it behaves when you're **not** attacking:

> **Species Identity = Attack identity + Idle identity + Reaction identity + Temperament.**

- **Reaction identity** *(highest ROI)* — how it answers being poked/irritated, **before** any attack.
  Click it repeatedly:
  - **Charizard** → tail-flame grows · smoke puff · roar · heat shimmer
  - **Gengar** → vanishes · reappears elsewhere · tongue out · shadow laugh
  - **Snorlax** → barely reacts · rolls over · scratches belly · dozes off
  - **Lucario** → battle stance · aura pulse · meditation pose
- **Idle identity** — resting behaviour (Gengar phases in/out, Snorlax heavy breathing, Dragonite
  drifts/flies). Extends the per-type idles already in `Pet.svelte` + the Alive idle loop.
- **Temperament** — *behavioural tendencies* read from **Pokédex flavour text**, not combat: Charizard
  "seeks strong opponents / never harms the weak" → *challenger*; Gardevoir "protects its trainer" →
  *protective*, leans in on low-mood days; Dragonite "kind, guides the lost" → *greets visitors*.
  Temperament colours reactions, visitor behaviour, move choice, and proximity — **never a stat, never a bar.**

All of this reads from the **same L1 identity** (no new data source). Reaction beats are a small,
soul-safe vocabulary keyed by motif + temperament — **rare and gentle** (SOUL: small moments,
never spammy; a poked pet is a delight, not a slot machine).

---

## 2. Data schema

```ts
// Generated at build from PokéAPI CSVs (like pokedex.ts / movesets.ts / stats.ts). NEVER hand-edited;
// regenerate via the existing PowerShell pipeline. A tiny *overrides* file is the only hand layer.
interface SpeciesIdentity {
  dex: number;
  tempo: number;        // 0..1 from Speed → wind-up / recovery speed (Snorlax slow, Jolteon snappy)
  scale: number;        // 0..1 from height+weight → FX size + impact weight
  power: number;        // 0..1 from max(Atk, SpAtk) → base intensity bias
  bias: "phys" | "spec" | "bal"; // Atk vs SpAtk lean → melee vs ranged tendency
  palette: [number, number];     // primary/secondary type colours (hex ints)
  motifs: string[];     // derived tags: "infernal","aerial","ghostly","heavy","regal","aquatic"...
  signature: string;    // iconic/strongest move name (showcase + battle AI)
  temperament: string[];// behavioural tendencies from Pokédex text: "challenger","protective","aloof","playful","sleepy","loyal"
  stage: 1 | 2 | 3;     // evolution stage → maturity / size
}

type AnimKind =         // the archetype taxonomy (§4) — the only thing renderers switch on
  | "breath" | "projectile" | "claw" | "dash" | "bite" | "burst" | "beam" | "status" /* …expand to ≤40 */;

interface AttackProfile {        // L3 output — renderer-agnostic, the ONLY contract a skin sees
  archetype: AnimKind;
  intensity: number;             // 0..1 = move power × species power bias
  typeFlavor: string;            // move type → palette + particle motif
  speciesFlavor: string | null;  // dex tag → per-species render tweaks (palette/scale/tempo/motif)
  signature: boolean;            // famous move → extra flair
}
```

---

## 3. Species Identity system (how derivation works)

All heuristic, all from existing tables; tunable constants, not magic:

- **tempo** = `clamp(Speed / 160)` → drives wind-up + recovery duration (heavy mons telegraph).
- **scale** = normalized `log(weight) + height` → FX size, impact shake, "weight" of motion.
- **power / bias** = `max(Atk,SpAtk)/180`; `Atk − SpAtk` sign (with a margin) → phys/spec/bal.
- **palette** = `TYPE_FX[type1], TYPE_FX[type2]`.
- **motifs** = type tags + a **Pokédex keyword scan** (`wings/flies → aerial`, `melts/heat/blaze →
  infernal`, `lurk/shadow/night → ghostly`, `heavy/sleeps → heavy`, legendary flag → `regal`) +
  evolution stage. ~12 motif tags cover expression without per-mon work.
- **signature** = strongest damaging move (or a curated pick in the override table).
- **temperament** = Pokédex-text tendencies (`seeks strong/rival → challenger`, `protects its trainer
  → protective`, `gentle/guides/helps the lost → loyal`, `sleeps/lazy → sleepy`, `prank/mischief →
  playful`, `solitary/proud → aloof`). Behaviour only — drives reactions / visitors / move-choice, **never a stat.**

**Overrides** (`combat_overrides.ts`, the only hand-edited file): ~20–50 iconic species get tuned
motifs / signature / palette bias / a `speciesFlavor` key. Everyone else is fully derived. This is
where "quality budget" goes (Charizard, Gengar, Lucario, Gardevoir, Greninja, Mewtwo, Snorlax, …).

---

## 4. Move archetype taxonomy (target ≤ 40; v1 ships 8)

One archetype = one **motion grammar**, type-flavored + intensity-scaled. Map ALL moves into these.

| Group | Archetypes |
|---|---|
| **Melee** | claw/slash, bite/fang, punch, kick/stomp, **dash**-tackle, throw/grab, whip/vine |
| **Ranged** | **beam**, **breath**-cone, **projectile**-orb, bolt/strike, multishot, wave/pulse, blade-gust (flying) |
| **Area** | **burst**/quake, eruption, field/weather, explosion |
| **Self** | **status** buff-dance, guard, heal-glow, transform |
| **Ultimate** | charge → eruption/beam (Blast Burn / Hyper Beam tier) |

**v1 implemented:** breath, projectile, claw, dash, bite, burst, beam, status (the 6 you chose +
beam + status). The rest are additive — the director already falls back cleanly, so adding an
archetype is: 1 mapping rule + 1 Classic CSS block + 1 Pixi block. **Cap at ~40** — past that the
marginal distinctiveness isn't worth the maintenance.

---

## 5. Director design

```ts
// renderer-agnostic, pure, testable. Lives in fx.ts (v1) → grows into combat/director.ts.
function attackProfile(dex: number, move: Move, id: SpeciesIdentity): AttackProfile {
  const archetype = animKind(move);                     // signature → pattern → type×class (live)
  const intensity = clamp(attackIntensity(move) * (0.7 + id.power * 0.5));
  return {
    archetype,
    intensity,
    typeFlavor: move.type,
    speciesFlavor: id.signature && isSignatureMove(move) ? `dex:${dex}` : id.motifs[0] ?? null,
    signature: isSignatureMove(move)
  };
}
```

Today `+page` calls `animKind` + `attackIntensity` directly (v1). The L1/L4 fields slot in behind
the same call site with **zero renderer churn** — that's the point of the contract.

---

## 6. Rendering integration

- Both skins switch **only** on `profile.archetype`, tint by `typeFlavor` (palette), scale by
  `intensity`, and apply `speciesFlavor` tweaks (palette bias / extra motif particles / tempo).
- **Parity is law** (the discipline that got V2 here): an archetype lands in Classic **and** Alive in
  the same change, or it doesn't land. The director guarantees both read identical inputs.
- Classic = CSS keyframes per archetype (`var(--atkcolor)`, `var(--atkpow)`); Alive = Pixi
  Graphics/Text per archetype (`atkColor`, `atkIntensity`). Both already wired in v1.

---

## 7. Storage strategy for 1025

- **Build-time generation.** `SpeciesIdentity[1025]` is derived once from the PokéAPI CSVs and emitted
  as a compact generated `combat_identity.ts` (numbers + short tag arrays — a few hundred KB, tree-shakeable),
  exactly like `pokedex.ts` / `movesets.ts` / `stats.ts`. **No runtime network, no scraping.**
  pokemondb is a *human* reference for how moves should feel, never a data source.
- **Overrides** layered at generation: `combat_overrides.ts` (hand) merges over the derived table.
- **Forms (Mega/regional/Gigantamax)** = additional identity rows keyed by a form id; deferred (§9/§10).
- 100% local — consistent with the privacy moat. Nothing about combat phones home.

---

## 8. Incremental rollout

- **v1 — DONE (both skins, green):** Attack Director + 8 archetypes + type-flavor + power-intensity +
  ~20 signatures. *Proves attack feel.*
- **v2 — Species Identity Table (L1):** generate `combat_identity.ts` for all 1025
  (tempo/scale/power/bias/palette/motifs/**temperament**/signature/stage). Wire tempo→durations,
  scale→size/shake, power→intensity. *Snorlax telegraphs; Jolteon snaps.* **The foundation everything below reads from.**
- **v3 — Reaction Identity (HIGHEST ROI):** poking/irritating differs per species **before** any
  attack — Charizard ≠ Gengar ≠ Snorlax ≠ Lucario. A small soul-safe beat vocabulary keyed by
  motif + temperament; **absorbs idle identity**. *This is where "my Charizard" begins.*
- **v4 — Species Flavor FX (L4):** `speciesFlavor` render hooks (palette bias, motif particles) + the
  ~20–50 overrides. *Charizard vs Typhlosion vs Reshiram Flamethrower diverge.* (Taxonomy can expand
  8 → ~24 alongside.)
- **v5 — Battle:** wild/trainer/boss/legendary reuse the director for visuals and identity/temperament
  for AI; **simulation reads `stats.ts`, presentation reads identity** — never entangled.

Each phase is independently shippable, parity-checked, both-skins-green before the next.

---

## 9. Risks

- **Scope explosion** → *mitigate:* derive + ~40-archetype cap + small override set. The #1 risk.
- **Uneven quality across skins** → *mitigate:* parity law + the renderer-agnostic director.
- **Derived identity feels generic** → *mitigate:* overrides for the iconic; motif keyword scan adds
  texture; signatures carry the "wow."
- **Performance** (Pixi already does ~5k sprites/frame, see existing_issues §8.4) → *mitigate:* FX are
  short-lived + intensity-capped; keep per-attack draw bounded; reduced-motion respected.
- **Maintenance drift** → *mitigate:* generated table is regenerated from data, never hand-edited
  (only `combat_overrides.ts` is hand).
- **Soul drift toward a battler** → *mitigate:* §10.

---

## 10. What NOT to build

- ❌ **1025 bespoke animations / per-move hand-authoring.** The whole point is derivation.
- ❌ **A combat/stats/EV/IV UI** that turns the companion into a battle game. Hearthmon is a
  *companion*; "poke it and it does a cute, characterful move" is a **delight**, not a game loop.
  (SOUL: presence > conversation; rare magic > constant stimulation.)
- ❌ **Frequent/spammy attacks.** Attacks stay an occasional reaction to being poked/irritated, not a
  spammed ability bar. Keep cooldowns.
- ❌ **Runtime scraping of pokemondb** (or any site). Reference only; data is local + generated.
- ❌ **A full battle simulation before the identity foundation exists.** Identity first; battle reuses it.
- ❌ **Mega / regional / Gigantamax forms in early phases.** Base 1025 first; forms are additive rows later.
- ❌ **Letting presentation and simulation entangle.** Keep `stats → damage` and `identity → FX` apart.

---

*The leap here isn't "cooler particles." It's that a user looks at their companion and thinks "this
isn't a generic fire pet — this is **my** Charizard." That recognition is the same attachment engine
as the rest of Hearthmon: it pays off at month six, not day one.*
