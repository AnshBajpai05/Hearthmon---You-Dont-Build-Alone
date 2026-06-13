# Hearthmon — TODO & Backlog
> Compared against `docs/VISION.txt` (the full 3-part product soul document) and the current codebase.  
> Priority: **P1** = missing soul-critical | **P2** = strong 10x feature | **P3** = moonshot / nice-to-have | **💡** = brainstormed addition not in doc

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
- [ ] **Local voice cloning (XTTS v2) blocked on Windows.** Modern `coqui-tts` pulls in
      `torchcodec`, whose prebuilt DLL won't load without matching FFmpeg shared libs.
      Tried torch 2.8/2.9 + transformers 4.40–4.56 + removing torchcodec — all fail at
      import or runtime. **Fix to try next:** a fully pinned legacy env in `tools/.venv-voice` —
      `torch==2.1.2 torchaudio==2.1.2 transformers==4.40.2 coqui-tts==0.24.*` (predates the
      torchcodec requirement). Until then, the in-app TTS ("Charizard…" → real "I choose you!"
      clip) is the working fallback, and supplied real clips already play.
- [ ] Battle effectiveness uses **primary type only** (dual-types not yet considered — pokedex stores single type only, needs data rewrite).
- [ ] A few Svelte `state_referenced_locally` warnings — **fixed 2026-06-13** ✅ (now truly **0 errors, 0 warnings** after `@types/node` install + dead `@ts-expect-error` removal).
- [x] ⚠️ **REGRESSION found & fixed 2026-06-13** — `lines.ts` + `presence.ts` had reverted to stale copies (missing 9 line banks `+page.svelte` imports + `onRitual` hook) → build was broken with 10 errors. Banks + hook restored, then the previously-claimed-but-missing "Presence AI upgrade" was actually built: 3-tier return-without-shame, end-of-night ritual, quiet-proud rarity gate, and companionship modes (see below). Build now **0/0**.
- [x] **Radial Menu Polish** — trigger repositioned below pet feet, backdrop fixed to `position:absolute`.
- [x] **Radial Menu v2** ✅ 2026-06-13 — (1) real **reverse-collapse close animation**: rings shrink back to centre, later items leave first (was a hard snap-away); (2) **auto-distributed sub-angles** (`SUB_STEP_DEG=22°`, centred on the category) replacing brittle hand-tuned `subAngle` magic numbers — fixes the System ring crowding/overlap from the 5th (Mode) item, and stays un-crowded at any item count; (3) `prefers-reduced-motion` support (instant, no bloom/collapse); (4) removed an unreachable `subActive` branch.
  - ⏳ Still open: **sub-menu edge-detection** (flip the fan when the widget is dragged near a screen edge) — needs live window-bounds measurement; and Phase-3 **context whispers** (faint ❤️ pulse when mood is low).

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
- [ ] **Build / deploy detector** — watch for terminal output patterns or a sentinel file
- 💡 **Commit counter** — `commits` meta now bumps per commit; ready to feed a future "100 commits together" badge / milestone callbacks.

### Companion Personality Evolution
- [ ] **Personality dimension tracking** — store `coding_style`, `session_times`, `mood_trend` in `meta`
- [ ] **Emergent personality labels** — night owl, thoughtful nerd, chaotic goblin — surface in Journey
- [ ] **Personality-aware lines** — tweak line selection based on evolved personality type

### "Remind Me Who I Am" — Depth
- [ ] **"Wins You Forgot" UI cards** — dates + text as proper cards, not a flat list
- [ ] **"Hard Things Archive" medal wall** — survived memories in chronological order
- [ ] **"Things You Learned" timeline** — `learned` memories visualized as skill tree nodes

### Onboarding Polish
- [ ] **First-meeting companion preview** — show sprite + cry before committing, not just a list
- [ ] **Name suggestion** — auto-suggest nicknames based on species personality
- [ ] **Seed memory follow-up** — on Day 2, pet mentions what you said you were building

---

## 🟡 P2 — Strong 10× Features (vision doc SHOULD HAVEs)

### Cozy Room System
- [ ] **Themed background layers** — cozy coding room / Pokémon center lab / rainy cabin / Ghibli workshop
- [ ] **Room unlocks via bond depth** — desk plant at Familiar, warm lamp at Trusted Friend, bookshelf at Companion
- [x] **Seasonal decorations (snow)** ✅ — winter (Dec–Feb) drifts gentle snowflakes past the
      window. (Cherry blossoms / other seasons still open.)
- [x] **Weather-driven ambience** — 🌦️ rain / snow / wind / thunder fire automatically and on demand; ⚠️ rain *sounds* not yet tied (see Adaptive Soundtrack)

### Growth Reflection "Movies"
- [ ] **Quarterly recap** — "Spring 2026: You learned X, survived Y, logged Z good days"
- [ ] **Spotify-Wrapped-style layout** — full-screen overlay, background music hook, tap to dismiss
- [ ] **One-year cinematic** — animated storybook of the whole year, auto-triggers on yearly anniversary

### Evolution Ceremonies
- [x] **Companion form evolution** ✅ — real PokéAPI evolution data (`evolutions.ts`);
      offered (never forced — "Evolve ✦ / Not yet") once enough genuine interaction has
      built up, paced & escalating, declines remembered; classic white-silhouette flicker →
      reveal flash → new form, keeping nickname + all memory; uses `whoa-you-evolved` clip.
      Resets to a fresh lineage on a manual switch.
