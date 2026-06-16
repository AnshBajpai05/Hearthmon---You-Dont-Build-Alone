# secure_Hearthmon — Chapter Access Implementation Plan (v2)

> Status: design-locked, not yet built. Branch target: `v2`.
> Owner: Ansh. Build gate: `npm run check` (0/0) **and** `cargo check` must stay green.
> v2 changes: frozen-core / editable-config split · serious anti-RE hardening ·
> Ansh's 4 decisions folded in · trusted-builders fixed to be spoof-proof.

A device-bound, fully-offline "Chapter" system that pauses the experience after a free
first chapter and reopens it with a free **builder pass** — a handshake, not a paywall.

---

## 0. Read this first — the security reality

This is a **community ritual with teeth**, not anti-piracy DRM. Three truths shape every
decision below; ignore them and you'll build something that cracks in minutes.

**Truth 1 — The webview frontend is not securable.** The Svelte/JS bundle is readable and
editable on the user's disk. If "locked" is just a CSS dim driven by a JS boolean, a smart
friend flips it in ~2 minutes and your crypto never runs. **The decision MUST live in Rust;
the frontend `chapterPaused` flag is an untrusted rendering hint, never the gate.**

**Truth 2 — Self-asserted identity is unverifiable offline.** A GitHub *username* typed into
a box proves nothing without a server. Any "trusted by username" list is cracked by *typing
the trusted name*. Trust is keyed by **machine hash** only (see §6).

**Truth 3 — Offline has a finite ceiling.** The HMAC secret ships inside the binary. With the
hardening in §5 the *casual* attacks (copy a pass, edit registry/file, roll the clock, flip
the JS bool, `strings` the secret) are all dead. A friend who reverse-engineers an obfuscated
Rust binary and patches the branch can still win — **offline, that's unfixable without a
server, which we reject for the offline/privacy soul.** Goal: turn "crack in 5 minutes" into
"needs real RE skill + hours." At that point it's a trophy, not casual sharing.

**Why it lives next to the SOUL.** Golden rules (`docs/VISION.txt`, `docs/EMOTIONAL_SAFETY.md`)
are non-negotiable: *never guilt, presence > conversation, the companion never leaves.* This
survives them on one condition:

> **There is no money in this. The pass is free. The only "cost" is saying hello.**

Design laws that earn the feature its place:
1. **The pet never becomes a hostage.** During the pause it stays *fully alive* — breathes,
   reacts, can be petted. Only the *habitat* dims. It's keeping you company while it waits.
2. **No guilt language.** No "trial expired", no countdowns, no "upgrade now", no red.
3. **Never block the exit.** Close-to-tray, quit, dismiss all keep working while paused.

---

## 1. Frozen core vs. editable config (READ BEFORE YOU TOUCH ANYTHING)

You wanted to "edit and build again" without breaking the lock. So the code is split in two,
and the boundary is sacred:

| | **CONFIG — edit freely, rebuild** | **CORE — frozen, security-sensitive** |
|---|---|---|
| Where | `src-tauri/src/chapter/config.rs` (one `const` block) | `src-tauri/src/chapter/{crypto,state,gate}.rs` |
| What | durations, grace, nudge thresholds, trusted machine hashes, copy keys | machine hash, AEAD encrypt/verify, HMAC verify, the gate decision |
| Rule | change a number, `cargo build`, done — nothing else moves | don't touch without re-running the full §8 test plan |

**To change the chapter length / grace / nudges:** edit the consts in §1.1, rebuild. That's
the whole workflow. The crypto, state format, and verification never change, so old installs
and the admin script keep working across rebuilds (as long as the **secret** is unchanged —
see §3).

