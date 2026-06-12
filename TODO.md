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
- [x] **Voice cloning pipeline** — `tools/clone_voice.py` with XTTS v2 (attempt 5 in progress)
- [x] **Memory engine** — SQLite local-first, `memories` + `meta` tables

---

## 🔴 P1 — Soul-Critical (from vision doc, not yet built)

### Coding Awareness
- [ ] **Git integration** — watch `.git/COMMIT_EDITMSG` for new commits → quiet pet reaction
- [ ] **Bug-fix celebration** — detect error → fix pattern from git (commit message heuristic) → small dance
- [ ] **Long-session tracker** — already in presence but no visual IDE signal; hook into a VS Code extension or file watcher
- [ ] **Build / deploy detector** — watch for terminal output patterns or a sentinel file

### Companion Personality Evolution
- [ ] **Personality dimension tracking** — store `coding_style`, `session_times`, `mood_trend` in `meta`
- [ ] **Emergent personality labels** — night owl, thoughtful nerd, chaotic goblin etc., surface in Journey panel
- [ ] **Personality-aware lines** — tweak line selection based on evolved personality type

### "Remind Me Who I Am" — Depth
- [ ] **"Wins You Forgot"** already retrieved but needs UI cards with dates + text (not just list)
- [ ] **"Hard Things Archive"** list view — survived memories in chronological order, styled like a medal wall
- [ ] **"Things You Learned"** timeline — `learned` memories visualized as skill tree nodes

### Onboarding Polish
- [ ] **First-meeting companion preview** — show sprite + cry before committing, not just a list
- [ ] **Name suggestion** — auto-suggest nicknames based on species personality
- [ ] **Seed memory follow-up** — on Day 2, pet should mention what you said you were building

---

## 🟡 P2 — Strong 10× Features (vision doc SHOULD HAVEs)

### Cozy Room System
- [ ] **Themed background layers** — cozy coding room / Pokémon center lab / rainy cabin / Ghibli workshop
- [ ] **Room unlocks via bond depth** — desk plant at Familiar, warm lamp at Trusted Friend, bookshelf at Companion
- [ ] **Seasonal decorations** — snow in winter, cherry blossoms in spring (system clock)
- [ ] **Weather-driven ambience** — rain sounds + rain visual on pixel rain delight (already exists, extend it)

### Growth Reflection "Movies"
- [ ] **Quarterly recap** — "Spring 2026: You learned X, survived Y, logged Z good days"
- [ ] **Spotify-Wrapped-style layout** — full-screen overlay, background music hook, tap to dismiss
- [ ] **One-year cinematic** — animated storybook of the whole year, auto-triggers on yearly anniversary

### Evolution Ceremonies
- [ ] **Bond depth tier transitions** — visual ceremony when moving from Stranger → Familiar etc.
- [ ] **Companion form evolution** — optional visual form-shift tied to bond depth (e.g. base → stage 1 sprite)
- [ ] **Tier badge in Journey panel** — animated reveal of new bond level

### Emotional Pattern Detection
- [ ] **Pattern summary in Journey** — "You tend to feel low on Sundays", "Thursdays are usually good"
- [ ] **Mood calendar heatmap** — 12-week rolling view of mood colors in Journey panel

### Future Self Mode
- [ ] **"What would future me say?"** — generates a grounded reply based on past resilience + wins
- [ ] **Emotional Time Machine** — "What were you worried about 6 months ago?" → surfaces old mood logs

### Life RPG / Chapters
- [ ] **Chapter tagging** — user can name a period ("Docker Journey", "Internship Season")
- [ ] **Chapter view in Journey** — collapsible chapters, memories grouped inside
- [ ] **Chapter completion ceremony** — small confetti + pet line when a chapter is closed

---

## 🟢 P3 — Moonshots & Fun (vision doc CRAZY BUT BRILLIANT)

### Dream System
- [ ] **Nightly dream bubble** — when pet has been sleeping for > 2 hrs, show a dream thought bubble with a memory symbol
- [ ] **Symbolic dream content** — if you struggled with ML, dream shows 🏔️; finished project = 🌅
- [ ] **Dream log** — stored in memories as `kind: 'dream'`, visible in Journey

### Community Layer (post-v1)
- [ ] **Friend companion visits** — a friend's companion sprite wanders through with a tiny gift emoji
- [ ] **Encouragement pings** — send a non-intrusive "thinking of you" to a friend's app
- [ ] **Cozy guilds** — "Research guild", "Night coders" — shared milestone feed, NO leaderboards

