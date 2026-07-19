# Issues Fixed from Previous Runs

Coming into:
- Hearthmon---You-Dont-Build-Alone (v2)
- Hearthmon-Trial_Beta (main)

- Unbounded `read_to_end` OOM - Fixed 2026-06-16
- Permanent future-clock lockout - Fixed 2026-06-17
- `fetch` defeats `--force-with-lease` - Fixed 2026-06-16
- Admin Drop + no Unix impl - Fixed 2026-06-17
- Worktree `.git` file + monorepo polling - Fixed 2026-06-17
- Audio device-invalidation + slow AGC - Fixed 2026-06-17
- Missing database indexes - Fixed 2026-06-17
- Card amend self-triggers commit watcher - Fixed 2026-06-16
- Watchers never pause when hidden - Fixed 2026-06-16
- 260-wchar path truncation - Fixed 2026-06-17
- Newest-file-any-type log read - Fixed 2026-06-17
- Local vs UTC day boundary - Fixed 2026-06-17
- `ORDER BY RANDOM()` full scan - Fixed 2026-06-17
- No WAL / `busy_timeout` - Fixed 2026-06-16
- Non-atomic `bumpCounter` - Fixed 2026-06-17
- Vestigial `gpu_stat` - Resolved 2026-06-17
- Reminders: same-minute collision drops all-but-one - Fixed 2026-06-17
- Reminders: no missed-fire catch-up (window-based fire on relaunch) - Fixed 2026-06-18
- Reminders override Focus / Just-There (a promise the app made) - Decided 2026-06-18
- Card mirror force-pushes an active branch (dirty-tree guard on push_card) - Fixed 2026-06-18
- Alive globe sprite cost (~5000/frame) - 30fps throttle on galaxy + ring loops - Fixed 2026-06-18
- Feb-29 birthday only celebrates on leap years (sameAnnualDay fallback) - Fixed 2026-06-18
- Auto-update: failed install blocks same-day retry (clears once-per-day guard) - Fixed 2026-06-18

## Mega Evolution + Combat Identity v4 — 2026-06-20

- Mega sprites Showdown-NAME → PokeAPI form-IDs (CORS → ANIMATED in Alive, not static) - Fixed 2026-06-20
- Mega static fallback dropped to the BASE form (form-aware formFallbackUrl) - Fixed 2026-06-20
- Mega flat ellipse aura → real fire (rising tongues + hot core + embers, additive) - Fixed 2026-06-20
- Mega Charizard X washed/orange → FORM_FLAME blue (one colour drives aura + attacks + irritate) - Fixed 2026-06-20
- Flamethrower flat 2-layer cone → 4-layer flame gradient (both skins) - Fixed 2026-06-20
- Fire-type biome fire double-stacked with mega fire (suppressed while mega) - Fixed 2026-06-20
- Mega now dictates the room atmosphere (hearth-style) + hover stokes it - Added 2026-06-20
- Mega/form change re-paints the globe → washed-sphere (round-trip on megaForm) - Fixed 2026-06-20
- v4 archetypes 8→26 (AnimFamily × AnimKind × VARIANT) across all 3 renderers - Added 2026-06-20
- v4 per-species overrides (combat_overrides.ts, merged into animKind) - Added 2026-06-20

## Audio Awareness → YAMNet speech/music vote — 2026-06-20

- Audio reactivity FROZE while paused (WASAPI stops callbacks → musical=1.00 stuck, orb keeps "reacting" to nothing) → JS staleness watchdog resets audio state after 800ms of no frames - Fixed 2026-06-20
- Paused/silent audio AGC-amplified into "loud" (peak decays to floor → hiss normalised up) → Rust silence gate emits zeros below ~-60dBFS - Fixed 2026-06-20
- Speech (talking YouTube video) read as MUSIC — heuristics provably can't separate them (blind A/B: voiceish ~0.32 for both); wired the previously-unused `_voiceish` to gate the steady-music vote as a stopgap - Fixed 2026-06-20
- Speech-vs-music SOLVED with YAMNet (SOTA): MobileNet core exported to ONNX, log-mel front-end hand-written in Rust, runs via pure-Rust `tract` (no native DLL, audio never leaves the process), validated raw-wav→scores against TensorFlow to 1.2e-5; emits `audio-class (music,speech)` as a strong vote in `momentScore` - Added 2026-06-20
- Live-test bug: resampler off-by-one (15599 < 15600 patch) → classify always None; fixed with +64 sample headroom - Fixed 2026-06-20
- Live-test bug: ndarray panic scalar-indexing the [1,521] output; fixed by flattening to Vec before indexing - Fixed 2026-06-20
- Dev HUD: `🎶/🗣️ mus/spch` readout, quickbar 🎶 toggle (persisted, dev-only), auto-hides while hovering so it never overlaps the quick tray / transparency slider / radial menu - Added 2026-06-20