- [ ] **Bond depth tier transitions** — visual ceremony when moving Stranger → Familiar etc.
- [ ] **Tier badge in Journey panel** — animated reveal of new bond level

### Emotional Pattern Detection
- [ ] **Pattern summary in Journey** — "You tend to feel low on Sundays", "Thursdays are usually good"
- [ ] **Mood calendar heatmap** — 12-week rolling view of mood colors in Journey panel

### Future Self Mode
- [ ] **"What would future me say?"** — grounded reply based on past resilience + wins
- [ ] **Emotional Time Machine** — "What were you worried about 6 months ago?" → surfaces old moods

### Life RPG / Chapters
- [ ] **Chapter tagging** — user can name a period ("Docker Journey", "Internship Season")
- [ ] **Chapter view in Journey** — collapsible chapters, memories grouped inside
- [ ] **Chapter completion ceremony** — small confetti + pet line when a chapter is closed

---

## 🟢 P3 — Moonshots & Fun (vision doc CRAZY BUT BRILLIANT)

### Dream System
- [ ] **Nightly dream bubble** — pet sleeping > 2 hrs → dream thought bubble with memory symbol
- [ ] **Symbolic dream content** — ML struggle = 🏔️; finished project = 🌅
- [ ] **Dream log** — stored as `kind: 'dream'`, visible in Journey

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
- [ ] **Pet birthday** — party hat overlay + special moment on `first_met` anniversary
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
- [ ] **Tiny Wins auto-capture** — silently log invisible progress (coded N days straight, worked
      through a low mood, late-night effort) → occasional "Quietly proud of this week."
- [ ] **"Today felt like…" reflection** — at night, one-tap emotional word (heavy/hopeful/messy/
      good/strange/peaceful/hard). Builds an emotional timeline, lighter than the mood check-in.
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
- [ ] **Ambient idle behaviors** — When coding, the pet shouldn't just wait for clicks. It should occasionally look at the cursor, watch typing, do a small sleepy stretch, draw a tiny star, or walk off-screen and return with a leaf. Attention mirroring.

### 3. Ritual Design Layer ⭐⭐⭐⭐⭐ (P1)
- [~] **First coding session of the day** — ✅ 2026-06-13 first launch of a new calendar day greets with `firstSessionLines` ("Ready? Let's see what today becomes.") + the existing opening stretch (`last_greet_day` meta gate). ⏳ tiny coffee particle still TODO.
- [x] **End-of-night ritual** ✅ 2026-06-13 — closing between 22:00–05:00, `quit()` says an `endOfNightLines` line ("Good work today. I'll be here tomorrow."), the pet goes to `sleeping`, then tucks to tray after a beat. (Skips Focus / Just-There.)

### 4. Delight Randomness Engine ⭐⭐⭐⭐⭐ (P1)
- [ ] **Meaningful rarity** — 1/500 chance the pet brings a tiny flower ("Thought this felt like today."). Rare midnight meteor showers with a special line. Unexpected warmth after a difficult week ("Quietly proud of you lately.").

### 5. Friction Removal Layer ⭐⭐⭐⭐⭐ (P1)
- [~] **1-second interactions** — ✅ 2026-06-13 bare-key shortcuts wired (`M` Mood · `J` Jar · `N` Notes) via a `+page.svelte` `svelte:window` handler that ignores typing/onboarding/battle. ⏳ `Alt+H` global summon still pending — needs the Tauri `global-shortcut` plugin (in-page keys can't fire while the window is hidden/unfocused).
- [ ] **"Return Home" Whistle** — A global hotkey (e.g., `Alt+W` or similar) that instantly recalls the pet. If it has wandered off-screen in Toddler Mode or gotten lost, it whistles and smoothly slides back to the primary monitor center.

### 6. "Life Events" System ⭐⭐⭐⭐ (P2)
- [ ] **Long-term memory callbacks** — Pet remembers the internship, the research breakthrough, or the bad exam week. Months later: "Remember when we were struggling with Docker? You figured that out."

### 7. Companion Imperfection ⭐⭐⭐⭐ (P2)
- [ ] **Personality quirks** — The pet is too flawless. Needs quirks based on its personality (e.g., loves late-night coding, hates Mondays, collects stars). Imperfection creates attachment.

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
- [ ] **Protected rarity** — Certain interactions should be restricted to once a year, once a chapter, or once a lifetime. Example: After a brutal semester: "You changed this season." Never repeated. Overexposure kills the magic.

### 7. "Companionship Modes" (User-Controlled Presence) ⭐⭐⭐⭐ (P2)
- [x] **Interaction limiters** ✅ 2026-06-13 — `companion_mode` (default / just_there / fun), persisted to meta, cycled from the **Mode** sub-item in the radial **System** category (icon 🔔/🤫/🎉). `presence.ts` `setMode()`: Just-There silences all proactive lines (`speak()` early-returns); Fun raises ambient murmur frequency and `wanderTick` runs a livelier movement table; Default keeps the standard budget.
- [ ] **Toddler Mode (OS-Level Roaming)** — A special fun mode where the pet freely roams your entire monitor. It moves the actual transparent OS window continuously, making random short shuffles and occasional long walks across the screen.

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

*Last updated: 2026-06-13 — soul layer complete; fun layer complete; weather + background system shipped; voice cloning blocked (TTS fallback live).*
