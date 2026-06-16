# security_audit.md — Hearthmon Chapter Access

> Scope: the offline, device-bound Chapter gate (`src-tauri/src/chapter/*`, `build.rs`,
> `tools/generate_pass.ps1`, the `+page.svelte` / `PixiStage.svelte` frontend hooks).
> Design tier: **1 + 2** (Tier 3 data-withholding deliberately deferred — see secure_Hearthmon §5).
> Audited: 2026-06-15, against the as-built code. Honest, not flattering.

## TL;DR

**Overall: B− for the stated threat model, F for "stop a determined reverse-engineer."**
That gap is *by design and unfixable offline* — there is no server, the secret ships in the
binary, and a fully-local app already has every byte it needs. The system does exactly one
job well: **turn casual sharing/tampering into real reverse-engineering work.** It is a
community handshake with a good lock on the *door*, not a vault around the *house*.

Grading scale: **A** strong / **B** good, raises bar meaningfully / **C** speed bump /
**D** weak / **F** no real resistance. "Stops" = what it actually defeats; "Doesn't" = the
residual hole an attacker uses.

---

## Scorecard

| # | Surface | Grade | One-line verdict |
|---|---------|:---:|---|
| 1 | Secret protection (`env!` + `obfstr`) | B | Invisible to `strings`; readable in a debugger at runtime. |
| 2 | Pass forgery (HMAC-SHA256) | A* | Cryptographically unforgeable — *if* the secret holds (it ultimately doesn't, see #1). |
| 3 | State tamper (ChaCha20-Poly1305 AEAD) | A | Editing the registry/file to extend is dead without the secret. |
| 4 | Machine binding (HKDF salt + HMAC msg) | A | A pass/blob from one machine is useless on another. |
| 5 | Clock rollback (`max(now, last_seen)`) | B | Can't gain time by winding back; gentle, no false lock. |
| 6 | Dual-store heal / cross-check | B | Single-store delete/forge self-heals; conservative on disagreement. |
| 7 | **Gate bypass (the decision itself)** | **D** | Rust-only decision raises the bar, but a binary patch still wins. The real ceiling. |
| 8 | **Trial reset by full wipe** | **D** | Delete both stores (or uninstall/reinstall) → a brand-new trial. |
| 9 | Machine-hash collision (32-bit) | B | Irrelevant at your scale; theoretically a shared pass at ~77k machines. |
| 10 | Trusted list (baked, hash-keyed) | A | Can't be spoofed by typing a username; not a user-editable file. |
| 11 | Build hygiene (release guard, dev secret) | B | Release can't ship the dev secret; dev builds are forgeable (expected). |
| 12 | Privacy / network / AV surface | A | Nothing leaves the machine; standard registry reads; mailto only. |
| 13 | Frontend trust boundary | C→D | Correctly treated as untrusted, but it's where the laziest bypass lives. |

\* A* = cryptographically sound primitive whose real-world strength is capped by #1.

---

## Findings in detail

### 1. Secret protection — **B**
- **Built:** `env!("HEARTHMON_PASS_SECRET")` injected by `build.rs`, wrapped in
  `obfstr::obfstr!` so it's deobfuscated only on the stack, per use.
- **Stops:** `strings hearthmon.exe | grep`, hex-dump scraping, casual "where's the key" —
  the secret is not a contiguous plaintext literal anywhere in the binary.
- **Doesn't:** a runtime debugger (x64dbg/Frida) breakpointing `with_secret` reads the
  deobfuscated bytes off the stack. obfstr is anti-`strings`, not anti-debugger.
- **Residual risk:** Medium. This is the linchpin — every crypto grade below inherits its
  real strength from here. Acceptable for Tier 1+2.

### 2. Pass forgery — **A*** (capped by #1)
- **Built:** `sig = upper(hex(HMAC_SHA256(secret, machine_hash + yymmdd))[..8])`; constant-time
  compare; verified Rust⇄PowerShell with a shared test vector (`2B0B5AE3`).
- **Stops:** guessing/crafting a pass without the secret — 32 sig bits + HMAC = not brute-forceable
  offline in any sane time, and not derivable from observed passes.
- **Doesn't:** anyone who extracts the secret (#1) mints unlimited valid passes — *and so can
  you, that's the admin tool*. The scheme's secrecy === the binary's secrecy.

### 3. State tamper — **A**
- **Built:** state JSON → ChaCha20-Poly1305 (AEAD) → base64, in both stores. Auth tag detects
  any edit; bad tag → treated as missing/forged.
- **Stops:** open `.hm_chapter`/regedit, set `expiry = 2099`, flip a byte — all rejected.
  Collapses "edit a number" into "extract the secret" (= same bar as forging a pass). Good
  consolidation.
- **Doesn't:** see #8 — they can't *edit* state, but they can *delete* it.

### 4. Machine binding — **A**
- **Built:** AEAD key = `HKDF(secret, salt = machine_hash)`; pass msg includes `machine_hash`.
- **Stops:** copying a valid pass *or* a valid state blob to a second machine — pass HMAC won't
  match, blob won't decrypt. Casual "send my friend the unlock" is dead.

### 5. Clock rollback — **B**
- **Built:** `effective_now = max(now, last_seen)`, `last_seen` persisted (encrypted) each boot.
- **Stops:** set clock back to relive the trial / dodge expiry — time can't move below the
  monotonic floor we've seen.
- **Doesn't:** set the clock *forward* once to blow past expiry is irrelevant (only helps the
  app expire sooner); rolling forward then back is caught by the floor. Minor: a user who never
  launches during the trial window and only ever rolls forward isn't meaningfully helped.

