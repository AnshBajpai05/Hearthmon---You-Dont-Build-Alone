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
- [ ] A few Svelte `state_referenced_locally` warnings — **fixed 2026-06-13** ✅ (0 errors, 1 harmless tsconfig warn).
- [x] **Radial Menu Polish** — trigger repositioned below pet feet, close animation improved, backdrop fixed to `position:absolute`.

---

## 🔴 P1 — Soul-Critical (from vision doc, not yet built)

### Coding Awareness
- [ ] **Git integration** — watch `.git/COMMIT_EDITMSG` for new commits → quiet pet reaction
- [ ] **Bug-fix celebration** — detect fix pattern in commit message heuristic → small dance
- [ ] **Long-session tracker** — presence has it but no IDE signal; VS Code extension or file watcher
- [ ] **Build / deploy detector** — watch for terminal output patterns or a sentinel file

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
- [ ] **"Quiet Proud" moments** — no confetti, just a rare (every 2–3 wks) "Quietly proud of you
      today." Rarity is the whole point — lands hard because it's scarce.
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
- [ ] **No-guilt return ritual** — If the user disappears for days/weeks/months, never mention a broken streak. The pet just says, "Hey. It's good to see you again. No worries, I kept things warm here." Add a tiny dust-off animation. Compassion over engagement addiction.

### 2. Quiet Presence Mode ⭐⭐⭐⭐⭐ (P1)
- [ ] **Ambient idle behaviors** — When coding, the pet shouldn't just wait for clicks. It should occasionally look at the cursor, watch typing, do a small sleepy stretch, draw a tiny star, or walk off-screen and return with a leaf. Attention mirroring.

### 3. Ritual Design Layer ⭐⭐⭐⭐⭐ (P1)
- [ ] **First coding session of the day** — Pet stretches: "Ready? Let's see what today becomes." Tiny coffee particle.
- [ ] **End-of-night ritual** — Instead of just quitting: "Good work today. I'll be here tomorrow." Pet sleeps, moon glows.

### 4. Delight Randomness Engine ⭐⭐⭐⭐⭐ (P1)
- [ ] **Meaningful rarity** — 1/500 chance the pet brings a tiny flower ("Thought this felt like today."). Rare midnight meteor showers with a special line. Unexpected warmth after a difficult week ("Quietly proud of you lately.").

### 5. Friction Removal Layer ⭐⭐⭐⭐⭐ (P1)
- [ ] **1-second interactions** — `Alt+H` summons the widget. `J` opens the Jar, `N` opens Notes, `M` opens Mood. Power-user comfort means huge retention.
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
- [ ] **Mood ≠ Energy** — If the user coded for 6 hours, the pet should naturally become quieter, slower, and warmer. E.g., "We can keep it light tonight." Prevents emotional mismatch (happy but exhausted shouldn't trigger zoomies).

### 2. "Presence > Interruption" Rule Engine ⭐⭐⭐⭐⭐ (SOUL RULE)
- [ ] **Interaction Budget** — Hard system rule: Max 1 proactive interaction per 45 min, max 1 emotional interaction per day, max 1 deep reflection per week. The companion must never feel like it's "always talking."

### 3. "Trust Escalation" System ⭐⭐⭐⭐ (P1)
- [ ] **Unlock emotional depth** — Interactions should unlock emotionally based on bond depth. Stranger = light encouragement. Familiar = small memories. Trusted Friend = deeper callbacks. Companion = vulnerable moments. High bond: "You've survived hard seasons before. I remember."

### 4. "Soft Failure Recovery" ⭐⭐⭐⭐ (P2)
- [ ] **Graceful degradation** — When a system fails (Git watcher, weather bug, missing voice clip), the pet should handle it with warm UX instead of an error message: "Hmm… something feels a little off. Give me a sec?"

### 5. "Emotional Safety Boundaries" ⭐⭐⭐⭐⭐ (P1)
- [x] **Explicit emotional rules** — `docs/EMOTIONAL_SAFETY.md` created: banned phrases table, 5 non-negotiables, interaction budget, emotional territory map, litmus test. ✅ shipped 2026-06-13

### 6. "Sacred Rare Moments" System ⭐⭐⭐⭐⭐ (P2)
- [ ] **Protected rarity** — Certain interactions should be restricted to once a year, once a chapter, or once a lifetime. Example: After a brutal semester: "You changed this season." Never repeated. Overexposure kills the magic.

### 7. "Companionship Modes" (User-Controlled Presence) ⭐⭐⭐⭐ (P2)
- [ ] **Interaction limiters** — Let the user explicitly set a mode that restricts the pet's interaction frequency while keeping actions available. E.g., "Just There Mode" (silent presence, zero proactive lines), "Fun Mode" (more frequent banter and zoomies), or "Default" (uses the standard interaction budget).
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
