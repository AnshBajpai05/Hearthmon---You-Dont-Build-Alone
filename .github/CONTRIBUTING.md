# Contributing to Hearthmon

Thanks for looking under the hood. 🌙 Hearthmon is a small, personal, **non-commercial fan project** — it's open source so you can read it, learn from it, and build your own thing on the MIT-licensed code. Contributions are welcome but light-touch; there's no roadmap pressure here.

## First: the soul

Read **[SOUL.md](../SOUL.md)**. Hearthmon has hard rules about what it must never become — no guilt, no streaks, no nagging, no fake-therapy language, nothing that phones home. A change that's technically fine but breaks the soul won't be merged. [`docs/EMOTIONAL_SAFETY.md`](../docs/EMOTIONAL_SAFETY.md) has the banned-phrases / emotional-territory map, and [`TODO.md`](../TODO.md) ends with an explicit **Anti-Features — Never Add** list.

## Build & run

Windows-first (Tauri 2 + WebView2 + WASAPI / Win32 awareness).

```bash
npm install
npm run tauri dev      # develop
npm run check          # svelte-check — keep it 0 errors / 0 warnings
npm run tauri build    # standalone build (unsigned; the signed release pipeline needs private keys you won't have)
```

Rust backend: `cd src-tauri && cargo check`.

## Helpful

- Bug fixes with a clear repro.
- Cross-platform work — macOS/Linux build the shell today; awareness/music are Windows-only.
- Docs and typo fixes.

## Please skip

- Anything on the Anti-Features list in [TODO.md](../TODO.md).
- Bundling or redistributing Pokémon sprites, cries, names, or voice audio — those aren't ours to license (see [LICENSE](../LICENSE)).

## Reporting

Open an issue with the template. It's a local-first app, so please include your OS and whether you're on the **Classic** or **Alive** renderer.