### 1.1 The config block (`chapter/config.rs`)
```rust
//! EDIT THESE. Rebuild. The core does not move.
pub mod cfg {
    // ── Durations (all in days) ─────────────────────────────────────────
    pub const CORE_DAYS:        i64 = 7;   // full, uninterrupted chapter
    pub const GRACE_DAYS:       i64 = 3;   // after core: still full, quiet soft-lines, NO dim
    pub const FORGIVENESS_DAYS: i64 = 1;   // invisible pad on every pass expiry (§ decision 3)
    // → initial chapter pauses on launch at day CORE+GRACE+1  (7+3+1 = day 11)

    // ── Soft-line nudges during grace (days 8–10) ───────────────────────
    pub const GRACE_LINE_KEYS: &[&str] = &["grace_a", "grace_b", "grace_c"]; // → src/lib/lines.ts

    // ── Paused-launch nudge fade (§ decision 4) ─────────────────────────
    pub const NUDGE_FULL_UNTIL:  u32 = 1;  // launch 1 after pause → full warm card
    pub const NUDGE_SMALL_UNTIL: u32 = 4;  // launches 2–4 → compact card
    // launch 5+ → quiet: dim habitat + tiny corner "Builder pass available"

    // ── Trusted builders (machine-hash keyed, NOT usernames — see §6) ───
    // collect a friend's HM-XXXXXXXX once, paste the 8 hex here, they auto-extend.
    pub const TRUSTED: &[(&str, TrustGrant)] = &[
        // ("7x9k2p4m", TrustGrant::Forever),
        // ("a3f10b22", TrustGrant::Days(90)),
    ];
    pub enum TrustGrant { Forever, Days(i64) }
}
```
> Everything tunable lives here. If you find yourself editing `crypto.rs` to change a
> duration, stop — it belongs in `config.rs`.

---

## 2. Architecture overview

```
                         ┌──────────────────────────────────────────────┐
                         │  Rust CORE (src-tauri/src/chapter/*)           │
  onMount ─chapter_status()─▶ load+DECRYPT state (registry + file)        │
                         │   ├─ AEAD verify (tamper → treated as missing) │
                         │   ├─ heal missing/forged store from the other  │
                         │   ├─ effective_now = max(now, last_seen)       │
                         │   ├─ persist last_seen (encrypted)             │
                         │   ├─ trusted-hash check → maybe auto-extend    │
                         │   └─ decide phase: full | grace | paused       │
                         │                                                 │
  paste pass ─submit_builder_pass─▶ verify HMAC vs machine_hash           │
                         │   └─ ok: write new (encrypted) expiry to BOTH  │
                         └──────────────────────────────────────────────┘
        ▲                                                        │
        │  HM-XXXXXXXX (machine hash)            PASS-YYMMDD-XXXXXXXX
        │                                                        │
   +page.svelte ──── mailto: draft ────▶ Ansh ──── generate_pass.ps1 ─────┘
   (renders the dim from the Rust decision; never decides locally)
```

New module `src-tauri/src/chapter/`: `config.rs` (editable), `crypto.rs`, `state.rs`,
`gate.rs`, `mod.rs` (the two `#[tauri::command]`s). **No existing system is modified, only
gated.** Plus `tools/generate_pass.ps1`.

---

## 3. Cryptography & identity (CORE — frozen)

### Machine hash (the hidden binding)
```
machine_guid = HKLM\SOFTWARE\Microsoft\Cryptography → "MachineGuid" (string, read-only, no admin)
machine_hash = lowercase_hex( SHA-256( utf8(machine_guid) ) )[0..8]   // 8 hex = 32 bits
request_code = "HM-" + uppercase(machine_hash)                        // e.g. HM-7X9K2P4M
```
> Reading MachineGuid is standard, benign (Steam/Unity/Spotify do it) — no AV flag. 32 bits is
> ample for *binding*; a collision just means two machines could share a pass — irrelevant.