### 6. Dual-store heal — **B**
- **Built:** missing/forged store rebuilt from the other; both-valid-but-disagree → take the
  **earlier** expiry, re-sync.
- **Stops:** "delete just the registry to reset," and "edit one store and hope it wins."
- **Doesn't:** #8 (delete *both*).

### 7. Gate bypass — **D** (the honest ceiling)
- **Built:** the pause decision is computed only in Rust (`gate::decide`); the frontend
  `chapterPaused` is a render hint with no authority.
- **Stops:** the lazy bypass (flip a JS boolean / edit the bundle) gains nothing *security-wise*
  — wait, see #13: it does flip the *visual*. It stops the *state/logic* from being faked.
- **Doesn't:** patch the Rust binary so `decide` returns `Full`, or NOP the branch. Offline,
  nothing prevents this — the app isn't withholding any data it needs. **This is precisely what
  Tier 3 would address and why it was deferred.** Grade is D on purpose; it's the agreed tradeoff.

### 8. Trial reset by full wipe — **D**
- **Reality:** delete both stores (or uninstall + reinstall, or a new OS user) → `load_or_init`
  sees nothing → **fresh 5-day trial.** Offline, there's no tamper-proof "this machine already
  had a trial" marker (any breadcrumb you hide, they can find/delete).
- **Severity:** Low *for this product*. The pass is free; re-trialing just delays a handshake
  you'd grant anyway. Worth knowing, not worth a fragile cat-and-mouse breadcrumb.
- **If it ever matters:** that's a server's job (account-bound trial), which you've rejected.

### 9. Machine-hash collision — **B**
- 32-bit hash → birthday collision ~50% near **77,000** machines; a meaningful chance of *one*
  colliding pair only in the hundreds-of-thousands. At beta scale: non-issue. Documented so
  future-you doesn't panic. (Widen to 12–16 hex if you ever ship at scale.)

### 10. Trusted list — **A**
- **Built:** `cfg::TRUSTED` keyed by **machine hash**, compiled into the binary.
- **Stops:** the obvious offline crack ("type the trusted username") — identity here is a
  hardware-bound hash, not a self-asserted name; and the list isn't a user-editable file.

### 11. Build hygiene — **B**
- **Built:** `build.rs` panics on a release build with no `HEARTHMON_PASS_SECRET`; dev/`cargo
  check` use a clearly-labelled fallback.
- **Stops:** accidentally shipping a release that trusts the public dev secret.
- **Doesn't / watch:** any **dev-profile** binary you hand out is forgeable (its secret is
  literally in `build.rs`). Only distribute `--release` binaries built with the real secret set.
  Also: never commit the real secret; rotating it invalidates all passes *and* all existing
  encrypted state.

