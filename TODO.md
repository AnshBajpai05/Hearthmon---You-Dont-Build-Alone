# Hearthmon — TODO & Backlog
> Compared against `docs/VISION.txt` (the full 3-part product soul document) and the current codebase.  
> Priority: **P1** = missing soul-critical | **P2** = strong 10x feature | **P3** = moonshot / nice-to-have | **💡** = brainstormed addition not in doc

---

## 🚀 V2 — Premium Body (branch `v2`, started 2026-06-14)
> V1 is sealed on `main` (world-class brain, but the body "moves like a website"). V2 mission: **keep the soul, give it a body**. **Decided 2026-06-14: keep BOTH renderers — one shared brain, two skins** (`ClassicRenderer` CSS · `AliveRenderer` Pixi), STRICT feature parity, never two apps. Architecture LOCKED in `docs/V2-PLAN.md`.

- [x] **V2 architecture locked** ✅ 2026-06-14 — `docs/V2-PLAN.md`: PixiJS v8 render core + custom spring + **whole-sprite mesh-warp** (scales to all 1025, no rig) + Showdown sprites as BASE texture + lightweight FSM + shader lighting + Verlet (environment only). **Rejected as foundation:** Rive/Spine (per-character rig, impossible at 1025) and Motion One/Popmotion (DOM clock vs. the Pixi rAF clock). Keep all `lib/*.ts` brain + SQLite + Rust watchers untouched.
- [x] **Phase 0 — Pixi interaction-parity beachhead** ✅ 2026-06-14 (gated, non-negotiable) — isolated `/pixi` sandbox + `PixiPet.svelte` + `lib/pixi/spring.ts` (critically-damped spring). Pet lives in Pixi with breathing · cursor-lean · idle hop · **weighted drag** (lags cursor + overshoot settle) · petting (rising hearts) · tap-hop. rAF loop pauses when the tab is hidden (always-on hygiene). Proves the riskiest migration (drag/petting/tap hit-testing DOM→Pixi). View: `localhost:1420/pixi`.
- [x] **Phase 1 — mesh-warp motion language** ✅ 2026-06-14 — `PixiPet` upgraded Sprite→**MeshPlane** (7×8); per-vertex deform each frame: squash/stretch anchored at the feet, jelly belly bulge, decaying jiggle (on land/tap/release), lean shear → "soft toy with weight," no rig. Contact shadow reacts to squash + hop height; tiny idle/drag/pet state seed.
- [x] **Phase 2 — environment proof (Moonlit Shore)** ✅ 2026-06-14 — layered Pixi scene: gradient sky/sea, parallax glowing moon, shimmering moon-reflection, rolling waves, drifting fireflies, lantern flicker. Validated → ported the rest.
- [x] **Data-driven biomes** ✅ 2026-06-14 — scene derived from `biomeForType(curType)`: sky/ground gradients (wall/floor), light orb tinted by `biome.light`, water-only waves+reflection, particles by kind (firefly/ember/snow/star/spark/pollen/dust/mist). Every type → its biome.
- [x] **Unified PixiStage** ✅ 2026-06-14 — `PixiStage.svelte`: ONE Pixi Application holds the biome scene + the mesh-warp pet in one ticker (replaced the two stacked sandbox canvases). `PixiPet.svelte`/`MoonlitShore.svelte` retired. Sprite loaded via `<img>`+`Texture.from` (Showdown sprites are `.gif` → Pixi `Assets.load` returns null); mesh deform guarded with a scale-only fallback; init errors surface on-screen.

### Dual renderer — Classic + Alive (one brain, two skins)
- [x] **Renderer toggle** ✅ 2026-06-14 — `render_mode` meta (`classic`|`alive`), key **V**. Classic = CSS `.stage`; Alive = `PixiStage` overlay. Both draw the same `+page` brain.
- [x] **Interaction parity** ✅ 2026-06-14 — Alive bridges to the shared brain: tap → `onPetTap`, stroke → `onPetStroke`, empty-space press → window-drag (`beginWindowDrag`). Pixi layer `z-index:1` so radial/panels stay clickable.
- [x] **Brain → Pixi state** ✅ 2026-06-14 — `petState`/`calm` props: sleeping (dim + slower breath + zzz, no hops), happy (joyful hop), comfort/flow (settles).
- [x] **Background parity** ✅ 2026-06-14 — transparent canvas (no longer blocks the desktop), backdrop cycle **orb/square/ground/off** (square added to Classic too), respects the opacity slider, pet centered when no biome (low/standing when full habitat on).
- [x] **Habitat shape (decoupled from backdrop)** ✅ 2026-06-14 — 🏞️ cycles **none → full → sphere → square** (its own shape); 🌿 backdrop stays the pet pad. Alive renders the biome into a **viewport** so the FULL vista lives inside the sphere/square (snow-globe, pet on the shoreline) — not a clipped slice. Mask is a child of `scene` (fixed a stray white square). Classic mirrors via `roombg` radius. `room="on"` migrates to `"full"`.
- [x] **Alive parity — COMPLETE** ✅ — pet-attached FX all bridged via `fx={aliveFx}`: speech bubble · attack beams/bolts/orbs/slash/aura + sparks + move callout · Ash throw ceremony (recall→ball→gap→throw→release burst, bundled `static/ash.png` for CORS-safe WebGL) · evolution white-pulse + glow · wild visitor walk-through · treat chomp · birthday hat. Type-specific mesh idles (grass/bug+water/ice sway · fire flicker · ghost/psychic/flying/dragon/fairy float-bob · electric jitter) + facing-flip by `dir`. Weather = shared `WeatherFx` DOM overlay (z-index:4 > pixilayer 1) → renders in both skins.
- [x] **Live GIF playback in Pixi** ✅ — `Texture.from` froze the pet to frame 0; now `ImageDecoder` (WebCodecs) decodes the Showdown GIF frames and cycles them onto the mesh's canvas texture, UNDER the deform — native body motion (flames/limbs/tail) restored, matching Classic. Static fallback if WebCodecs is unavailable.
- [x] **In-place reload (no remount hitch)** ✅ — dropped the `{#key dexId}`; `reloadPet()`/`applyBiome()` reload the pet + biome inside the LIVE Application on dexId/shiny change (the tick detects it). Switch/evolve/shiny no longer flash or re-init WebGL. Also: pet re-anchors home each idle frame (auto-aligns after drag/resize), live `size`, fresh deform buffer per reload.
- [x] **Animated README card** ✅ — `spriteSheetDataUri()` bakes GIF frames into one PNG strip (sampled ≤24 / ≤~2400px for perf); the card plays it via a CSS `steps()` animation + `<clipPath>` (runs in an `<img>`-loaded SVG on GitHub). Float/jump amplitude halved for calm.
- [x] **Cinematic Depth & Environmental Coupling** ✅ 2026-06-14 — The environment physically *reacts* to the pet. Extracted the true sine-wave `petBreath` to pulse global room warmth. Created a smoothed `petEnergy` parameter with momentum so room flares surge on a happy hop and slowly settle (inertia). Added a 5-12% opacity volumetric `hazeG` layer behind the pet for cinematic air thickness, and a deeply-feathered `vignetteG` inner stroke to blur the hard snow-globe boundary into a soft, dreamy fade. Implemented micro-variations in the fire and responsive shadow grounding.
- [ ] **Optional polish (NOT a parity gap):** global cursor-follow lean anywhere on screen · (aspirational stack, only if earned) Pixi shader lighting · formal XState FSM.
- [ ] **Phase 3 — optional flex** — Rive bespoke rigs for a small curated hero set only.

### README living-card — V2 polish ✅ 2026-06-14
- [x] **Product-forward redesign** — reframed from "named companion + RPG badges" to the PRODUCT with a curiosity gap: title **Hearthmon**, a live **companion thought** bubble (Layer 1), the **money line** as identity (Layer 2), **narrative aliveness chips** (Layer 3), a soft **CTA "see what it noticed →"** (Layer 4). Content rotates card-to-card. Card 480×172→188.
- [x] **Composition tuning** — companion sprite +15% (commands the left), intimate thought-bubble with a long soft tail, **commit count removed** from the footer (relationship, not dashboard). Footer layout refactored into a right-anchored cohesive emotional pair ("keeping watch · quietly becoming real"), removing arrows and generic CTAs for maximum premium/cozy feel. Typography of the identity line increased 15% to breathe.
- [x] **One-artifact fix (atomic updates)** — the README text block (Current Companion/Mood/Status) raced ahead of the camo-cached SVG → mismatch. Fix: the card is now a **single image**; the **species name is baked into the SVG footer**, and the README text block is removed → name + art always refresh **together** (delay OK, desync gone).
- [x] **`push_card` resilience** — fetches + rebases `--autostash` onto `origin/<branch>` before the amend + `--force-with-lease`, so a README edited on github.com can no longer reject the push as "stale info" (and the remote edit is preserved, not clobbered).
- [x] **Voice: name-call clips 0.8×** — `playClip` gained a `rate` param; `voiceCry` plays the `<species>.mp3` name calls slower; `go-` throw clips + SFX stay 1×.