### Builder pass format
```
PASS-YYMMDD-XXXXXXXX
      │      └─ sig = uppercase( lowercase_hex( HMAC_SHA256(SECRET, msg) )[0..8] )
      └──────── calendar date. 999999 = permanent.
msg = machine_hash + yymmdd        // lowercase hash, no separator, UTF-8
```
**Byte contract (Rust ⇄ PowerShell must match exactly):** lowercase hash, no separator,
`yymmdd` literal 6 chars, HMAC over UTF-8, first 8 hex of the **lowercase** digest, uppercased
for display. One shared test vector, checked both sides, before anything else.

### The secret (decision 2: build-time `env!`)
```rust
// compiled in at build time, never in the repo; obfuscated so `strings` can't find it
static SECRET: &[u8] = obfstr::obfbytes!(env!("HEARTHMON_PASS_SECRET").as_bytes());
```
Set `HEARTHMON_PASS_SECRET` (≥ 32 random bytes) in your build environment and in the admin
script's environment — same value. **Keep it constant forever**: rotating it invalidates every
outstanding pass *and* makes every existing encrypted state blob undecryptable (forces re-init).

---

## 4. State: encrypted, authenticated, dual-store (CORE — frozen)

Plaintext state was the soft underbelly of v1 — a friend just edits `Expiry=2099`. v2 stores
an **encrypted, authenticated** blob in two places.

| Field         | Meaning                                          |
| ------------- | ------------------------------------------------ |
| `first_launch`| Unix secs (UTC), set once                        |
| `expiry`      | Unix secs (UTC) — the real pause boundary        |
| `last_seen`   | Unix secs (UTC), monotonic, anti-rollback        |
| `kind`        | trial \| pass \| trusted \| forever              |

- **Serialize** `ChapterState` → bytes → **AEAD encrypt** (`chacha20poly1305` or `aes-gcm`)
  with `key = HKDF(SECRET, salt = machine_hash)`, random 12-byte nonce stored alongside the
  ciphertext. The AEAD auth tag is the tamper check — **no separate HMAC needed.**
- **Store A — Registry:** `HKCU\Software\Hearthmon`, value = base64(nonce‖ciphertext‖tag).
- **Store B — File:** `<app_data_dir>\.hm_chapter` (Tauri `app.path().app_data_dir()`,
  identifier `com.hearthmon.app` — where SQLite already lives), same bytes.

**Consequences of AEAD + machine-bound key:**
- Editing either store → tag fails → treated as *missing/forged*, healed from the other.
- Forging a blob → impossible without the secret. Editing the registry to extend = dead.
- Copying a valid blob from another machine → undecryptable (key is bound to *this* hash).

**Heal & cross-check each boot:** one missing/forged → rebuild from the other; both valid but
disagree → take the **earlier** (conservative) `expiry` and re-sync. Never reward the higher
value — that's the cheat.

**Clock rollback:** `effective_now = max(now, last_seen)`; persist `last_seen = effective_now`.
You can't gain time by rolling back, and a legit drift isn't a hard lock. (Gentle, on-soul.)

**Grace timeline (decision 1) — computed in Rust:**
```
day 1 .. CORE_DAYS                    → phase = full
CORE_DAYS+1 .. +GRACE_DAYS            → phase = grace   (full function, quiet soft-line, NO dim)
> CORE_DAYS+GRACE_DAYS  (on launch)   → phase = paused  (dim)
```
For **pass** expiries (decision 3): interpret `YYMMDD` as **end of that day in the USER's local
timezone**, then add `FORGIVENESS_DAYS` invisibly. Internals stay UTC epoch (robust math); only
the boundary lands at the user's local midnight + 1 quiet day. No countdown, no "1 day left" —
it just feels like *"he waited for me."*

---

## 5. Anti-reverse-engineering hardening (the "lock it seriously" part)

Tiered by effort vs. payoff. **Build Tier 1 + Tier 2 now.** Tier 3 only if a friend actually
beats them.

### Tier 1 — kill the casual attacks (cheap, do it now)
- **Encrypted+authenticated state** (§4) → editing registry/file/clock to extend = useless.
- **Obfuscated secret** (`obfstr`, §3) → `strings`/`rabin2 -z` reveal nothing.
- **Key bound to machine hash** → stolen blobs don't port.