### Adaptive Soundtrack
- [ ] **Ambient music player** — Lo-fi / Pokémon Center / rain ambience, per-room track
- [ ] **Mood-driven track switch** — good day → upbeat; low → quiet piano; night → ambient
- [ ] **Volume fades with focus mode** (music only, not kills it)

### AI Superpowers (opt-in, local LLM first)
- [ ] **Ollama integration** — local LLM (mistral / llama3) for emotional pattern detection
- [ ] **Emotional aura world** — room color + particle style shifts subtly with LLM-inferred state
- [ ] **AI-generated lore** — companion "writes" a tiny journal entry once a week based on your memories
- [ ] **"Future conversations"** — pet holds a short reflective chat about where you're headed

---

## 💡 Brainstormed Additions (not in doc, but would add serious value)

### Small but Mighty
- [ ] **"Good Things Jar"** — a dedicated button that opens a jar animation and pulls 3 random wins/good moments; one tap, instant warmth
- [ ] **Daily opening ritual** — first app launch of the day: pet does a tiny stretch animation + says the date + one line; makes it feel like a morning companion, not a tool
- [ ] **Gentle real-world nudge** — after 3+ hrs session, pet occasionally says "maybe message someone today?" (not guilt, genuine care; aligns with healthy attachment principle)
- [ ] **"We survived that week" retrospective** — every Sunday, if 5+ memories logged that week, pet reflects on it quietly
- [ ] **Keyboard shortcut overlay** — hidden press (e.g. Alt+H) brings up Hearthmon from tray without clicking
- [ ] **System tray icon** — pet lives in tray; double-click to show/hide widget (Tauri tray support exists)

### Fun & Delight
- [ ] **Mini games** — pet vs pet tic-tac-toe / rock-paper-scissors (taps the sidebar button, tiny popup, 30 seconds of fun)
- [ ] **Pet birthday** — on the anniversary of `first_met` date (same day, 1 year in), special "Happy Birthday, [name]!" moment with a party hat sprite overlay
- [ ] **"Leave a note"** — type a note tonight that the pet will read back to you tomorrow morning (memory `kind: 'letter'`, displayed on next greeting)
- [ ] **Achievement badges wall** — not progress badges, emotional ones: "CUDA Survivor", "Builder's Courage", "Quiet Consistency" — displayed in Journey panel
- [ ] **Seasonal outfits** — pixel overlay on sprite (a tiny scarf in winter, sunglasses in summer) — pure delight, zero function
- [ ] **Secret clickable easter eggs** — click the moon in Night Mode → constellation appears; click the shooting star → pet reacts; these tiny hidden interactions create "I found something!" moments
- [ ] **Rare legendary visit trigger** — after logging a major win (not just any win) there's a 10% chance a legendary wanders through; epic moment

### Quality of Life
- [ ] **Export memories** — download your journey as a `.txt` or `.json` (local export only, no server); the memory is yours
- [ ] **Import / restore** — drag in a backup to restore memories on a new machine
- [ ] **Window position memory** — remember last window position between sessions (not just bottom-right anchor)
- [ ] **Multi-monitor awareness** — correctly anchor to the primary or last-used monitor
- [ ] **"Presence without app open"** — VS Code extension that writes session data to a sentinel file; app reads it on next open and reacts to what happened while it was closed
- [ ] **Notification-free "peek"** — a tiny status icon in the corner of the pet that shows bond level without opening Journey panel; tap to expand

### Technical / Infrastructure
- [ ] **Auto-updater** — Tauri updater plugin hooked to GitHub Releases
- [ ] **Crash reporting** — local-only crash log written to `%APPDATA%`; user can optionally share
- [ ] **`.venv-voice` setup script** — one-command install for the XTTS voice pipeline (`tools/setup_voice.ps1`)
- [ ] **Voice clone batch validation** — script that plays each cloned clip and lets you approve/reject before saving
- [ ] **Signed Windows installer** — self-signed cert + NSIS installer so Windows Defender doesn't scream
- [ ] **macOS / Linux port** — Tauri already supports it; needs a CI matrix build

---

## 🚫 Anti-Features — Never Add (from the doc)
> These are listed here so they stay front-of-mind as the project grows.

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

*Last updated: June 2026 — voice cloning attempt 5 in progress (torch 2.8 + XTTS, no FFmpeg DLL dependency)*