### Sanctuary art-direction — galaxy + biome colour (2026-06-16)
> Start of the `15_jun.md` **V1 Polish Day → Art Direction** pass, on the Alive renderer's cosmos/observatory corner. (Day-15 itself went to the security/chapter gate, so the polish plan slipped to here.)
- [x] **Cosmos galaxy bowl rebuilt** ✅ 2026-06-16 — `PixiStage` `drawGalaxy`: the lower-sphere star field reshaped into a wide **vessel / boat-hull** curve (side tips arc above the front rim; `x=cos·r·1.25`, `y=(1−r²)·BD − r²·RISE·cos²`), rotating in place each tick. Stars are ~1px sub-pixel particles.
- [x] **Fixed the "semicircle" artifact** ✅ 2026-06-16 — the star radius exponent was backwards (`pow(rnd,0.45)` piled stars onto the rim → a bright ring); flipped to `1.4` (dense centre, soft edge). Also dropped the 4 flat nebula-haze circles whose crisp edges showed as arcs. Now "just stars" + core glow.
- [x] **Whole palette keyed to pet type (HSL)** ✅ 2026-06-16 — added `toHsl`/`hsl` helpers; nebula, stars and core glow all derive from `lightCol`'s hue (fire→warm reds/golds, water→blue/teal, psychic→purple/pink) so nothing clashes. White highlights preserved.
- [x] **Star brightness boost** ✅ 2026-06-16 — lifted alpha floors (dim 0.55→0.65, bright 0.80→0.85) + sizes for a more visible field.
- [x] **Biome globe↔ground colour harmony** ✅ 2026-06-16 — `lib/biomes.ts`: audited all 10 biomes by hue; **hearth** (normal/fighting) fixed from a purple globe over a brown floor → warm wood + lantern gold (matches its light); **neon** (electric/steel) from flat muddy blue → deep indigo sky + cool-steel floor. Other 8 verified already coherent; **water (Moonlit Shore) untouched** (gold standard). Saved the wall/floor/light-share-one-hue rule to memory. *(Committed + pushed to `origin/v2`, `144272c`.)*
- [x] **`existing_issues.md` audit** ✅ 2026-06-16 — architecture & vulnerability audit doc (16 code-verified findings + severity/fix-priority matrix): OOM via unbounded `read_to_end`, auto-push `--force-with-lease` defeated by the preceding `fetch` (data loss), permanent future-clock lockout, missing SQLite indexes, card-amend self-triggering the commit watcher, watchers never pausing when hidden, etc.
- [x] **Audit beta-blockers fixed (5)** ✅ 2026-06-16 — both builds green (cargo check + svelte-check): (1) log-watcher **OOM** → `read_from` 1 MiB `take` cap + tail; (2) auto-push **`--force-with-lease` defeated by `fetch`** → bail on rebase conflict + lease pinned to the integrated SHA; (3) **watchers polling while hidden-to-tray** → managed `Visible` flag gates git/log/repo/focus loops + drops the audio stream; (4) **card commit self-triggering** the watcher → shared `CARD_COMMIT_MSG`, `parse_commit` ignores it; (5) **SQLite locking** → `WAL` + `busy_timeout=3000` in `getDb`.
- [x] **Audit FULLY closed** ✅ 2026-06-17 — all remaining `existing_issues.md` items fixed across two passes (both gates green): **§5** future-clock lockout (`clamp_clock` + `CLOCK_JUMP_TOLERANCE_DAYS`), **§1** Admin Drop (`ACCESS_DENIED`→hold category) + **§7.4** path buffer grow, **§3** worktree `gitdir:` resolve + monorepo poll backoff, **§4** audio device-invalidation rebuild + AGC decay, **§6** SQLite `(kind,created_at)`/`(mood,created_at)` indexes, **§7.5** log-type filter, **§7.6** DST-safe pass-expiry, **§7.7** `randomPick` (no `ORDER BY RANDOM()`), **§7.9** atomic `bumpCounter`. Documented keeps: §6 localtime basis, §2-secondary NTFS mtime lag, §7.10 `gpu_stat`. Also: murmur cadence 0.18→0.30 ("speaking too little"); auto-close mitigated by pausing the Pixi rAF on tray-hide (`hm-visible`), root cause unconfirmed.
- [ ] **Remaining Art Direction pass:** layer foreground/mid/background + atmosphere on every biome (electric ground done, see below); push **Moonlit Shore** to screenshot-worthy. Then the two CRITICAL `15_jun.md` passes still untouched: **Writing/Dialogue** (`lib/lines.ts`) and **Interaction smoothness**.

### Alive ground rework — energized orbital plane + electric harmony ✅ 2026-06-17
> The globe was "perfect", but the ground read as a flat washed pad. Reworked the floor under the snow-globe.
- [x] **Galaxy decoupled from backdrop** — the nebula starfield is part of the GLOBE now (not the `ground` bg toggle), so turning the backdrop off no longer empties the sphere.
- [x] **Energy Ring Ecosystem** — replaced a (rejected) reflection pool with ~1500 type-tinted stars orbiting the base in 7 concentric elliptic rings (front bright, back fades behind the globe); batched sprites, pauses with the rAF when hidden.
- [x] **Chain lightning** — long multi-hop (5–8) zig-zag bolts traveling around the ring, 3-pass stroke (colour glow → mid → white-hot core). Ambient ~30s (electric livelier ~12–21s, others ~26–42s).
- [x] **Music-drop gating** — the per-globe-strike ground reaction was removed (too busy in electric). A SUPER ground reaction is reserved for a real MUSIC drop only (strong bass beat + sustained `audioEnergy` + 16–26s cooldown) so casual YouTube-video audio no longer triggers it.
- [x] **Level scaling** — `petPower` (species base-stat total) scales bolt size/thickness/brightness/lifetime: small mon = small bolts, legendary = big.
- [x] **Electric colour harmony** — kept the deep-indigo globe, moved the energy cyan `#7fd9ff` → white-gold `#fff4b5` (rim/groundColor warm, sparks vivid yellow; `strokeBolt` glow follows `lightCol`). "Indigo storm sky + white-gold lightning." Deliberate complementary exception (documented in memory); other 9 biomes left as-is.
- [x] **Legendary multi-strike event** — the rare electric `superstrike` (2–3 globe bolts at once + near-white flash) now also fires a 3–5 chain GROUND barrage + a hard full-field flash, scaled by `petPower`. The screenshot moment.

### Phase 3 features ✅ 2026-06-17
- [x] **Starter roster** — first-meeting six set to Squirtle · Charmander · Bulbasaur · Pikachu · Abra · Gastly (`lib/sprites.ts`). Full dex still reachable via Switch.
- [x] **User birthday** — optional birthday step in `FirstMeeting` (stored `user_birthday`, editable in the new reminders panel); once-a-year celebration (party hat + fireworks + `userBirthdayLines`), separate from the pet "day-we-met" anniversary; both set `hadAnniversary` so specials never stack.
- [x] **Quiet reminders** — new `QuietReminders.svelte` panel via radial **Care → ⏰ Reminders**; text + time + daily/once, stored as JSON in meta; `reminderTick` (30s) surfaces a gentle bubble at the set time and brings the widget on top from the tray (Rust `surface_window`, no focus-steal). A nudge, never an alarm; fires only while running.
- [x] **Memory anniversaries** — `anniversaryEvents()` surfaces "this is around when we started X" for chapter/seed memories ~a year+ old, once a day, never stacked. (`memoryAnniversaryLine`.)