### Tier 2 — make the gate Rust-only and patching annoying (recommended now)
- **Decision lives only in Rust.** Frontend gets the phase as a hint for rendering; it can't
  *grant* itself anything by lying (there's nothing to grant — see Tier 3 note).
- **Redundant, non-obvious checks.** Don't gate on one `if is_paused` — recompute the decision
  in 2–3 scattered spots (status, on pass submit, on a quiet re-check) so one patched branch
  isn't a full win. Use a constant-time compare for the signature.
- **Disable devtools in the release build** (Tauri: don't enable the `devtools` feature for
  release). Cheap, stops the laziest bypass (open console, poke state).
- **Ship minified production JS** (vite build already does) — raises the bar to read the bundle.

### Tier 3 — real teeth (only thing that defeats binary-patching; expensive, NOT now)
The brutal truth: if "paused" only means a cosmetic dim, a determined friend patches the Rust
branch or re-enables the dim and wins — because the app already has everything it needs locally.
The *only* way to make the lock non-cosmetic is to **withhold real data**: ship a load-bearing
asset/data pack AEAD-encrypted, decrypt it in Rust **only** when state is valid, never to disk.
Patch the bool all you want — without the key you don't have the bytes.
- **Why not now:** nearly everything load-bearing in Hearthmon is local JS/static assets, and
  the natural "premium" layer (voice in `static/voice/`) is personal/gitignored. Encrypting
  bundled JS + decrypting via Rust is heavy and fragile, and hard-gating content pushes against
  the soul. Document it, revisit only if T1+T2 are actually defeated.
- **If you do it:** gate the *rich habitat / ambient / rare-event* asset pack, not the pet. The
  habitat then goes dark *for real* (data absent), the pet stays — which is exactly the dim you
  wanted, now enforced. Product call, not a code call — flag for Ansh.

### Explicitly NOT doing (false security, real downsides)
- Binary self-checksum / anti-debug traps → false positives on legit machines, AV suspicion,
  and skilled friends strip them anyway. Not worth the support pain.
- Auto-email / phone-home → embedded credential (extractable) or a server (cost) and the one
  behavior that *would* trip a firewall. mailto stays offline.

---

## 6. Trusted builders (decision: spoof-proof by machine hash)

Your "wow, he remembered me" idea — done so it can't be cracked by typing a name.

- A friend sends their `HM-XXXXXXXX` once. You paste the 8 hex into `cfg::TRUSTED` (§1.1) and
  rebuild. That machine now auto-extends (Forever or N days) on every launch — they never ask
  again.
- **Why hash, not username:** username is self-asserted; "trusted by username" = "type the
  name to unlock." Machine hash is bound to *their* hardware and verified in the gate, so it
  can't be spoofed.
- It's compiled into the binary (alongside the obfuscated secret), so the list isn't a
  user-editable file. Adding yourself = recompiling = you already have the source.

---

## 7. Frontend (`src/routes/+page.svelte`) — renders, never decides

### Trial awareness model (2026-06-15 — Ansh's call; still NO daily countdown)
The trial is made known honestly, without ever nagging. Three beats, gated by SQLite meta:
- **First run, once** (`chapter_intro_shown`): a warm heads-up that this is a ~week-long first
  chapter (`chapterIntroLines`). Fires for new users in `onMeetingDone` (delayed after the
  welcome) and for existing installs on first launch post-update.
- **Days 1..5 (full):** total silence. No reminders, no "N days left." (Decision 3 holds.)
- **Grace days 6–7:** one quiet ~45s ambient bubble per calendar day (`graceLines`, indexed by
  `grace_index`), gated by `chapter_remind_day`. The emotional tail — no ask yet.
- **Pause:** the card carries the only ask (`pauseNoteLine`).
Backend exposes `has_end` so Forever/Trusted machines never hear any of this. Logic lives in
`loadChapterStatus()` + `chapterAwareness(delayMs)`.

### State + onMount
- `let chapterPaused = $state(false); let chapterPhase = $state<"full"|"grace"|"paused">("full");`
  near `phase` (`+page.svelte:177`). **Remove any mid-session expiry timer** — evaluated only at
  boot; an expiry mid-session lets the user finish uninterrupted (soul).
- In onMount (`+page.svelte:2004`), before `phase = "home"` (line 2104):
  ```ts
  try {
    const s = await invoke<ChapterStatus>("chapter_status");
    chapterPhase  = s.phase;            // "full" | "grace" | "paused"  (Rust decides)
    chapterPaused = s.phase === "paused";
    requestCode   = s.request_code;
    if (s.phase === "grace") say(graceLine(s.grace_index), 9000); // quiet soft-line
  } catch { /* dev/browser, no Tauri → full */ }
  ```
  Still set `phase = "home"`; the pet renders normally underneath.

### The dim + the note (parity: Classic *and* Alive)
- **Classic** (`.stage`): `class:chapter-dim={chapterPaused}` → `filter: grayscale(.7)
  brightness(.55); transition: filter 1.2s ease;` pet stays bright.
- **Alive** (`PixiStage.svelte`): `dimmed` prop → lower habitat/ambient alpha + desaturate via
  the existing lighting path; pet near-full brightness. No new shader.
- **Nudge fade (decision 4)** keyed off a `paused_launches` counter in `cfg`:
  - launch 1 → full warm dismissible card.
  - launches 2–4 → compact card.
  - launch 5+ → no card; just the dim + tiny corner text *"Builder pass available"*.
- Copy (full card): *"Looks like our first chapter wrapped up. If you'd like me to stick around
  a little longer, send over your builder card — I'll be right here."*

### Handshake flow (in the card)
1. **GitHub username** input (enables next step; for *your* records only — see Truth 2, it
   grants nothing by itself).
2. **"Show my request code"** → reveals `requestCode` + Copy. (Machine read happens only behind
   this explicit click.)
3. **"Email Ansh"** → `mailto:` via `tauri-plugin-opener` `open()`:
   `mailto:anshbajpai2005@gmail.com?subject=Hearthmon%20Chapter%20Request&body=Hi%20Ansh!%0AGitHub:%20<u>%0ARequest%20code:%20<HM-XXXXXXXX>`
4. **"Paste your builder pass"** → `await invoke("submit_builder_pass", { passCode })`.
   - ok → `chapterPaused=false`, lights fade in (1.2s), warm line, card closes.
   - err → friendly inline copy (`"that pass doesn't fit this device"` vs `"that doesn't look
     like a pass"`); never surface the raw `Err`.

### Guards
- Disable buttons on empty fields; card dismissible every launch; never loop-prompt; never
  block close-to-tray/quit.

---

## 8. Admin tool — `tools/generate_pass.ps1`
```powershell
# .\generate_pass.ps1 -RequestCode HM-7X9K2P4M -Days 14
# .\generate_pass.ps1 -RequestCode HM-7X9K2P4M -Forever
param([Parameter(Mandatory)][string]$RequestCode,[int]$Days,[switch]$Forever)
$secret = $env:HEARTHMON_PASS_SECRET                       # same value as the Rust build
if (-not $secret) { throw "set HEARTHMON_PASS_SECRET" }
$machineHash = ($RequestCode -replace '^HM-','').ToLower()
$yymmdd = if ($Forever) { "999999" }
          else { (Get-Date).AddDays($Days).ToString("yyMMdd") }  # calendar date; app applies local-tz + forgiveness
$msg  = $machineHash + $yymmdd
$hmac = [Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
$sig  = ([BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($msg))) `
          -replace '-','').ToLower().Substring(0,8).ToUpper()
