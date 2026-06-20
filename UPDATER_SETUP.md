# Hearthmon Auto-Update — setup & release guide

V2's first online feature. Friends install once from GitHub Releases; every future build is
detected in-app on launch and installed with one click — memories, settings, and companion all
preserved (only the program files change). Built on the official **Tauri 2 updater**.

How it behaves (already wired in the app):
- **Checks on launch only** (no background polling). Surfaces the card **at most once per calendar
  day** — two relaunches in one afternoon won't double-pop.
- **Update now / Later.** "Later" just closes it; it asks again on another day. Never nags.
- **On the latest version → nothing.** No popup, no notification, no chatter.
- **First launch after an update**, Poki's lead line is *"It feels better with this update."* once,
  with a quiet **What's new** chip (notes pulled from the GitHub Release body).

---

## One-time setup (do this once, ever)

### 1. Generate the signing keypair
From `hearthmon/`:

```sh
npm run tauri signer generate -- -w ../hearthmon_updater.key
```

This writes the **private key** to `../hearthmon_updater.key` (one level up — outside the repo,
already gitignored) and prints the **public key**. If you set a password, also save it:

```sh
# optional, only if you chose a password at generate time
echo your-password-here > ../updater_key_password.txt
```

> ⚠️ **Never commit these.** Rotating the key invalidates **every** existing update signature and
> forces all friends to reinstall manually. Back it up somewhere safe (password manager).

### 2. Paste the public key into the app
Open `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` and replace
`REPLACE_WITH_UPDATER_PUBKEY_FROM_tauri_signer_generate` with the public key string from step 1.

That's it. The endpoint is already set to this repo's Releases.

---

## Per-release checklist (≈ 2 minutes)

1. **Bump the version** in BOTH (they must match — this is what the updater compares):
   - `src-tauri/tauri.conf.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
   (Semver, e.g. `0.1.0 → 0.2.0`. Separate from the "V2" product name.)
2. **Build the signed friend edition:** run `built_friends.bat`.
   It produces `dist/release/` containing the **NSIS installer**, **`latest.json`**, and the guides.
3. **Create a GitHub Release** on `AnshBajpai05/Hearthmon-Trial_Beta`:
   - Tag: **`v<version>`** (e.g. `v0.2.0`) — must match the version, with the `v` prefix.
   - Upload the **installer** and **`latest.json`** from `dist/release/` as assets.
   - Write the release notes in the body → that's what powers the in-app **What's new**.
   - **Publish** (not a pre-release, so `/releases/latest/download/latest.json` resolves).

Done. Friends on an older build get the update card next time they launch.

---

## Notes & gotchas
- **First updater-enabled build is still a manual download.** Auto-update only works *from that
  build forward* — friends grab `v<first>` by hand once, then never again.
- **SmartScreen / Kaspersky.** The installer is minisign-signed (satisfies the updater) but not
  Authenticode-signed, so SmartScreen may warn on first install, and AV may flag an app that
  launches an installer. Expected for a trusted-friends beta — "More info → Run anyway".
- **Founder build** (`built_me.bat`) also needs the key present (artifact signing is global), but
  doesn't auto-update — you always build the latest yourself, so the card never appears for you.
- **Cross-platform later:** `tools/make_release.ps1` writes a Windows-only `latest.json`; add
  `darwin-*` / `linux-*` platform keys there when you ship those. Forward-compatible, no rework.
- **Data safety:** the SQLite DB, memories, and the chapter store live in `%APPDATA%` / `HKCU` and
  are untouched by an NSIS *update* (only an uninstall would remove them).