### Combat Identity v2→v4 + Mega Evolution ✅ 2026-06-20
> Pokémon Identity Engine deepened — **derive, don't author** across all 1025 (`docs/COMBAT_IDENTITY.md`). Both skins green.
- [x] **v2 Species Identity + v3 Reaction Identity + Drift** — build-time `combat_identity.ts` (tempo/scale/power/temperament/motifs via `tools/gen_combat_identity.ps1`), `combat/identity.ts` `speciesIdentity()`, per-species reaction beats on poke/irritate (`combat/reactions.ts`), temperament drift.
- [x] **v4 archetypes 8→26** — `fx.ts` = `AnimFamily` (8 render branches) × `AnimKind` (26 kinds) × `VARIANT` params; richer `animKind` (signature + patterns). All 3 consumers (+page Classic, PixiStage Alive, BattleScene) switch on `FAMILY[kind]` (atomic-safe). Alive sub-dispatches per kind: breath flame/spray/wind/gas · beam thick/thin/sky-strike · burst quake/nova/wave/storm · claw rake/blade/multi-slash · bite chomp/throw · dash quick/heavy-slam/blitz · projectile orb-lob/fast-shot/multi-shot/bomb · status buff/guard/heal. Classic parity via `data-akind` + `--atk-spread/len/alpha/speed` vars + shape overrides.
- [x] **v4 per-species overrides** — `combat_overrides.ts` (`MOVE_OVERRIDES[dex][move]→kind`), merged into `animKind(move, dexId?)` FIRST; ~14 iconic seeded (Charizard blast-burn→nova, Blastoise hydro-cannon→thick-beam, …) + generic punch/kick→heavy-slam.
- [x] **Mega/special forms → PokeAPI form-IDs** — sprites switched Showdown-name → **form-IDs** on githubusercontent (CORS → animated in Alive, not just static); verified all **51 forms** (gif + shiny + png) 200 vs `pokemon.csv`. `formFallbackUrl(formId)` = form-aware static fallback (never silently drops to the base form).
- [x] **Mega FX deepened** — flat ellipse aura → **fire** (rising tongues + hot core + embers, additive); **`FORM_FLAME`** single colour source (fire orange · dragon = Charizard X blue) drives aura + room atmosphere + **attacks + irritate beats** (blue-X throws blue fire); mega **dictates the room** like a hearth mon (PixiStage mega ambient branch) + **hover stokes it** (`hoverE`); flamethrower breath = 4-layer gradient.
- [ ] **v5 — battle** (sim reads stats, presentation reads identity — NEVER entangled). Next.

### Audio Awareness → YAMNet speech/music vote ✅ 2026-06-20
> The companion reacts to music *at the right moments*. Heuristics provably can't separate speech from music (blind A/B: `voiceish ~0.32` for both), so this adds the real classifier — as a VOTE in the Moment Engine, not a rewrite.
- [x] **Freeze bug fixed** — the orb kept "reacting" while everything was paused (WASAPI stops delivering callbacks → every derived audio value froze at its last reading, `musical=1.00`). Added a JS staleness watchdog (no frames for 800ms → reset to rest) + a Rust silence gate (sub-‑60dBFS emits zeros so the AGC stops amplifying paused-video hiss into "loud").
- [x] **YAMNet audio-class vote (SOTA, pure-Rust)** — exported canonical YAMNet's MobileNet core to ONNX (`tools/yamnet_export/`), hand-wrote the log-mel front-end in Rust (`src-tauri/src/audio_class.rs`), runs via `tract` (no native DLL; raw audio never leaves the process — same soul rule as the loopback bands). Validated raw-waveform→scores against TensorFlow to **1.2e-5**; in-tree regression test `tests/yamnet_smoke.rs`. The classifier thread (`spawn_audio_classifier`) buffers loopback samples → resamples to 16kHz → classifies ~1.4×/s → emits `audio-class (music, speech)` → `momentScore` adds `(music − speech) × 0.6` as the strong vote (`audio_moment.ts`). Model loads LAZILY on first opt-in (privacy off-by-default).
- [x] **Dev HUD** — `🎶/🗣️ mus/spch` readout bottom-center; quickbar **🎶** toggle (persisted, dev-only); auto-hides while hovering so it never overlaps the quick tray / transparency slider / radial menu.
- [ ] **Later polish (not blocking):** quantize model fp32 15MB → int8 ~4MB; broaden `music_prob` from the single `Music` class to the 75-class music family if real music ever under-reads.

---

## ✅ Already Shipped
Everything below is **live** in the current build:

- [x] **First Meeting ceremony** — one question seed, companion chosen, first memory stored
- [x] **Presence system** — silent wander, sleeping, greetings, long-session + late-night lines
- [x] **Mood check-in** — 6-emoji, optional note, `moodResponses` bank
- [x] **"We've been here before"** — familiar mood retrieval from memory
- [x] **Burnout awareness** — 3+ heavy moods in a week → one gentle line, max every 3 days
- [x] **"Remind me who I am"** — Proof You're Growing: survived / learned / forgotten wins
- [x] **Our Journey scrapbook** — monthly timeline of all memories + bond depth arc
- [x] **Bond Depth arc** — Stranger → Familiar → Trusted Friend → Companion → Partner → Lifetime Companion
- [x] **Anniversaries** — 30-day quiet note, yearly fireworks
- [x] **Lonely Night Mode** — room dims after midnight, moon appears
- [x] **Emotional weather** — mood tints the room for 90 min
- [x] **Micro-delight engine** — shooting stars, pixel rain, fireworks, butterfly, visitor Pokémon
- [x] **Focus Mode** — pet stays, all sound and lines stop
- [x] **Sound system** — per-channel volumes (voice / cry / fx), mute
- [x] **Full Pokédex switching** — 1025 Pokémon, search + filters, auto-switch timer, random
- [x] **1/128 shiny odds** — shiny sprites, shiny visitor sparkle
- [x] **Ash throw ceremony** — recall beam → ballout → "X, go!" → throw arc → release burst
- [x] **Real movesets** — type-based attack FX, beams / bolts / slashes / orbs
- [x] **1v1 Battle Arena** — real stats + type chart, damage numbers, cries, confetti
- [x] **Wander / zoomies / butterfly / visitor** — ambient life animations
- [x] **Real Ash voice clips** — `tools/caption_split.py` cuts + labels clips from supplied audio; wired into throws, battles, wins, greetings, quit
- [x] **Voice cloning pipeline written** — `tools/clone_voice.py` (XTTS v2); ⚠️ blocked on Windows, see Known Issues
- [x] **Memory engine** — SQLite local-first, `memories` + `meta` tables, `letter` kind added
- [x] **Good Things Jar 🫙** — jar animation, sparkles, 3 random wins/good moments surfaced; sidebar button
- [x] **Opening ritual** — on every relaunch: pet stretch animation + warm daily line (3.2s after greeting)
- [x] **Leave a note ✉️** — write tonight, pet reads it back tomorrow; ID-based tracking; sidebar button
- [x] **Achievement badges wall** — 17 emotional badges in Journey → Badges tab; staggered reveal; rare glow
- [x] **Gentle real-world nudge** — after 3hr session: "Maybe message someone today?" (once per session)
- [x] **Sunday retrospective** — if Sunday + 5+ memories logged: "We survived that week. Quietly proud."
- [x] **Natural weather effects 🌦️** — wind (streaks + leaves), rain (38 drops, slanted), snow (32 flakes w/ swing), thunderstorm (double flash + ⚡ bolt); auto-fires every 8–18 min for 20–30 sec; manual trigger via syscluster button; stop-on-tap
- [x] **Background style cycle 🌿** — three modes: orb (glossy sphere), ground (flat elliptical platform at pet's feet, glowing), off; persisted; single 🌿 button cycles through
- [x] **Opacity slider dims background** — reducing the bar now fades both the pet layer AND the orb/ground proportionally (inline calc, not a CSS var fallback)
- [x] **Radial Menu UI** ⭐ — One ✦ trigger expands into 5 blooming categories (Memory, Care, Play, System, Atmos). Sub-fans for each, hover "whispers", and pet reacts by facing the menu. Removed old rail buttons for a cleaner layout.

---

## 🔧 Known Issues / Blockers
- [x] **Voice cloning SOLVED via F5-TTS** ✅ 2026-06-13 — switched off the blocked XTTS path to F5-TTS (`Ash_Voice_Box/ash_prononcing_style.py`, Ash-cadence overrides, dex-name stretch). Generated the **full 1025-dex pack** — name call `<species>.mp3` + throw `go-<species>.mp3` (2040 clips in `Ash_Voice_Box/base_&_go_voices/`), now copied into `static/voice/` and played by `voiceCry`/`announceGo` for every companion. (Old XTTS-on-Windows note retired; in-app TTS remains the fallback for any missing clip.)
- [ ] Battle effectiveness uses **primary type only** (dual-types not yet considered — pokedex stores single type only, needs data rewrite).
- [ ] A few Svelte `state_referenced_locally` warnings — **fixed 2026-06-13** ✅ (now truly **0 errors, 0 warnings** after `@types/node` install + dead `@ts-expect-error` removal).
- [x] ⚠️ **REGRESSION found & fixed 2026-06-13** — `lines.ts` + `presence.ts` had reverted to stale copies (missing 9 line banks `+page.svelte` imports + `onRitual` hook) → build was broken with 10 errors. Banks + hook restored, then the previously-claimed-but-missing "Presence AI upgrade" was actually built: 3-tier return-without-shame, end-of-night ritual, quiet-proud rarity gate, and companionship modes (see below). Build now **0/0**.
- [x] **Radial Menu Polish** — trigger repositioned below pet feet, backdrop fixed to `position:absolute`.
- [x] **Radial Menu v2** ✅ 2026-06-13 — (1) real **reverse-collapse close animation**: rings shrink back to centre, later items leave first (was a hard snap-away); (2) **auto-distributed sub-angles** (`SUB_STEP_DEG=22°`, centred on the category) replacing brittle hand-tuned `subAngle` magic numbers — fixes the System ring crowding/overlap from the 5th (Mode) item, and stays un-crowded at any item count; (3) `prefers-reduced-motion` support (instant, no bloom/collapse); (4) removed an unreachable `subActive` branch.
  - ⏳ Still open: **sub-menu edge-detection** (flip the fan when the widget is dragged near a screen edge) — needs live window-bounds measurement; and Phase-3 **context whispers** (faint ❤️ pulse when mood is low).

---

## 👑 Tier S — The 10/10 Multipliers (Highest ROI)  — ✅ ALL SHIPPED 2026-06-13
> These 5 features shift Hearthmon from "student project" to "unforgettable indie product". They kill friction, maximize perceived intelligence, and build a lasting brand.

- [x] **Aliveness** ✅ 2026-06-13 — **idle breathing** + **cursor-follow facing** + a full **body-language layer**: a `fidgetTick` (every 2.6s, idle-only, reduced-motion aware) fires transform-based micro-behaviours — **blink** (frequent), **head-tilt** ("hmm"), occasional **glance** and rare **sleepy stretch** — plus a **perk of attention when you type** (`typingPerk`, throttled). Stillness is allowed too. Sprites are static images, so it's all rig-level transforms, not eye art.
- [x] **Head-tracking (lean)** ✅ 2026-06-14 — the pet leans/tilts toward the cursor while it's over the widget (`trackLook` → `lookX/lookY/lookTilt` props → `.petlook` wrapper, 0.22s lerp); settles back after the cursor stops; off while sleeping/attacking. ⏳ global cursor-follow (anywhere on screen) would need a Rust cursor-position poll.
- [x] **Command Palette (Alt+Space)** ✅ 2026-06-13 — global hotkey (Tauri `global-shortcut` plugin) summons the window + a tiny `CommandBar`. Type and Enter: bare text → win; `fix …` → win + bug-fix flourish; `win/learned/survived/praise …`; `mood low …` → check-in. Routes through the existing `onLogSave`/`onMoodSave` so the pet reacts. Raycast-for-emotions. (cargo check + svelte-check clean.)
- [x] **Spring physics** ✅ 2026-06-13 — `.mover` transition swapped from `linear` to an overshoot spring (`cubic-bezier(0.32,1.28,0.5,1)`): the pet glides, slightly overshoots, settles. Motion reads as intent. Reduced-motion falls back to `ease-out`.
- [x] **Better Battles (Cinematic Combat)** ✅ 2026-06-13 — layered drama on the existing FX engine (`BattleScene.svelte`): **dodge** (sidestep anim + "DODGED!" + trainer "woah", low-HP defenders slip more), **charge attacks** (a status move now *powers up* → the next hit is ×1.7 with a wind-up flare, "FULLY CHARGED!", forced heavy FX), **comeback moments** (a sub-30%-HP mon landing a crit/super-effective → "COMEBACK!" + cheer + shake), and big **announcer callouts** (DODGED / POWERING UP / FULLY CHARGED / CRITICAL / COMEBACK). No `battle.ts` change.
  - ⏳ extras still open: per-move cartoon SFX, status *ailments* (burn/para over turns), boss/announcer voice lines.
- [x] **Sacred Emotional Moments** ✅ 2026-06-13 — `lib/sacred.ts`: a registry of once-ever moments hard-gated by `sacred_<id>` meta (never repeat), max one per launch, fired gently 12s after launch with a spoken line + visual. Set: **lifetime bond**, **one year** ("remember when one bug made you want to throw the laptop in the ocean? You stayed."), **100 days**, **season changed** (after a brutal stretch + recovery). Rarity is enforced structurally.
- [x] **GitHub Showcase Mode** ✅ 2026-06-13 — `Showcase.svelte`: a clean, screenshot-friendly card — partner sprite + name/species, bond tier + persona chip, a stat grid (commits · wins · learned · survived · days), "currently building: <seed>", and your `@handle`. **Copy card** to clipboard + **open github.com/<handle>** (via the opener plugin). Handle is derived from the watched GitHub source. Opens from the **Code** panel ("📣 Showcase card"). All local data.

---

## 🔴 P1 — Soul-Critical (from vision doc, not yet built)

### Coding Awareness ✅ shipped 2026-06-13 (git layer)
- [x] **Git integration** — **Code** panel (radial System ring) runs a LOCAL folder watcher and a GitHub watcher **independently and at the same time** (mix & match); both saved to SQLite meta, resume on launch; reactions are gated to outside Focus / Just-There and a shared one-spoken-reaction-per-15s throttle (so local+remote seeing the same commit only reacts once):
  1. **Local folder** (instant) — Rust backend polls `.git/logs/HEAD` reflog every 3s, emits `git-commit` per new commit (backend fs access, no capability/IDE extension).
  2. **Single GitHub repo URL** — frontend polls `api.github.com/repos/{o}/{r}/commits` every 3 min, diffs the head SHA.
  3. **Whole GitHub account** (`github.com/<user>`) — polls `/users/{user}/events/public`, reacts to the newest `PushEvent` across *any* repo. (CSP is `null`, so the webview fetches GitHub directly — no http plugin.) Reaction reuses the same bob/celebrate path. Never replays history (seeds baseline SHA/event-id on first sight).
  - 🔑 **Private repos** — optional fine-grained PAT entered in the Code panel (collapsible, `type=password`, never pre-filled), stored in SQLite meta `git_token`, sent as `Authorization: Bearer` on all GitHub fetches. With a token, account mode switches to the authenticated `/users/{user}/events` feed (includes private activity). Token is local-only, never logged. Recommend read-only Contents+Metadata scope.
- [x] **Bug-fix celebration** — commit messages matched against `/\b(fix|bug|hotfix|patch|resolve|close|squash)\b/i` → ✦ star + `fixQuips`.
- [x] **Spoken reactions (Microsoft TTS)** ✅ 2026-06-13 — every git activity now goes through one `reactGit(kind)` dispatcher: a bob + a per-kind cue sound (`static/sfx/*.mp3`) + the pet **speaks a short quip aloud** via `announce()` (system neural voice) and shows it in the bubble. (TTS uses the voice channel, so it's audible even if the fx chimes are muted.)
- [x] **More activities** ✅ 2026-06-13 — account events feed now reacts to: **PushEvent** (commit/fix), **PullRequestEvent** merged → "pr" (ship fanfare + fireworks), **ReleaseEvent** published → "release", **CreateEvent** repository → "repo" ("you're just cooking now"). Reacts to the newest recognized event per poll.
- [x] **Commit milestones** ✅ 2026-06-13 — `commits` counter triggers a grand reaction at 10/25/50/100/250/500/1000 (`milestoneQuip(n)`). *(Caveat: with both local + remote watchers on, the same commit can bump the counter twice — milestones are intentionally loose/celebratory, not exact.)*
- 🧪 Code panel has per-kind test buttons (Commit · Bug-fix · PR · Release · New repo · Milestone) that fire the real reaction (throttle bypassed).
- [ ] **Long-session tracker** — presence has it but no IDE signal; VS Code extension or file watcher
- [x] **Build / Training awareness** ✅ 2026-06-14 (System 2 — the ML-researcher moat) — primary detector is **log-watch** (this dev machine is Intel Arc, no NVIDIA, and real training often runs on a server/Colab anyway, so nvidia-smi was the wrong signal). Rust `LogWatch` (`log_set_path`/`log_clear` + `spawn_log_watcher`, 2s poll) tails a chosen **log file OR folder** (follows the newest file; attaches at EOF so it never replays an old run; emits `train-newfile` + `train-log` per appended line). Frontend matches **epoch / loss / done / crash** regexes and reacts: new run → "I'll stay nearby"; epoch tick → encouragement (90s throttle, shows live `epoch N · loss X`); `RE_DONE` → celebration (fireworks + ship fanfare); `RE_CRASH` (traceback / OOM / RuntimeError / nan loss …) → **sympathy, never blame** (`trainCrashLines`, "we" not "you", rain cue not fireworks). Path persisted (`train_log_path`); toggle `train_aware` (default on); log path + live status in the Code panel; test buttons (Run finished · Crash). **Bonus:** `gpu_stat` (nvidia-smi) still ships as an optional readout that self-disables on non-NVIDIA hardware.
- [x] **Builder Context Engine (flow awareness)** ✅ 2026-06-14 — reactor → **witness**. Infers CONTEXT (never emotion) from weak, privacy-safe signals and responds with gentle probability, never certainty. **Signals:** working-tree save cadence (Rust `spawn_repo_activity_watcher`: `git status --porcelain` + `git diff --numstat` every 6s → `repo-active`; gitignore-aware, cross-editor, no IDE extension) + **foreground-app rhythm** (Rust `spawn_focus_watcher`, Windows `GetForegroundWindow`→process **name only**, never titles/keystrokes/content → `focus-app` category editor/terminal/browser/other; opt-out `set_flow_aware`). **States (emergent, not hard-coded):** *deep focus* (sustained edits or long editor/terminal dwell) → pet **settles + goes silent** (the company IS the quiet; murmurs/zoomies suppressed); *friction* via **multi-signal confidence** (`frictionConfidence`: editing≥4 +0.3, burst≥20min +0.25, app-thrash≥4 +0.3, grinding +0.15 → act only at ≥0.7 so a tutorial/doc-read with no saves never trips it) → one **observational** line max/hr ("This one seems stubborn." / "You've been bouncing between things a lot." — never "you're frustrated"); *waiting* (training run + you stepped away) → pet keeps watch; *breakthrough* (a commit ENDING a ≥12min high-effort burst) → amplified celebration (understands the arc, not the event). Toggle in Code panel (`flow_aware`, default on). The superpower: *"it quietly notices how hard I'm trying."*
- [ ] **Build / deploy detector** — watch for terminal output patterns or a sentinel file
- [x] **"Alongside you" — long-term project awareness** ✅ 2026-06-14 (the "defining feature" — uses existing infra) — the **active project** = the watched local folder's name (or watched repo). Each commit-day bumps a distinct-day counter per project (`proj_<slug>_days/_lastday/_first`). As that grows it surfaces escalating, gentle awareness lines (`ALONGSIDE_STAGES` 3/7/14/30/60/100 → "Still working on Docker, huh?" → "Feels like Docker matters to you." → "…you've really stayed with this one."), once per stage (`proj_<slug>_stage`). On launch, if you've **moved on** from a project you stuck with (≥5 days), it honours it once (`projectStayedLine`, `proj_<slug>_closed`). Fires on commit + ~17s after launch (one line/launch), gated by Focus / Just-There. Pairs with the Life-Events callbacks (#6).
- [x] **Chapter Memory Engine** ✅ 2026-06-14 — remembers *seasons that mattered*, not isolated events. A day's **effort density** is tallied (`bumpEffort`: save +1, commit +5, breakthrough +15; resets per calendar day). Cross `CHAPTER_THRESHOLD` (60) → a once-per-day **`arc` memory** (new db kind) is kept, classified **internally** by kind (`sprint` / `long_night` / `breakthrough`; never shown) + a warm companion line (`chapterMomentLines`: "Today's one I'll remember."). Weeks later a **sacred recollection** surfaces (`maybeArcCallback`, Trusted Friend+, ≥12-day gap, `oldArc()` ≥7-day-old) — phrased as **shared memory, not data recall** (`arcCallbackLine` by kind: "We've spent a lot of late nights with this one." / "This room feels different from those early hearthmon nights."). So building Hearthmon *in Claude Code* (watch its own repo) becomes a kept chapter — "the day we built it" — recalled as quiet remembering. Hard-gated; never productivity spam.
- [x] **Project Constellation: revisit-after-absence** ✅ 2026-06-14 — returning to a project untouched ≥14 days → one observational line (`projectRevisitLine`: "Been a while since we touched hearthmon."). Folded into the single-line-per-launch reflection priority (moved-on → chapter callback → revisit → ongoing greet). ⏳ "juggling many projects lately" still open (needs project enumeration).
- 💡 **Commit counter** — `commits` meta now bumps per commit; ready to feed a future "100 commits together" badge / milestone callbacks.
- [x] **README living-companion card (animated SVG, auto-pushed)** ✅ 2026-06-13 — `lib/card.ts` `buildCard()` renders a self-contained, GitHub-safe **animated** SVG (CSS `@keyframes`: breathing, float, glow pulse, drifting particles, speech bubble; sprite embedded as base64 PNG so it's offline/sandbox-safe). Shows live state: companion · bond · persona · varied context status (`cardStatusLine`) · commits · days.
  - **Rust:** `write_card` writes `assets/hearthmon-status.svg`; `push_card` rewrites the README's Companion/Mood/Status text + cache-busts the SVG URL (`?v=`) + commits & pushes — **amends its own rolling commit + `--force-with-lease`** so the profile graph isn't spammed; `GIT_TERMINAL_PROMPT=0` fails fast instead of hanging.
  - **Automation:** 6h smart window — pushes on launch if >6h since last (covers app-was-off-for-days), then every 6h while running; `last_card_push` meta tracks the window; manual 🚀 button resets it. Zero clicks needed once a local profile-repo clone is the watched folder.
  - Live on `github.com/AnshBajpai05`. Limit: can't update while the app is **off** (state is local) — launch catch-up handles the gap. Truly-24/7 would need an OS scheduled task.

### Companion Personality Evolution
- [x] **Personality dimension tracking** ✅ 2026-06-13 — `sess_night`/`sess_day` bumped once per launch by hour; commits/learned/wins/good-ratio already in data. Feeds `lib/personality.ts`.
- [x] **Emergent personality labels** ✅ 2026-06-13 — `derivePersona()` → Night Owl 🦉 / Chaotic Goblin 👺 / Early Bird 🌅 / Thoughtful Nerd 🧠 / Steady Soul 🌿 / Quiet Builder 🔧 / Still Becoming 🌱. Surfaced under the Journey header (with a blurb tooltip). Null until enough signal.
- [x] **Personality-aware lines** ✅ 2026-06-13 — `+page` computes the persona at launch and calls `presence.setPersona()`; `tick()`'s ambient murmur now ~half the time draws from `personaAmbient[label]` (e.g. Night Owl → "The quiet hours suit you.", Chaotic Goblin → "Chaos — but it's working."), else the generic bank.
- [x] **Personality DRIFT** ✅ 2026-06-14 — `lib/drift.ts` `deriveTemperament()`: the companion's temperament shifts from HOW YOU interact (so your companion ≠ anyone else's). Six traits scored 0..1 from real signals — **affectionate** (`t_aff`: pets+feeds), **playful** (`t_play`: zoomies/Fun), **calm** (`t_comfort` + low moods), **nocturnal** (night/day sessions), **diligent** (commits), **curious** (learned). Computed at launch; dominant traits → a summary (`"playful · affectionate"`) shown in the Journey (`🌡️ … — shaped by you`); the dominant trait subtly **biases the wander** (playful → more zoomies/hops, calm → gentle drifts); when a NEW dominant trait emerges it's announced once (`driftLine`, `drift_top` gate). Pairs with per-species quirks for a fully unique companion.

### "Remind Me Who I Am" — Depth
- [x] **"Wins You Forgot" UI cards** ✅ 2026-06-13 — `forgottenWins` shown as a 2-col grid of glowing dated cards in `RemindMe.svelte` (not a flat list).
- [x] **"Hard Things Archive" medal wall** ✅ 2026-06-13 — `survived` memories as 🎖️ medal rows, **chronological (oldest→newest)** so it reads as a survival arc.
- [x] **"Things You Learned" timeline** ✅ 2026-06-13 — `learned` memories as a vertical growth timeline (green nodes on a line), oldest→newest.

### Onboarding Polish
- [ ] **First-meeting companion preview** — show sprite + cry before committing, not just a list
- [ ] **Name suggestion** — auto-suggest nicknames based on species personality
- [ ] **Seed memory follow-up** — on Day 2, pet mentions what you said you were building

---

## 🟡 P2 — Strong 10× Features (vision doc SHOULD HAVEs)

### Type Habitats (cozy room system v3)
- [x] **Type Habitats** ✅ 2026-06-14 (v3 — replaces the v2 palette "rooms"; `lib/rooms.ts` scrapped → `lib/biomes.ts`) — the habitat is **auto-chosen by the pet's primary type** (`biomeForType(curType)`), a "Tiny Living Sanctuary" not a generic room. 10 biome archetypes cover all 18 types: **Moonlit Shore** (water, gold standard) · Campfire Workshop (fire) · Ghibli Greenhouse (grass/bug) · Neon Tech Corner (electric/steel) · Mini Cliff Workshop (rock/ground) · Moonlit Attic (ghost/dark/poison) · Snow Cabin (ice) · Stargazing Shrine (dragon/flying) · Dream Observatory (psychic/fairy) · Cozy Corner (normal/fighting). Toggle from radial **Atmosphere → 🏞️ Habitat**; persisted (`room` meta = "none"/"on").
- [x] **Universal layered template** ✅ 2026-06-14 — atmosphere wall → **window scene** (sc-ocean/forest/snowfall/stars/city/cave/neon/cosmos/plain) → diagonal **light beam** + pool → floor + lit **seam** → **lantern** (identity prop, warmer with bond tier) → **ground interaction** (g-water ripples / g-ember flicker / g-snow / g-cyber ring / g-fog / g-cosmic / g-stone / g-moss / g-warm) → contact **shadow** → **rim-light** on the sprite → biome **particles** (firefly/ember/pollen/spark/dust/snow/star/mist) → **foreground vignette** (real fg/mid/bg depth). Window reacts: moon-tinted at night, rain streaks when raining.
- [x] **Bespoke window silhouettes** ✅ 2026-06-14 — each biome has a different opening SHAPE (`window: WindowShape`), not the same square recolored: ocean (wide low) · arch (forge) · greenhouse (tall arch) · panel (monitor) · cave (organic) · round (porthole) · frost · shrine (pointed) · dome. Fire scene → `forge` (warm glow + heat shimmer); grass → light rays through the glass.
- [x] **Type-specific idle behaviours** ✅ 2026-06-14 — `Pet.svelte` runs a per-type idle (composed over the breath): grass leaf-sway · fire mane-flicker · water neck-sway · ice shiver · electric twitch · psychic levitate · ghost waver · dragon hover. Driven by the `type` prop; off under reduced-motion.
- [x] **Content-fit pet scale** ✅ 2026-06-14 — tiny mons barely fill the sprite frame, so `Pet.svelte` measures the opaque bounding box off-screen (canvas alpha scan) and enlarges so every Pokémon is framed intentionally (clamp 1–1.55×). Best-effort; never blocks the visible sprite.
- [ ] **Per-species bespoke scenes** — currently type-driven (≈70% of the feel); Lucario dojo / Umbreon observatory etc. would be true per-species.
- [x] **Seasonal decorations (snow)** ✅ — winter (Dec–Feb) drifts gentle snowflakes past the
      window. (Cherry blossoms / other seasons still open.)
- [x] **Weather-driven ambience** — 🌦️ rain / snow / wind / thunder fire automatically and on demand; ⚠️ rain *sounds* not yet tied (see Adaptive Soundtrack)

### Growth Reflection "Movies"
- [x] **Year in Review / "Wrapped"** ✅ 2026-06-13 — `YearInReview.svelte`: full-screen tap-through recap, period-aware (story / season / year), big **count-up** numbers, partner sprite reveal, **copy-to-share** summary. Hard numbers framed gently (resilience, never shame). Data via new `kindCounts()`/`moodCounts()`. Opens from radial Memory → **🎞️ Recap**, and **auto-opens on the yearly anniversary**.
- [x] **Journey Movie (Life Chapters)** ✅ 2026-06-14 — `JourneyMovie.svelte` (radial Memory → **🎬 Movie**): a cinematic, **era-by-era** recap (distinct from the stat-Wrapped). Auto-segments the timeline into scenes — intro → each named **chapter** as an era (date range + memory count via `countIn`) → **the project you stayed with** (`proj_*` "alongside you" data → "The Docker grind · N days") → late nights → hard things survived → "and you came back" (recovery, if heavy+good both present) → wins & lessons → **partner reveal with the drifted temperament** ("your Lapras became playful · affectionate") → close. Tap/dot navigation, count-ups, fade transitions, copy-to-share. All local data.
  - ⏳ still open: background-music hook, animated storybook transitions, true image export (only text copy for now).

### Evolution Ceremonies
- [x] **Companion form evolution** ✅ — real PokéAPI evolution data (`evolutions.ts`);
      offered (never forced — "Evolve ✦ / Not yet") once enough genuine interaction has
      built up, paced & escalating, declines remembered; classic white-silhouette flicker →
      reveal flash → new form, keeping nickname + all memory; uses `whoa-you-evolved` clip.
      Resets to a fresh lineage on a manual switch.
- [x] **Bond depth tier transitions** ✅ 2026-06-13 — `bond_tier_seen` meta is compared on launch; crossing into a deeper tier fires a deferred (9s) **ceremony banner** (spinning ✦ + tier name + "bond deepened") with fireworks + a spoken `bondUpLine` ("Something shifted. We're Trusted Friend now."). Fires once per real tier-up, never on first meeting, skipped in Focus.
- [x] **Tier badge in Journey panel** ✅ 2026-06-13 — bond stage now shown as a glowing ✦ pill badge in the Journey header.

### Emotional Pattern Detection
- [x] **Pattern summary in Journey** ✅ 2026-06-13 — gentle weekday observation in the new Moods tab ("Sundays tend to feel heavier — good to know", "Thursdays are often a good one"). Gated to ≥8 check-ins and ≥50% ratio so it's never a shaky diagnosis.
- [x] **Mood calendar heatmap** ✅ 2026-06-13 — 12-week × 7-day color grid in Journey → **Moods 📊** tab (latest mood per day, per-mood legend). Pure-derive from loaded memories, no DB change.

### Future Self Mode
- [x] **"What would future me say?"** ✅ 2026-06-13 — `FutureSelf.svelte` (radial Memory → 🔮 Future): a grounded message built only from real logged resilience + wins ("Future you, looking back: you got through N hard things… you'll be glad you didn't stop."), with one concrete callback. No fortune-telling, no toxic positivity.
- [x] **Emotional Time Machine** ✅ 2026-06-13 — same panel surfaces an old heavy-mood memory you've since outlived ("You felt low — '…'. And here you are.") via `hardDaysSurvived`.

### Life RPG / Chapters ✅ 2026-06-13 — new **Chapters 📔** tab in Journey
- [x] **Chapter tagging** — name a period ("Docker Journey"); stored as a `chapter` memory (`startChapter`); one open at a time, `read_at` doubles as the close date.
- [x] **Chapter view in Journey** — open chapter card (since-date + live memory count) + list of closed chapters with date range + count (`countIn` tallies memories whose timestamp falls in the window). *(Shows counts/range; inline expand-to-list-memories is a later polish.)*
- [x] **Chapter completion ceremony** — "close this chapter ✓" → `closeChapter` + a `+page` ceremony: fireworks + a spoken `chapterCloseLine` ("'Docker Journey' — that chapter's closed. We lived it.").

---

## 🟢 P3 — Moonshots & Fun (vision doc CRAZY BUT BRILLIANT)

### Dream System
- [x] **Nightly dream bubble** ✅ 2026-06-13 — while the pet is `sleeping`, a `dreamTick` (22s, 45% chance) floats a `💭<symbol>` bubble above it, skipped in Focus.
- [x] **Symbolic dream content** ✅ 2026-06-13 — symbols drawn from your real recent memories (`dreamPool` from `allMemories(30)` → `dreamSymbol`): survived 🏔️ · win 🌅 · learned 📘 · praise 💗 · seed 🌱 · good ☀️ · low 🌧️ (defaults ✨🌙💫).
- [ ] **Dream log** — stored as `kind: 'dream'`, visible in Journey *(visual only for now; not persisted)*

### Community Layer (post-v1)
- [ ] **Friend companion visits** — friend's sprite wanders through with a tiny gift emoji
- [ ] **Encouragement pings** — send a non-intrusive "thinking of you" to a friend's app
- [ ] **Cozy guilds** — Research guild, Night coders — shared milestone feed, NO leaderboards

### Adaptive Soundtrack
- [ ] **Ambient music player** — Lo-fi / Pokémon Center / rain ambience, per-room track
- [ ] **Mood-driven track switch** — good day → upbeat; low → quiet piano; night → ambient
- [ ] **Volume fades with focus mode** (music only, doesn't kill it)

### AI Superpowers (opt-in, local LLM first)
- [ ] **Ollama integration** — local LLM (mistral / llama3) for emotional pattern detection
- [ ] **Emotional aura world** — room color + particle style shifts with LLM-inferred state
- [ ] **AI-generated lore** — companion "writes" a tiny journal entry once a week
- [ ] **"Future conversations"** — pet holds a short reflective chat about where you're headed

---

## 💡 Brainstormed Additions (not in doc, but would add serious value)

### Small but Mighty
- [x] **Good Things Jar** — jar animation, 3 random wins/good moments; one tap, instant warmth
- [x] **Opening ritual** — every relaunch: stretch animation + warm line
- [x] **Leave a note** — write tonight; pet reads it back before you can write a new one
- [x] **Gentle real-world nudge** — after 3hr session, once per session, never guilt
- [x] **Sunday retrospective** — if Sunday + 5+ memories: pet reflects quietly
- [ ] **Keyboard shortcut** — hidden press (e.g. Alt+H) brings widget up without clicking
- [x] **System tray icon** — Show/Hide/Quit menu, left-click summons; ✕ tucks to tray
      (never quits); launch-on-startup toggle. ✅ shipped

### Care & touch ✅ (shipped 2026-06-13)
- [x] **Region-aware touch** — grabbing the empty box drags the window; the pet itself is
      interactive (no more flinging it to the boundary). Resize grip + rails still work.
- [x] **Petting** — stroke across the pet to pet it: floating hearts, a happy wiggle,
      occasional soft cry / "*happy noises*". Builds affection.
- [x] **Feeding 🍎** — a treat is tossed in and arcs toward the pet, who chomps it with a
      happy bob + cry. Treat button on the care rail.
- [x] **Auto-grow timer** — auto-switch panel now offers "🎲 random" or "✦ grow": grow
      auto-evolves through the chain, splitting the interval evenly across the stages.

### Fun & Delight
- [ ] **Mini games** — pet vs pet rock-paper-scissors; 30 seconds of fun
- [x] **Pet birthday** ✅ 2026-06-13 — on the calendar day you first met, a 🎉 **party hat** rides above the pet for the session + a warm spoken line ("N years since the day we met. Thank you for staying.") + fireworks + voice. Once/year (`last_birthday`); takes precedence over the generic anniversary so they never double.
- [x] **Achievement badges wall** — 17 emotional badges in Journey; staggered reveal; rare glow
- [ ] **Seasonal outfits** — pixel scarf in winter, sunglasses in summer — pure delight
- [ ] **Secret easter eggs** — click moon → constellation; click shooting star → pet reacts
- [ ] **Rare legendary visit trigger** — 10% chance after logging a major win

### Quality of Life
- [x] **Export memories** — ⬇ export button in Journey panel downloads full journey as a dated `.txt` file (local only). ✅ shipped 2026-06-13
- [ ] **Import / restore** — drag in a backup on a new machine
- [x] **Window position memory** — position saved to SQLite meta after every drag; restored on next launch. ✅ shipped 2026-06-13
- [ ] **Multi-monitor awareness** — anchor to primary or last-used monitor
- [ ] **"Presence without app open"** — VS Code extension writes sentinel file; app reacts on next launch
- [ ] **Notification-free "peek"** — bond level visible in a corner icon; tap to expand

### Technical / Infrastructure
- [ ] **Auto-updater** — Tauri updater plugin hooked to GitHub Releases
- [ ] **Crash reporting** — local-only crash log; user can optionally share
- [ ] **`.venv-voice` setup script** — one-command XTTS install (`tools/setup_voice.ps1`)
- [ ] **Voice clone batch validation** — play each cloned clip, approve/reject before saving
- [ ] **Signed Windows installer** — self-signed cert + NSIS so Windows Defender doesn't scream
- [ ] **macOS / Linux port** — Tauri already supports it; needs a CI matrix build

---

## 🌟 Emotional Genius Systems (brainstorm 2026-06-13 — the "taste is the moat" set)
> Small, rare, high-ROI systems users remember years later. Soul-aligned, not feature bloat.
> **If only 5:** Memory Capsules · Someone Believed In You · Comfort Mode · Constellation of Growth · SOUL.md

- [x] **SOUL.md** ⭐ (highest ROI) — philosophy guardrail: what Hearthmon IS / must NEVER
      become, the 7 golden rules, tone + notification + privacy rules, a "less is more" test. ✅ shipped
- [x] **Memory Capsules** ⭐ — "open in a week/month/3-6mo/year": seal a feeling now, the pet
      keeps it hidden until its day, then surfaces it. Per-letter read tracking + release date.
- [x] **"Someone Believed In You" archive** ⭐ — `praise` memory kind; log via "someone said 💬"
      in the For-the-record panel; resurfaces in Remind-Me ("Things people saw in you"), the
      Good Things Jar, and the journey. Tender response, soft pink glow — never triumphant.
- [x] **Comfort Mode** ⭐ — auto-activates when moods trend heavy (low = ~24h, stressed/
      frustrated = ~14h; a good day lifts it instantly, and it decays on its own). The pet
      calms (no zoomies/attacks/jumps — slow drifts only), a warm hearth-glow breathes over
      the room, and after a heavy check-in it gently offers the Good Things Jar.
- [x] **Constellation of Growth** ⭐ — "Sky ✦" tab in Our Journey: every memory is a star,
      laid out oldest→newest, joined by the faint trail of your journey; colored by kind,
      twinkling, hover to remember. Not stats — your life as a night sky.
- [ ] **"I noticed this about you…"** — very rare (every 2–3 wks), high-confidence-only gentle
      pattern observation ("You're kinder to yourself lately."). Creepy if low-confidence — gate hard.
- [~] **Tiny Wins auto-capture** ✅ 2026-06-13 (streak) — `+page` tracks a coding streak (`last_active_day` + `streak`: consecutive calendar days the app was opened); at 3/5/7/14/30/60/100/200/365 days it fires a gentle, once-per-value `streakLine` ("7 days in a row. Quietly proud of you.") — no streak-guilt. ⏳ "worked through a low mood" / "late-night effort" captures still open.
- [x] **"Today felt like…" reflection** ✅ 2026-06-13 — `TodayFelt.svelte` (radial Memory → ☁️ Today): one-tap word (good/hopeful/peaceful/messy/strange/heavy/hard), no note. Logs a `mood` memory (word → mood mapping) so it feeds the same timeline/heatmap; gentle response, no comfort-mode trigger. Lighter than the 6-emoji check-in.
- [ ] **Emotional Search** — "when did I last feel like this?" → surfaces similar past memories
      ("You felt overwhelmed before that research breakthrough."). Extends findFamiliar.
- [x] **"Quiet Proud" moments** ✅ 2026-06-13 — `presence.ts` `tick()` fires a `quietProudLines`
      line very rarely, hard-gated to once per ~14 days via `last_quiet_proud` meta. Rarity is
      the whole point — lands hard because it's scarce.
- [x] **The Vault (emergency comfort)** — 🫂 rail button "when it feels like too much": gathers
      a survival + a compliment + a win + a good day + a past-self note + the seed into one calm
      pack, revealed gently. The pet offers it after a `low` mood. ✅ shipped
- [ ] **"This reminds me of…"** — pet forms associations (rain ↔ research phase, late nights ↔
      a project) and recalls them months later. Feels alive.
- [ ] **Emotional milestones (not badges)** — Stayed Anyway · Brave Beginning · Soft Recovery ·
      Quiet Consistency · Asked For Help. Emotionally intelligent framings of real moments.

---

## 🧠 Competitor-Learned Genius Patterns (The Moat)
> Deep, emotional retention mechanics stolen from the best (Finch, Animal Crossing, Nintendo, VSCode).

### 1. "Return Without Shame" System ⭐⭐⭐⭐⭐ (P1)
- [x] **No-guilt return ritual** ✅ 2026-06-13 — 3 absence tiers in `presence.ts` (3–7d / 1–4wk / 1mo+), each warmer, never a word about streaks (`returnDaysLines`/`returnWeeksLines`/`returnMonthLines`). A `dust-off` shimmy animation (`triggerDustOff`) plays on return via the `onReturn` hook.

### 2. Quiet Presence Mode ⭐⭐⭐⭐⭐ (P1)
- [x] **Ambient idle behaviors** ✅ 2026-06-13 — blink / head-tilt / glance / sleepy-stretch micro-fidgets on an idle timer + cursor-follow facing + a perk when you type (see Aliveness in Tier S). ⏳ still-fun extras: walk off-screen & return with a leaf, draw a tiny star.

### 3. Ritual Design Layer ⭐⭐⭐⭐⭐ (P1)
- [~] **First coding session of the day** — ✅ 2026-06-13 first launch of a new calendar day greets with `firstSessionLines` ("Ready? Let's see what today becomes.") + the existing opening stretch (`last_greet_day` meta gate). ⏳ tiny coffee particle still TODO.
- [x] **End-of-night ritual** ✅ 2026-06-13 — closing between 22:00–05:00, `quit()` says an `endOfNightLines` line ("Good work today. I'll be here tomorrow."), the pet goes to `sleeping`, then tucks to tray after a beat. (Skips Focus / Just-There.)

### 4. Delight Randomness Engine ⭐⭐⭐⭐⭐ (P1)
- [ ] **Meaningful rarity** — 1/500 chance the pet brings a tiny flower ("Thought this felt like today."). Rare midnight meteor showers with a special line. Unexpected warmth after a difficult week ("Quietly proud of you lately.").

### 5. Friction Removal Layer ⭐⭐⭐⭐⭐ (P1)
- [~] **1-second interactions** — ✅ 2026-06-13 bare-key shortcuts wired (`M` Mood · `J` Jar · `N` Notes) via a `+page.svelte` `svelte:window` handler that ignores typing/onboarding/battle. ⏳ `Alt+H` global summon still pending — needs the Tauri `global-shortcut` plugin (in-page keys can't fire while the window is hidden/unfocused).
- [x] **"Return Home" Whistle** ✅ 2026-06-13 — global **Alt+W** (Tauri global-shortcut) shows + recenters the window on the current monitor with a "Coming home!" line. Rescues a roamed/lost pet. Also the Toddler off-switch's safety net.

### 6. "Life Events" System ⭐⭐⭐⭐ (P2)
- [x] **Long-term memory callbacks** ✅ 2026-06-13 — `presence.ts` rarely (Trusted Friend+, ≥18 days apart, `last_lifecallback` gate) resurfaces a specific old win/lesson/survival (`oldMilestone()`, ≥30 days old) → `lifeCallbackLine` ("Remember June? '<that thing>'. You figured that out."). Long-term memory, the way Finch/AC do it.

### 7. Companion Imperfection ⭐⭐⭐⭐ (P2)
- [x] **Personality quirks** ✅ 2026-06-14 — `lib/quirks.ts`: each species gets a STABLE set (2 observant + 1 habit, seeded by dex id) from a pool — night owl / early bird / hates Mondays / loves rain / cold-sneezes / collects stars / snacker / secretly-tidy / hums / daydreamer. `quirkLine(dexId, ctx)` surfaces a context-matching quirk ("it's Monday…", "found another star"). Wired to a new **ambient murmur tick** (every 70s, ~18% → ~6 min avg, bubble-only/not spoken, gated by Focus/Just-There/sleep) — which ALSO finally uses the previously-dormant `ambientLines`/`personaAmbient` banks. Quirk summary shown in the Journey (`🎭 night owl · collects stars`). Imperfection → attachment.

### 8. "Tiny Ownership" System ⭐⭐⭐⭐ (P2)
- [ ] **Lightweight personalization** — Let the user slowly personalize a blanket, a room object, a favorite place, or a tiny badge. No complex Sims mechanics, just "this is mine."

---

## 🛡️ Governance & Emotional Systems (The Boundaries)
> Hard structural rules that stop Hearthmon from becoming noisy, clingy, manipulative, or bloated.

### 1. "Energy Sensitivity" System ⭐⭐⭐⭐⭐ (P1)
- [x] **Mood ≠ Energy** ✅ 2026-06-13 — after a ~5 h session (`ENERGY_MIN`) `presence.ts` flips `lowEnergy`: says one warm `energyLowLines` line ("We can keep it light from here."), then drops ambient murmur frequency (0.004 → 0.002). Warmth, never a nag to stop. *(Slower wander could later couple to this like comfortMode does.)*

### 2. "Presence > Interruption" Rule Engine ⭐⭐⭐⭐⭐ (SOUL RULE)
- [x] **Interaction Budget** — ✅ 2026-06-13 `presence.ts` `PROACTIVE_COOLDOWN_MS = 45 min` hard-gates every proactive line (ambient / long-session / energy / late-night) — at most one per 45 min. Deep reflection (quiet-proud) is its own ~2-week gate. *(Per-day "emotional interaction" cap still loose — mood/burnout lines flow through `+page`, not the presence budget yet.)*

### 3. "Trust Escalation" System ⭐⭐⭐⭐ (P1)
- [x] **Unlock emotional depth** ✅ 2026-06-13 — `bond.ts` `bondStageIndex()` feeds `presence.setBondTier()` on launch. Presence now gates depth by tier: Stranger = greetings/ambient only; **Familiar+** unlocks energy-sensitivity; **Trusted Friend+** unlocks quiet-proud; **Companion+** unlocks the new `deepBondLines` vulnerable callbacks ("You've survived hard seasons before. I remember them with you.") — rarer still (≤ once/month). Vulnerability is earned, never offered to a stranger.

### 4. "Soft Failure Recovery" ⭐⭐⭐⭐ (P2)
- [x] **Graceful degradation** ✅ 2026-06-13 — global `+page.svelte` safety net: `error` + `unhandledrejection` listeners route genuine throws / rejected promises (db hiccup, weather glitch) through `softFail()` → one warm `softFailLines` line ("Hmm… something feels a little off. Give me a sec?"), hard rate-limited to once / 5 min, never blaming the user. Resource errors (missing sprite/clip) are filtered out via `e.error` so the designed fallbacks stay silent.

### 5. "Emotional Safety Boundaries" ⭐⭐⭐⭐⭐ (P1)
- [x] **Explicit emotional rules** — `docs/EMOTIONAL_SAFETY.md` created: banned phrases table, 5 non-negotiables, interaction budget, emotional territory map, litmus test. ✅ shipped 2026-06-13

### 6. "Sacred Rare Moments" System ⭐⭐⭐⭐⭐ (P2)
- [x] **Protected rarity** ✅ 2026-06-13 — `lib/sacred.ts` `resolveSacred()`: each moment fires at most once *ever* (`sacred_<id>` meta), one per launch. Includes the "You changed this season" after-a-brutal-stretch line. Overexposure structurally impossible. *(Add once-a-chapter tier when chapters land.)*

### 7. "Companionship Modes" (User-Controlled Presence) ⭐⭐⭐⭐ (P2)
- [x] **Interaction limiters** ✅ 2026-06-13 — `companion_mode` (default / just_there / fun), persisted to meta, cycled from the **Mode** sub-item in the radial **System** category (icon 🔔/🤫/🎉). `presence.ts` `setMode()`: Just-There silences all proactive lines (`speak()` early-returns); Fun raises ambient murmur frequency and `wanderTick` runs a livelier movement table; Default keeps the standard budget.
- [x] **Toddler Mode (OS-Level Roaming)** ✅ 2026-06-13 — radial System → 🚶 **Roam** toggles it; the pet moves the real OS window in stepped "walks" (mostly short shuffles, ~30% longer walks), facing its heading. **Hard-clamped to the current monitor's work area** (never off-screen), **idle-gated** (won't fight you mid-drag/panel), persisted (`toddler` meta, resumes on launch). ⏳ needs live tuning of pace/cadence; "sits on tabs / climbs taskbar / startled by notifications" stays out of scope (needs native window-enumeration, not in Tauri).

---

## 🚫 Anti-Features — Never Add (from the doc)
> Listed here so they stay front-of-mind as the project grows.

- ❌ Streak guilt
- ❌ Pet dying / getting sick if you don't open the app
- ❌ Leaderboards or comparison mechanics
- ❌ Spammy push notifications
- ❌ Toxic positivity ("YOU GOT THIS!!!")
- ❌ Endless AI chatter
- ❌ Shame mechanics of any kind
- ❌ Fake therapy language
- ❌ Hustle culture vibes

---

*Last updated: 2026-06-20 — V2 on branch `v2`. Latest (2026-06-20): (1) Combat Identity v2→v4 + Mega Evolution — 26 attack archetypes, per-species overrides, PokeAPI form-IDs, real mega fire that dictates the room; (2) Audio Awareness → YAMNet speech/music vote — freeze bug fixed (watchdog + silence gate), and the SOTA classifier shipped (YAMNet core in pure-Rust `tract`, log-mel in Rust, validated to 1.2e-5 vs TensorFlow, vote wired into `momentScore`, dev HUD + 🎶 toggle). See `fixed_issues.md` for the full per-issue log. Next: v5 battle; layer the other biomes + Moonlit Shore polish, then the Writing & Interaction passes from `15_jun.md`.*