$pass = "PASS-$yymmdd-$sig"; $pass | Set-Clipboard
Write-Host "Pass (copied): $pass"
# Optional: Add-Content passes.log "$(Get-Date -f s)  $RequestCode  $pass  $(if($Forever){'forever'}else{"$Days d"})"
```
> The app interprets `YYMMDD` as end-of-day in the **user's** local tz + `FORGIVENESS_DAYS`, so
> the script doesn't need their timezone. Helper idea: `-PrintTrustedLine` to emit a ready
> `("7x9k2p4m", TrustGrant::Forever),` row to paste into `cfg::TRUSTED`.

---

## 9. Build verification (must stay green)
```
cd hearthmon            && npm run check     # svelte-check → 0/0
cd hearthmon/src-tauri  && cargo check       # ~16s incremental
```
> Kaspersky can block executing freshly-built cargo build-scripts in `target\` (Access denied).
> If `cargo check` fails there, pause protection or exclude `src-tauri\target` for a clean build.

New deps: `winreg`, `sha2`, `hmac`, `hex`, `obfstr`, an AEAD (`chacha20poly1305` *or*
`aes-gcm`), `hkdf`, `getrandom` (for nonces). Mirror the existing `#[cfg(windows)]` pattern.

---

## 10. Test plan
1. **Cold boot** → straight into Chapter 1. Confirm registry + `.hm_chapter` created and the
   blob is **opaque** (base64, not readable key=value).