### 12. Privacy / network / AV — **A**
- No network calls, no telemetry, no phone-home. `MachineGuid` is read locally and only ever
  leaves as an *8-hex hash* the user themselves pastes into an email. mailto opens the user's
  own client. Reads/writes are `HKCU` + AppData (standard). Nothing here trips Defender/
  Malwarebytes or a firewall. Strong, and on-soul.

### 13. Frontend trust boundary — **C→D**
- Architecturally correct: JS can't *grant* state. But the *visible* effect (the dim, the card)
  lives in the webview, so a user editing the bundle can hide the dim / never show the card
  while the Rust state still says "paused." Since there's no functional consequence to withhold
  (Tier 3), the visual is all there is — hence the low grade. Disabling devtools in release
  (planned) removes the 30-second version of this.

---

## Threat-actor matrix

| Actor | Can they beat it? | Effort |
|---|---|---|
| Non-technical user | No | — |
| Tinkerer (regedit, edits files, rolls clock) | **No** (AEAD + clock floor) | hours wasted, fails |
| Tinkerer who *uninstalls/reinstalls* | **Yes — gets a new trial** (#8) | trivial |
| Dev who edits the JS bundle | Hides the dim only; state still paused | minutes |
| Skilled friend with a debugger | **Yes** — extract secret (#1) → mint passes, or patch the gate (#7) | hours, real skill |
| Determined reverse-engineer | Yes, completely | a focused session |

Read it as: **everything short of "open a debugger / reinstall" fails.** That's the intended bar.

---

## v2 delta (2026-06-15) — what the post-audit hardening changed

| Surface | Audit grade | Now | Change |
|---|:--:|:--:|---|
| Build hygiene (#11) | B | **B+** | `strip = true` in `[profile.release]`; `devtools` feature locked off (commented in `Cargo.toml`) |
| Frontend boundary (#13) | C→D | **C** | release ships no devtools → the "open console, flip state" lazy bypass is dead |
| Provenance (Founder's Mark) | A | **A+** | added `git_commit` to the signed origin; added a click-the-signature **reveal panel** to demonstrate lineage live |
| Gate bypass (#7) | D | D | unchanged — Tier 3 deferred (binary-patch still wins offline) |
| Trial reset (#8) | D | D | unchanged — only a server closes it |
| Everything graded A | A | A | unchanged |

**Recommendations 1 & 3 are now DONE** (devtools off, strip). #2 (set `HEARTHMON_PASS_SECRET` for release) is the only open one, and it's an at-ship action.

**Overall: B− → B−.** The security ceiling is the same by design (Tier 1+2). The real gain was **authorship**: provenance is now demonstrable live (placement-theft defense), not just embedded.

**Telemetry: still explicitly rejected.** Any "who used / who liked / live counter" feature must NOT phone home — use pull-based / GitHub-native sources only (see the like-button decision: GitHub Stars, not a custom backend).

---

## Prioritised recommendations

**Now (cheap, real):**
1. ✅ **DONE** — Devtools off in release (no `devtools` feature; locked with a note in `Cargo.toml`).
2. **Set the real `HEARTHMON_PASS_SECRET`** and only ever distribute `--release` builds (#11). ← Ansh, at ship time.
3. ✅ **DONE** — `strip = true` in `[profile.release]`.

**Later / only if a friend actually beats it:**
4. **Tier 3 (data-withholding)** — the *only* thing that upgrades #7 from D toward B. Encrypt a
   load-bearing asset; gate decryption on valid state. Costly + somewhat anti-soul (secure_Hearthmon §5).
5. **Widen the machine hash** to 12–16 hex if you ever cross tens of thousands of installs (#9).

**Won't help (don't bother):**
- Binary self-checksums / anti-debug traps — false positives, AV suspicion, trivially stripped.
- Re-trial breadcrumbs to fight #8 — cat-and-mouse you lose; a server is the only real answer.

---

## Verdict

For a **free, offline, soul-first community beta**, the security is *appropriate and honest*:
A-grade on the things that stop casual sharing and tampering (forgery, state edits, machine
binding, clock, privacy), with two openly-accepted D's (binary patching, trial reset) that only
a server could close — and a server is the wrong trade for this product. **Ship it as-is for the
beta. Reassess Tier 3 only if real testers actually crack it** — and if they do, that's a
fascinating signal in itself.
