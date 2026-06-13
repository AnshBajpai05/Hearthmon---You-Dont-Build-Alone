# Hearthmon — You Don't Build Alone

> A warm Pokémon-inspired companion that quietly grows beside you while you build,
> remembers your struggles and achievements, and gently reminds you who you are
> when you forget.

A transparent, always-on-top desktop pet for Windows. It's not a productivity app, a
journal, or a chatbot — it's an **emotional companion for people building hard things**.
Everything stays on your machine. Nothing is ever uploaded.

Built from a vision document ([docs/VISION.txt](docs/VISION.txt)) whose golden rules are
non-negotiable: **never guilt · presence over conversation · memory over motivation ·
small moments over loud ones · warmth over efficiency.**

---

## What it does

### The soul
- **First meeting** — pick a companion, name it, answer one question ("what are you
  building right now?"). That answer becomes your first shared memory.
- **Presence** — it mostly sits beside your work in silence, wanders, dozes off when
  ignored (still sprite + breathing), and gives time-aware greetings. Gone a few days?
  "Welcome back." — never guilt.
- **Mood check-in** — six emoji, optional note, 30 seconds. The room takes the mood's tint.
- **"We've been here before"** — log a mood you felt weeks ago and it surfaces *that*
  memory instead of generic comfort.
- **Remind Me Who I Am** — proof you're growing: things survived, things learned, wins you forgot.
- **Our Journey** 📖 — a living scrapbook: every memory on a monthly timeline, plus your
  **bond depth** (Stranger → Familiar → Trusted Friend → Companion → Partner → Lifetime
  Companion, earned through time *and* genuine interaction).
- **Badges** 🏅 — 17 emotional milestones (Still Standing, Builder's Courage, CUDA Survivor…),
  never productivity metrics.
- **Good Things Jar** 🫙 — open it on a hard day; it hands you back old wins and good days.
- **Leave a note** ✉️ — write to tomorrow-you; the pet reads it back next time.
- **Gentle awareness** — burnout noticing (never a diagnosis), a "reach out to someone?"
  nudge after long sessions, a quiet Sunday retrospective, anniversaries with fireworks.
- **Lonely Night Mode** — after midnight the room dims and a moon appears.
- **Focus Mode** 🎯 — one toggle; the pet stays, every sound and line stops.

### The fun
- **Full Pokédex** (all 1025) — switch companion via search, type & generation filters,
  a random picker, or an auto-switch timer. **1/128 shiny odds.**
- **Ash throw ceremony** — recall beam → trainer winds up → *"<Name>, go!"* → the ball
  arcs in spinning → bursts open. Real Pokémon cries; real Ash voice clips.
- **Real movesets & typed attacks** — each Pokémon uses its actual learnset; beams,
  energy orbs, lightning strikes, earthquakes, slashes — keyed to the move.
- **Wander & play** — walks, runs, hops, jumps, spins, zoomies; a butterfly flutters by
  and the pet chases it; wild Pokémon occasionally wander through.
- **1v1 Battle Arena** ⚔ — pick two fighters; real base stats, the full 18×18 type chart,
  STAB, crits, speed-based turn order, damage numbers, draining HP bars, and confetti.

---

## Stack

| Layer | Choice |
|---|---|
| Shell | **Tauri 2** — ~10MB native window, transparent / frameless / always-on-top |
| UI | **SvelteKit (Svelte 5) + TypeScript** |
| Memory | **SQLite** via `tauri-plugin-sql` — local-first, never leaves the machine |
| Brain | scripted emotional engine (no LLM required); Claude/Ollama layer is future, opt-in |
| Sprites & data | PokéAPI (sprites, cries, movesets, base stats) — personal use |

## Run

```sh
npm install
npm run tauri dev      # develop
npm run tauri build    # standalone .exe
```

Requires Rust + MSVC build tools (Tauri prerequisites) and the WebView2 runtime
(preinstalled on Windows 11).

## Where your data lives

`%APPDATA%/com.hearthmon.app/hearthmon.db` — a SQLite file. Two tables: `memories`
(moods, wins, things learned/survived, letters, your seed answer) and `meta` (companion
identity, bond counters, settings). Back it up and it's your whole journey.

## Voice (optional, personal use)

Drop real audio clips into [static/voice/](static/voice/) and they play instead of TTS:
`go.mp3` (throw line), `go-<species>.mp3` (per-species), `<species>.mp3` (name calls).
`tools/caption_split.py` auto-cuts and labels clips from any audio file you own.
Local voice **cloning** (`tools/clone_voice.py`, XTTS v2) is written but currently blocked
on Windows — see [TODO.md](TODO.md#-known-issues--blockers).

## Project docs

- [docs/VISION.txt](docs/VISION.txt) — the full product-soul document
- [docs/product-map.png](docs/product-map.png) — the system at a glance
- [TODO.md](TODO.md) — what's done, what's next, and the brainstorm backlog

## License & use

Personal project. Pokémon sprites, cries, names, and any supplied/cloned voice audio are
Nintendo / The Pokémon Company / voice-actor IP — **personal use only, never redistribute.**
The sprite layer ([src/lib/sprites.ts](src/lib/sprites.ts)) is swappable for original art
if this ever goes public.

🤖 Built with [Claude Code](https://claude.com/claude-code)