2. **Heal:** delete the registry value → relaunch → rebuilt from file; repeat the other way.
3. **Forge:** flip any byte of the file blob → relaunch → AEAD tag fails → treated as missing,
   healed; no extension gained.
4. **Disagreement:** make the two stores differ → app takes the earlier expiry, re-syncs.
5. **Grace:** set state to day 8–10 → full function + quiet soft-line, **no dim**. Day 11 launch
   → dim. Confirm dim only on relaunch, never mid-session; pet still animates while dimmed.
6. **Nudge fade:** force paused launches 1 / 3 / 6 → full card / compact card / quiet corner.
7. **Request code** stable across runs; Copy works; **Email Ansh** opens prefilled mailto, no
   network leaves the app.
8. **14-day pass** → accepted, lights fade in, expiry ≈ +14d (+forgiveness) in both stores.
9. **Forever pass** (`999999`) → permanent, `is_paused` false.
10. **Clock rollback** → `effective_now` clamps to `last_seen`; no free time, no hard lock.
11. **Wrong-machine pass** → rejected, friendly copy, no state change.
12. **Trusted hash:** add this machine's hash to `cfg::TRUSTED`, rebuild → auto-extends with no
    prompt. Confirm a *username* in the box alone grants nothing.
13. **`strings hearthmon.exe | grep -i <secret>`** → nothing (obfstr working).
14. **Soul check:** read every string aloud — any guilt/urgency/"upgrade" tone → rewrite vs
    `src/lib/lines.ts`. Confirm close-to-tray and quit work while paused.

---

## 11. What changed vs. v1 / the original plan
- **Frontend can't decide** — gate moved entirely to Rust; JS flag is a render hint (Truth 1).
- **State is encrypted + authenticated, machine-bound** — kills all "edit a number" attacks.
- **Secret via `env!` + `obfstr`** — out of the repo, invisible to `strings`.
- **Trusted builders keyed by machine hash, baked in** — your idea, made spoof-proof (Truth 2).
- **Frozen-core / editable-config split** — tune durations & rebuild without touching crypto.
- **Grace + forgiveness folded in** (7 core + 3 quiet grace, local-tz expiry + 1 invisible day).
- **Smart nudge fade** (full → compact → quiet corner).
- **Tier 3 honestly scoped** — the only real defeat for binary-patching, deferred on purpose.

---

## 12. Decision: locked — **Tier 1 + 2** (2026-06-15)
Casual attacks dead (encrypted machine-bound state, obfuscated secret, Rust-only decision,
no-devtools release); binary-patching still possible but needs real RE + hours, not casual
sharing. Proportionate for "smart friends," keeps the offline soul, ships fast. **Tier 3
(real data-withholding) is deferred** — revisit only if a friend actually defeats T1+2.

