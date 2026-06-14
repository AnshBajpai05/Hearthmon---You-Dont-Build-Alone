# Hearthmon V2 — Motion & Render Architecture (LOCKED)

> V1 shipped on `main`: a world-class **brain** (memory, presence, Builder Context,
> Project Constellation, Chapter Memory) — but the **body still moves like a website**.
> V2 has exactly one mission: **keep the soul, finally give it a body.**
>
> The constraint that decides everything: this must scale to **1025 arbitrary
> PokéAPI sprites**, not a few hand-polished characters. That single fact rules
> out per-character rigging as a foundation.

---

## Dual-renderer architecture (decided 2026-06-14) — one brain, two skins

Classic is NOT replaced. Hearthmon ships **two renderers over one shared brain**:

```
                ┌──────────────── shared brain (KEEP) ────────────────┐
                │ memory · Builder Context · Chapters · drift · quirks │
                │ biomes data · presence · battles · weather · sound   │
                │ interactions (tap/stroke/feed/throw/evolve/attack)   │
                └───────────────┬───────────────────┬─────────────────┘
                                │                   │
                   ClassicRenderer (CSS/Svelte)   AliveRenderer (Pixi)
                   cozy · lightweight · nostalgic  premium · living · immersive
```

- Toggle anytime (key **V**, `render_mode` meta: `classic` | `alive`).
- **STRICT FEATURE PARITY.** Same systems + interactions in both; only presentation differs.
  If one renderer gains a capability, the other must offer the same experience. **No feature drift.**
- **The danger to avoid:** two separate apps. It must stay *one brain, two skins* — the brain
  lives in `+page` + `lib/*`; renderers only draw it and forward interactions back to it.

### Parity checklist (Alive must reach Classic)
- [x] biome by type · pet body · breathing/idle/hop · sleep/happy/calm state
- [x] interaction: tap → `onPetTap`, stroke → `onPetStroke`, empty-space → window drag
- [ ] pet-attached FX: speech bubble · attack beams · Ash throw · evolution flash · visitor · treat · birthday
- [ ] type-specific idles in the mesh (leaf-sway/fire-flicker/…)
- [ ] weather (rain/snow/wind/thunder) in the Pixi scene
- [ ] window scenes / light beam richness to match the Classic biome

## The locked stack

```
Tauri + Svelte + SQLite      ← app shell + ALL V1 systems (KEEP, do not touch the brain)

PixiJS v8                    ← render engine (WebGL: layers, filters, particles, shaders)
custom spring (~30 LOC)      ← motion physics, runs INSIDE the Pixi rAF loop
mesh-warp deformation        ← softness / weight / squash-stretch on the WHOLE sprite
Showdown animated sprites    ← BASE texture only (see caveat) — never the final motion
custom lightweight FSM       ← behavioral motion states (XState only if it earns its weight)
Pixi shader layer            ← rim light, beam, water displacement, soft contact shadow
Verlet physics (environment) ← lantern rope, leaves, particles — NOT body parts

DOM overlay only (stays Svelte/CSS):
  radial menu · panels · chat bubbles · settings
```

### Rejected as foundation (technical fantasy traps)
- **Rive / Spine** — need a hand-authored rig **per character**. Impossible at 1025;
  "any Pokémon" *is* the product. Reserve Rive for a *long-term, optional* curated
  hero set (starters / the user's main) — **never** the base.
- **Motion One / Popmotion** as the body engine — a DOM/WAAPI clock fighting the
  Pixi rAF clock. Once Pixi has a render loop, motion lives there via the custom
  spring. (Motion One may stay for DOM panel transitions only — optional, not the body.)
- **DOM/CSS transforms** for the body — the V1 ceiling we are leaving.

### The scalable premium path (whole-sprite, NO rig)
Skeletal motion on 1025 sprites is impossible cheaply. So:
1. **Mesh-warp deform** — render the sprite as a Pixi mesh and animate *vertices*:
   squash/stretch, anticipation crouch, landing splat, jelly jiggle, breathing as
   non-uniform scale. ~80% of "weight + softness" with **zero per-mon authoring**.
2. **Showdown `ani`/`ani-shiny` sprites** — real frame animation, free, for a large
   chunk of the dex. **Caveat:** many are tiny / low-FPS / inconsistent — use as
   the **base texture**, then layer deform + spring + lighting on top. Static
   fallback + heavier deform for mons without ani sprites.
   `showdown sprite + mesh deform + spring + lighting = premium`.
3. **Pixi shaders** for light — the "this feels expensive" layer, per-scene not per-mon.
4. **Verlet** for environment ambience (lantern rope, leaves, snow depth) — cheap, big.

---

## Phased plan

### Phase 0 — Beachhead (NON-NEGOTIABLE, do this first, alone)
**Goal: prove the pet can live in Pixi without losing interaction quality.**
Build a parity prototype only:
- breathing · slight lean · idle bounce
- **drag · petting hitbox · click reaction** (the hard part)

No sanctuary, no shaders, no FSM, no refactor. If interaction parity fails here,
V2 fails — so it is gated. The pet moves from DOM to Pixi; radial menu + panels
stay DOM overlay anchored over the canvas.

### Phase 1 — Motion language
Once parity holds: spring jump, anticipation, squash/stretch, settle, tiny inertia,
breathing system. Target feeling: **"soft toy with weight,"** not website icon.
The lightweight FSM drives these from the existing V1 context-engine states
(idle / deep_focus / friction / waiting / celebration / quiet_proud …).

### Phase 2 — Environment proof (ONE biome)
**Moonlit Shore** (already the strongest emotionally). Add: lantern flicker, water
reflection shader, parallax moon, moving water, fireflies, responsive contact shadow.
If this feels magical, the whole V2 direction is validated → port the rest of `biomes.ts`.

### Phase 3 — Optional flex (later)
Rive bespoke rigs for a small curated hero set only.

---

## Top risk: interaction migration
Not rendering, not shaders, not motion. Moving petting / drag / hover / radial-menu
anchoring from **DOM hitboxes → Pixi interaction** is the real hard part. That is
why Phase 0 exists and is gated.

## Always-on performance (build in from line 1)
It is a 24/7 widget. Cap DPR, **pause the rAF loop when hidden-to-tray / unfocused**,
throttle when idle. If this is bolted on late, the companion eats battery.

## What does NOT change
Everything in `src/lib/*.ts` (memory, presence, drift, quirks, biomes data, sound,
the Builder Context / Project Constellation / Chapter Memory engines), the SQLite
layer, the Rust watchers, the soul/governance rules. V2 replaces the **render +
motion layer** only.

---

*Architecture locked after a multi-pass ruthless review. Scalability 9.8 · Realism
9.7 · Premium potential 9.4 · Risk moderate (interaction migration). The brain is
done; V2 gives it a body.*