Everything in this doc is now settled and ready to implement.

### Build order (incremental, keep both gates green at each step)
1. Cargo deps + new `src-tauri/src/chapter/` module (`config.rs`, `crypto.rs`, `state.rs`,
   `gate.rs`, `mod.rs`); `cargo check`.
2. Wire the two commands into `generate_handler!` (`lib.rs:713`); `cargo check`.
3. Frontend: onMount call + `chapterPhase`/`chapterPaused`, dim (Classic + Alive), the card,
   nudge fade; `npm run check`.
4. `tools/generate_pass.ps1` + shared test vector; verify Rust ⇄ PowerShell agree.
5. Full §10 test plan.

> **Secret handling for builds:** `crypto.rs` reads `HEARTHMON_PASS_SECRET` via `option_env!`
> with a clearly-marked dev fallback so `cargo check`/dev builds work without it. A `build.rs`
> guard (or a release-only `compile_error!` when the env is unset) ensures **release** builds
> can't ship the dev secret. Pick the real secret once and keep it forever (§3).

---

## 13. Founder's Mark — authorship (2026-06-15)

Two layers; identity = **AnshBajpai05**.

- **Visible (deterrence, editable):** a faint signature *woven into the habitat*, both renderers,
  revealed after ~12s at ~0.1 opacity — "signature art direction," never a watermark. Classic:
  `.founder-mark` span inside `.roombg` (dims with the room). Alive: a `Text` in `scene`
  (clips to globe, dims with habitat). Phrasing is biome-adaptive via `src/lib/founder.ts`
  (`founderMark(seed)`). **It is deletable in a fork — accepted by design.**
- **Invisible (the real proof, unforgeable):** `founder_mark()` Tauri command returns signed
  provenance — `founder`/`handle` (`obfstr`'d), `build_ts` + `git_commit` (stamped by `build.rs`),
  `origin_hash`, and an HMAC-SHA256(secret, origin) `signature`. A forker can strip the visible
  mark but cannot forge this without the secret, so original lineage is always provable.
- **Rare signature whisper:** ~1/100 idle murmurs (`FOUNDER_WHISPER_ODDS`), the mark "speaks" for
  ~30s ("quietly built by anshbajpai05 ✦"), behind the same quiet guards. `src/lib/founder.ts`.
- **Provenance reveal (for disputes):** click the woven Classic signature → a panel showing the
  signed lineage (founder · handle · build date · commit · origin hash · signature) + Copy. Never
  auto-shown. This is how you *demonstrate* authorship live (e.g. placement-season theft).

### Builder registry + living badge (manual, zero telemetry)
Hearthmon never phones home — that's the soul. The "registry" is derived only from passes YOU
issue, so it's a CRM without surveillance:
- `tools/generate_pass.ps1 -Github <handle> [-Wall]` upserts `tools/builders.json` (by machine
  hash): handle, grant, first/last issued, pass count, opt-in `wall` flag.
- `tools/builders_badge.ps1 [-Write]` renders the README living badge: **counts everyone**, lists
  **only `wall:true`** (explicit opt-in). `-Write` swaps the block between
  `<!--BUILDERS:START--> / <!--BUILDERS:END-->` markers in README.md.
- `builders.json` + `passes.log` are **gitignored** (handles + machine hashes stay local); commit
  only the derived badge. PowerShell sources are ASCII-only (PS 5.1 reads .ps1 as ANSI w/o BOM);
  glyphs built via `[char]`.
- **Telemetry: explicitly rejected** — a single phone-home breaks the 100%-local privacy moat.
- **Future art pass (deferred, momentum):** bespoke per-biome treatments — moonlight stone
  etching, mist handwriting, constellation spelling — replace the generic faint corner text.
  Mechanism + identity are in; the flourish is a later biome-polish task.
