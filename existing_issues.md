# Architecture & Vulnerability Audit Report
**Target:** Hearthmon (Tauri/Rust Backend + Svelte/SQLite Frontend)
**Scope:** Core Feature Implementations, Process Interaction, File I/O, and Concurrency
**Objective:** Identify mechanical faults, edge-case vulnerabilities, and silent-failure modes.

> [!NOTE]
> **Executive Summary**
> The application's core architecture—relying on local-first, offline execution—is inherently strong and respects user privacy. However, our fault-hunting audit has identified several critical mechanical weak links where the application makes brittle assumptions about the host operating system (Windows API, filesystem I/O, and Git). These flaws range from silent telemetry drops (Admin Drop) to application-killing memory allocation vulnerabilities (OOM crashes).

---

## 1. Flow Awareness (Foreground Process Tracking)
**Vulnerability: Integrity Level Mismatch ("The Admin Drop")**
- **Location:** `src-tauri/src/lib.rs` → `foreground_proc()`
- **Mechanism:** The backend polls the foreground window via `GetForegroundWindow()`, resolves the PID via `GetWindowThreadProcessId()`, and attempts to open a handle using `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid)`.
- **Exact Fault:** Windows enforces Mandatory Integrity Control (MIC). If Hearthmon is running at Medium Integrity (standard user) and the foreground window is running at High Integrity (e.g., an elevated Task Manager, an Administrator Command Prompt, or an IDE run as Administrator), `OpenProcess` fails with `ERROR_ACCESS_DENIED` (Error Code 5).
- **Impact:** Hearthmon silently fails to resolve the process name, defaulting to "other" or dropping the state entirely. If a user is debugging a complex issue requiring an elevated shell, the flow-awareness engine incorrectly assumes they are idle or doing unrelated tasks.
- **Cross-Platform Failure:** The `#[cfg(not(windows))]` macro leaves `spawn_focus_watcher` completely unhandled on macOS/Linux. The feature fails silently on Unix environments.
- **✅ FIXED 2026-06-17** — `foreground_proc()` now returns an enum; on `OpenProcess` failure it checks `GetLastError()`: `ERROR_ACCESS_DENIED` → `Foreground::Denied`, which the focus watcher treats as "user still active" (holds the current category, never degrades to "other"). The Unix `#[cfg(not(windows))]` stub is now explicitly documented as an intentional no-op (frontend falls back to git/log signals). *(Also fixes §7.4 in the same function.)*

## 2. Training Awareness (Log File Watcher)
**Vulnerability: Unbounded Contiguous Memory Allocation (OOM Crash)**
- **Location:** `src-tauri/src/lib.rs` → `read_from()`
- **Mechanism:** The log watcher seeks to the last known byte offset (`pos`) and executes `f.read_to_end(&mut bytes)` into a `Vec<u8>`. The bytes are then converted via `String::from_utf8_lossy`.
- **Exact Fault:** `read_to_end` attempts to allocate a contiguous block of memory equal to the remaining file size. If a training script crashes and dumps a multi-gigabyte traceback, or if Hearthmon is suspended and a large log chunk accumulates, the next 2-second tick will attempt to allocate gigabytes of RAM in a single contiguous block.
- **Impact:** The Rust allocator will fail, triggering an immediate `panic!("capacity overflow")` or an OS-level OOM kill, crashing the entire Tauri backend and terminating the application without warning.
- **✅ FIXED 2026-06-16** — `read_from()` now caps each read at 1 MiB (`f.take(len - start)`) and, on a large backlog, seeks to the tail instead of `read_to_end`-ing the whole file. *(The secondary FlushFileBuffers/metadata-lag fault below is still open.)*
- **Secondary Fault (Metadata Polling):** The log watcher relies on `std::fs::metadata(p).and_then(|m| m.modified())` to detect the newest log. In Windows, NTFS does not synchronously update the directory entry's `LastWriteTime` for a file actively opened in append mode unless the writing process explicitly calls `FlushFileBuffers()`. Hearthmon will severely lag behind real-time log events.
- **DOCUMENTED 2026-06-17 (accepted)** — this is an OS-level limitation; we can't force a foreign writer to flush. The lag only affects which file is *first picked* in a directory: once a file is chosen the watcher tails appended **bytes directly** every tick (no `modified()` dependence), so steady-state lag is negligible. Rationale captured in a `newest_log()` comment rather than chasing a brittle size-growth heuristic.

## 3. Coding Awareness (Git Reflog Watcher)
**Vulnerability: Hardcoded Gitdir Pathing**
- **Location:** `src-tauri/src/lib.rs` → `git_log_path()`
- **Mechanism:** Constructs the reflog path via `repo.join(".git").join("logs").join("HEAD")`.
- **Exact Fault:** This assumes `.git` is an NTFS directory. If the user is operating within a Git Worktree (`git worktree add`), `.git` is actually a plain text file containing `gitdir: <absolute_path_to_common_dir>`.
- **Impact:** The `std::fs::read_to_string` call will fail with `ERROR_PATH_NOT_FOUND`, causing the git watcher thread to `continue` indefinitely. Hearthmon completely fails to track commits in worktrees.
- **✅ FIXED 2026-06-17** — new `git_dir(repo)`: if `.git` is a file it parses the `gitdir:` pointer (absolute, or relative→joined to repo) and `git_log_path()` reads `<gitdir>/logs/HEAD` from there. Worktree commits are now tracked. *(The repo-activity watcher already shells out to `git` with `current_dir=repo`, which is worktree-native.)*

**Vulnerability: Synchronous I/O in Unbounded Loops**
- **Location:** `spawn_repo_activity_watcher()`
- **Exact Fault:** Every 6 seconds, the application spawns child processes for `git status --porcelain` and `git diff --numstat`. On massive monorepos (e.g., Linux kernel, Chromium), `git status` can take several seconds to execute due to index stat-checking.
- **Impact:** Continuous synchronous polling will cause high disk I/O, lock contention on the `.git/index`, and severe battery drain, violating the principle of being a lightweight desktop widget.
- **✅ FIXED 2026-06-17** — `spawn_repo_activity_watcher` now times each poll and adapts the interval: cost > 1.5s doubles it (capped at 60s), cost < 0.4s snaps back to 6s. A monorepo no longer hammers `.git/index` every 6s; a small repo stays responsive. *(Watchers also already pause entirely when hidden-to-tray — §7.3.)*

## 4. Music Awareness (Audio Loopback)
**Vulnerability: Static Audio Endpoint Binding**
- **Location:** `src-tauri/src/lib.rs` → `build_loopback()`
- **Mechanism:** Binds the `cpal` WASAPI loopback stream to `host.default_output_device()` upon activation.
- **Exact Fault:** Windows Core Audio allows the default multimedia endpoint to change dynamically (e.g., when a user unplugs USB headphones, fallback routes to laptop speakers). `cpal` does not automatically handle `AUDCLNT_E_DEVICE_INVALIDATED` to rebuild the stream on the new endpoint.
- **Impact:** The audio reactivity will silently freeze. The callback stops firing, and the `peak` value decays, rendering the companion visually unresponsive to audio until the user manually restarts the toggle.
- **✅ FIXED 2026-06-17** — `build_loopback` now returns `(stream, device_name)` and raises an `Arc<AtomicBool>` from its error callback. The watcher rebuilds the stream when the default output device name changes (headphones→speakers) **or** the error flag is set — capture follows the live endpoint instead of dying until restart.

**Vulnerability: Infinite Peak Hold in AGC (Auto Gain Control)**
- **Mechanism:** The normalizer calculates `peak = (peak * 0.999).max(lvl).max(0.0008);` at 30Hz (every 33ms).
- **Exact Fault:** The decay multiplier of `0.999` is extremely slow (it takes ~693 frames, or ~23 seconds, to halve in magnitude). If a transient loud noise occurs (e.g., a Windows error chime), `peak` jumps to maximum.
- **Impact:** Because the denominator is artificially high, normal-volume music will map to near-zero values (`nz(lvl) ≈ 0.0`), suppressing all companion audio animations for minutes until the peak slowly degrades.
- **✅ FIXED 2026-06-17** — decay multiplier `0.999`→`0.995` (~23s → ~4.6s half-life @30Hz). A transient chime no longer suppresses real music for minutes; the AGC recovers in seconds while staying smooth. Tunable.

## 5. Chapter Access & Security (`secure_Hearthmon`)
**Vulnerability: Non-Resilient Monotonic Clock Clamping**
- **Location:** `src-tauri/src/chapter/mod.rs` → `chapter_status()`
- **Mechanism:** To prevent users from spoofing the trial expiry, the clock is clamped: `effective_now = state::now().max(st.last_seen);`.
- **Exact Fault:** If the host machine temporarily syncs to an incorrect NTP server providing a future date (e.g., 2030), or if dual-booting Linux/Windows causes a UTC/Localtime desync, `state::now()` spikes. `last_seen` saves this future timestamp to the local disk state. Once the OS clock corrects back to 2024, `effective_now` is permanently stuck in 2030.
- **Impact:** The Builder's Pass immediately expires, and the user is permanently locked out of the application with no recovery mechanism short of deleting the hidden state file.
- **✅ FIXED 2026-06-17** — new `clamp_clock(now, last_seen)` + `config::CLOCK_JUMP_TOLERANCE_DAYS` (366). Rollback still floors at `last_seen`; a forward leap larger than the tolerance is now treated as a fault and IGNORED (we hold the last good position), so a bad NTP/wrong-date/dual-boot jump can't poison `last_seen` and lock the user out once the clock heals. Guards both `chapter_status` and `submit_builder_pass`. Generous on purpose — a real multi-month absence still expires normally; only an implausible (year+) leap trips it.

## 6. Frontend SQLite Database (`db.ts`)
**Vulnerability: Non-Deterministic Timezone Evaluation**
- **Location:** `src/lib/db.ts` → e.g., `hardDaysSurvived()`
- **Mechanism:** Queries execute `datetime('now','localtime','-7 days')`.
- **Exact Fault:** SQLite's `localtime` modifier delegates to the host OS timezone API at query execution. If a user crosses timezones (e.g., flying from New York to London), the absolute bounds of "yesterday" shift by hours.
- **Impact:** Time capsules may be delayed, and interaction streaks (like `weeklyMemoryCount`) can break because records stored under a previous timezone offset are evaluated against the new local boundary.
- **DOCUMENTED 2026-06-17 (kept local on purpose)** — `created_at`/`open_at` stay LOCAL time: self-consistent on one machine and human-readable in the Journey UI with no conversion. Migrating live beta DBs to UTC would mis-shift every existing row's displayed time by the same magnitude as the bug, for a low-severity, traveler-only gain. Decision captured in a `getDb()` comment. *(The genuine local-vs-UTC MIX bug was in chapter `pass_expiry` — see §7.6, fixed.)*

**Vulnerability: Missing Index Scans**
- **Mechanism:** The `memories` table has no indexes beyond the primary key.
- **Exact Fault:** Methods like `hardMoodCount()` or `allMemories(250)` use `WHERE kind = ... AND created_at > ... ORDER BY created_at DESC`.
- **Impact:** Without a composite index on `(kind, created_at)` or `(mood, created_at)`, SQLite must perform a full table scan. Over months of journaling (thousands of rows), this introduces blocking latency on the Tauri SQL plugin IPC channel, causing frontend frame drops when evaluating historical data.
- **✅ FIXED 2026-06-17** — `getDb()` creates `idx_memories_kind_created (kind, created_at)` and `idx_memories_mood_created (mood, created_at)` (`IF NOT EXISTS`). Recalls are now index-served, and §7.7 was rewritten to actually use them.

---

## 7. Additional Findings (code-verified, this audit pass)
> Pinpointed by reading the current `lib.rs`, `chapter/mod.rs`, `chapter/state.rs`, `db.ts`, and `LeaveNote.svelte`. Each extends or sits alongside the sections above.

### 7.1 Auto-Push: `fetch` immediately before `--force-with-lease` nullifies the lease (DATA LOSS)
- **Location:** `src-tauri/src/lib.rs` → `push_card()`
- **Mechanism:** `push_card()` runs `git fetch origin`, then (on the rolling-card amend path) `git push --force-with-lease`.
- **Exact Fault:** `--force-with-lease` with no explicit `<ref>:<expected>` compares against the local remote-tracking ref (`refs/remotes/origin/<branch>`). The `git fetch origin` executed seconds earlier *updates that very ref* to the current remote tip, so the lease always matches and the force always succeeds — even if a commit (e.g., a README edited directly on github.com) landed in between.
- **Impact:** The safety of force-with-lease is defeated; it behaves like a plain `git push --force`. Any change pushed to that branch from elsewhere is silently overwritten by the background card amend. Automated, silent data loss on the **user's own repo**.
- **✅ FIXED 2026-06-16** — if the pre-push `rebase` can't integrate the remote, `push_card` now aborts **and returns early** (no force-push); and the lease is pinned to the integrated SHA (`--force-with-lease=<branch>:<sha>` with an explicit `HEAD:<branch>` refspec) so a concurrent push can no longer be clobbered.

### 7.2 Auto-Push: the card's own amend self-triggers the commit watcher (FEEDBACK LOOP)
- **Location:** `src-tauri/src/lib.rs` → `push_card()` + `parse_commit()` + `spawn_git_watcher()`
- **Mechanism:** `push_card` writes a commit `chore: Hearthmon status card`; the reflog records `commit (amend): chore: Hearthmon status card`. `spawn_git_watcher` tails `.git/logs/HEAD` and `parse_commit()` fires on any action starting with `"commit"`.
- **Exact Fault:** (a) If the Coding-Awareness repo is the same repo the card is pushed to, every automated card push appends a reflog `commit` line → the watcher emits `git-commit` with the card's message → the companion reacts to its **own** automated push as a "new commit" (false breakthrough/celebration). (b) `parse_commit` also accepts `commit (amend)` and `commit (initial)`, so amends inflate the perceived commit count.
- **Impact:** Self-referential signal pollution; the pet celebrates its own status-card pushes. Directly undermines the soul rule that companionship signals must reflect real effort.
- **✅ FIXED 2026-06-16** — the card message is now a shared `CARD_COMMIT_MSG` const and `parse_commit()` returns `None` for it, so the commit watcher never reacts to Hearthmon's own automated push.

### 7.3 Background watchers never pause when hidden-to-tray (BATTERY/IO)
- **Location:** `src-tauri/src/lib.rs` → `spawn_git_watcher` / `spawn_repo_activity_watcher` / `spawn_log_watcher`
- **Mechanism:** Each is a detached `loop { sleep; poll }`. The audio + speech path was taught to suspend on the `hm-visible=false` event (tray hide / window close), but these watchers were not.
- **Exact Fault:** "Quit" and the window **X** only *hide* the app (the only real exit is tray → Quit). While hidden, `spawn_repo_activity_watcher` still spawns **two** `git` child processes every 6s, and the git/log watchers still hit disk every 2–3s, forever.
- **Impact:** Continuous background disk I/O, `.git/index` stat-churn, and battery drain while the user believes the app is closed. Amplifies §3 on monorepos and violates the lightweight-widget principle.
- **✅ FIXED 2026-06-16** — a managed `Visible(AtomicBool)` is flipped on show/hide/close; the git (3s), repo-activity (6s), log (2s) and focus (4s) loops `continue` while hidden, and the audio capture drops its stream. No disk I/O or git processes while tucked in the tray. *(Trade-off: live commits/logs are caught up on reopen, bounded by the §2 1 MiB cap.)*

### 7.4 Foreground process path truncated at 260 wchars
- **Location:** `src-tauri/src/lib.rs` → `foreground_proc()`
- **Mechanism:** `let mut buf = [0u16; 260]; QueryFullProcessImageNameW(...)`.
- **Exact Fault:** With Win32 long paths enabled, an executable path longer than 259 chars makes `QueryFullProcessImageNameW` fail (insufficient buffer) → `ok == 0` → returns `None`.
- **Impact:** Deeply-nested editors/tools (long conda/npm/temp install paths) resolve to "other"; flow-awareness misreads them as unrelated activity — the same end-state as §1's Admin Drop.
- **✅ FIXED 2026-06-17** — `foreground_proc()` now grows the buffer (1024→32768 wchars) and retries on `ERROR_INSUFFICIENT_BUFFER`, so long executable paths resolve correctly. *(Same rewrite as §1.)*

### 7.5 Log watcher follows the newest file of ANY type (OOM amplifier)
- **Location:** `src-tauri/src/lib.rs` → `newest_log()` / `read_from()`
- **Mechanism:** Pointed at a directory, `newest_log()` returns the most-recently-modified *file* with no extension/type filter; `read_from()` then reads it whole and `from_utf8_lossy`-decodes it.
- **Exact Fault:** If the newest file in the chosen folder is a binary artifact (a `.pt`/`.ckpt` checkpoint, a `.zip`, an image) it is read as a "log". Combined with §2's unbounded `read_to_end`, a multi-GB checkpoint written into the watched folder is slurped entirely into RAM.
- **Impact:** Garbage `train-log` emissions at best; a hard OOM crash at worst. A direct amplifier of §2.
- **✅ FIXED 2026-06-17** — `newest_log()` now filters via `is_log_file()` (extension `.log`/`.txt`, or any name containing "log") so the directory auto-pick can't grab a `.pt`/`.ckpt`/`.zip`/`.png`. A file the user points at DIRECTLY is still honoured as-is.

### 7.6 Chapter day-boundary is computed in local time while state math is UTC
- **Location:** `src-tauri/src/chapter/mod.rs` → `pass_expiry()` vs `src-tauri/src/chapter/state.rs` → `now()`
- **Mechanism:** `pass_expiry()` builds expiry from `YYMMDD` via `Local.from_local_datetime(23:59:59)`, while `now()`, `last_seen`, and all clamping use `Utc::now()`.
- **Exact Fault:** A pass is minted against the **issuer's** local day boundary (`generate_pass.ps1` host timezone) but evaluated against the **user's** local timezone; the two day-ends differ by the tz delta. `FORGIVENESS_DAYS` masks small deltas, not large ones; DST transitions can also make `.single()` (ambiguous local time) return `None`.
- **Impact:** A pass can expire up to a day early/late for users far from the issuer's timezone. Low severity (pad covers most cases) but it is an undocumented, silent assumption.
- **✅ FIXED 2026-06-17** — `pass_expiry()` now resolves the local day-end via an explicit `LocalResult` match: `Ambiguous`→earliest, `None` (DST spring-forward gap)→fall back a minute. A valid pass is never rejected over a clock quirk, and `.single()?` can no longer return None and fail as "malformed". The issuer-vs-user tz delta remains absorbed by `FORGIVENESS_DAYS` (now documented in-code).

### 7.7 Memory recall sorts with `ORDER BY RANDOM()` over a full scan
- **Location:** `src/lib/db.ts` → `forgottenWins` / `hardDaysSurvived` / `oldMilestone` / `oldArc` / `findFamiliar`
- **Mechanism:** Each filters on `kind`/`mood`/`created_at`, then `ORDER BY RANDOM() LIMIT n`.
- **Exact Fault:** `RANDOM()` assigns a random key to every matching row and sorts them; no index can satisfy that ordering, so it is a full filtered scan **plus** an O(n log n) sort on every call. This stacks directly on §6's missing-index full scan.
- **Impact:** These recalls fire during normal idle companionship; each one re-scans and re-sorts the whole `memories` table, on the same IPC channel as §6. Latency grows with journal size → idle frame hitches.
- **✅ FIXED 2026-06-17** — new `randomPick(where, params, limit)` helper: an index-backed `COUNT`, then a random index-ordered `LIMIT/OFFSET` window (no `RANDOM()` sort). Served by the §6 indexes. All five recalls (`forgottenWins`/`hardDaysSurvived`/`oldMilestone`/`oldArc`/`findFamiliar`) rewritten to use it. (Random window, not per-row shuffle — fine for companionship recall.)

### 7.8 SQLite opened without WAL or `busy_timeout`
- **Location:** `src/lib/db.ts` → `getDb()`
- **Mechanism:** `Database.load("sqlite:hearthmon.db")` with no `PRAGMA journal_mode=WAL` and no `PRAGMA busy_timeout`.
- **Exact Fault:** In the default rollback-journal mode a writer blocks readers (and vice-versa); with no `busy_timeout`, a concurrent access returns `SQLITE_BUSY` immediately instead of waiting.
- **Impact:** A write (`addMemory`) overlapping a long read (`allMemories(250)` or a 7.7 `RANDOM()` scan) can throw "database is locked" — a dropped memory or a rejected query. `WAL` + a few-second `busy_timeout` removes the whole class.
- **✅ FIXED 2026-06-16** — `getDb()` now runs `PRAGMA journal_mode = WAL` and `PRAGMA busy_timeout = 3000` right after opening the database.

### 7.9 `bumpCounter` is a non-atomic read-modify-write
- **Location:** `src/lib/db.ts` → `bumpCounter()`
- **Mechanism:** `getMeta(key)` → `+1` → `setMeta(key)` across two awaited round-trips.
- **Exact Fault:** Two `bumpCounter` calls awaiting concurrently can both read `N` and both write `N+1`, losing an increment; there is no atomic `value = value + 1` upsert.
- **Impact:** Lifetime counters (interactions, etc.) can under-count. Cosmetic, but they feed milestone/recap copy.
- **✅ FIXED 2026-06-17** — `bumpCounter` is now a single atomic statement: `INSERT … ON CONFLICT(key) DO UPDATE SET value = CAST(meta.value AS INTEGER) + 1`. Concurrent bumps can no longer both read N and write N+1.

### 7.10 Vestigial `gpu_stat` (nvidia-smi) still ships
- **Location:** `src-tauri/src/lib.rs` → `gpu_stat()` / `nvsmi()`
- **Mechanism:** Training awareness pivoted to log-watch (the dev machine is Intel Arc — no NVIDIA), but `gpu_stat` remains a registered command that shells out to `nvidia-smi`.
- **Exact Fault:** Dead surface — on a non-NVIDIA host it returns `available:false` (harmless), but it is unused code that still spawns a process when invoked and widens the command surface.
- **Impact:** Maintenance/clarity debt. Either wire it back in or remove it.
- **RESOLVED 2026-06-17 (kept by decision)** — NOT removed. On non-NVIDIA hosts `gpu_stat` returns `available:false`, so the frontend stops polling and never nags; on a friend's NVIDIA box it's a working capability. Removing it would drop a feature for those users at ~zero cost to keep. Intent now documented in-code above `gpu_stat`.

---

## Severity & Fix Priority

> **Status (2026-06-16):** the 5 beta-blockers are fixed — §2, 7.1, 7.2, 7.3, 7.8 (✅ rows below); both builds green (cargo check + svelte-check). Remaining: §1, §3, §4, §6, 7.4–7.7, 7.9, 7.10.
>
> **Status (2026-06-17):** ALL remaining items closed (two passes). Pass A: §5, §3-worktree, §4-device, §6-indexes, §7.5. Pass B: §1 (Admin Drop + Unix stub) + §7.4, §3-monorepo backoff, §4-AGC decay, §7.6, §7.7, §7.9. Documented deliberate decisions (no code change): §6-localtime basis kept (UTC migration would mis-shift live beta data), §2-secondary NTFS mtime lag (OS limitation; steady-state tailing reads bytes directly), §7.10 `gpu_stat` kept (serves NVIDIA users; harmless on others). Both builds green.

| # | Issue | Area | Severity | Suggested fix |
|---|-------|------|----------|---------------|
| 2 | Unbounded `read_to_end` OOM | Training | ~~Critical~~ | ✅ **Fixed 2026-06-16** — 1 MiB `take` cap + tail |
| 5 | Permanent future-clock lockout | Security | ~~Critical~~ | ✅ **Fixed 2026-06-17** — `clamp_clock` + `CLOCK_JUMP_TOLERANCE_DAYS`; forward leap can't poison `last_seen` |
| 7.1 | `fetch` defeats `--force-with-lease` | Auto-push | ~~Critical~~ | ✅ **Fixed 2026-06-16** — bail on rebase conflict + pinned lease |
| 1 | Admin Drop + no Unix impl | Flow | ~~High~~ | ✅ **Fixed 2026-06-17** — `ACCESS_DENIED`→hold category (not "other"); Unix stub documented |
| 3 | Worktree `.git` file + monorepo polling | Coding | ~~High~~ | ✅ **Fixed 2026-06-17** — `git_dir()` resolves `gitdir:`; repo-activity adaptive backoff 6→60s |
| 4 | Audio device-invalidation + slow AGC | Music | ~~High~~ | ✅ **Fixed 2026-06-17** — rebuild on device-name change / stream error; AGC decay 0.999→0.995 |
| 6 | localtime drift + missing indexes | DB | ~~High~~ | ✅ **Indexes added 2026-06-17** `(kind,created_at)`/`(mood,created_at)`; localtime basis KEPT (documented — UTC migration would mis-shift live data) |
| 7.2 | Card amend self-triggers commit watcher | Auto-push | ~~High~~ | ✅ **Fixed 2026-06-16** — `parse_commit` ignores the card message |
| 7.3 | Watchers never pause when hidden | Lifecycle | ~~High~~ | ✅ **Fixed 2026-06-16** — `Visible` flag gates all watcher loops |
| 7.5 | Newest-file-any-type log read | Training | ~~High~~ | ✅ **Fixed 2026-06-17** — `is_log_file` restricts dir auto-pick to `.log`/`.txt`/`*log*` |
| 7.7 | `ORDER BY RANDOM()` full scan | DB | ~~Medium~~ | ✅ **Fixed 2026-06-17** — `randomPick` = COUNT + index-ordered LIMIT/OFFSET window |
| 7.8 | No WAL / `busy_timeout` | DB | ~~Medium~~ | ✅ **Fixed 2026-06-16** — WAL + busy_timeout=3000 in `getDb` |
| 7.4 | 260-wchar path truncation | Flow | ~~Low~~ | ✅ **Fixed 2026-06-17** — buffer grows to 32K wchars on `ERROR_INSUFFICIENT_BUFFER` |
| 7.6 | Local vs UTC day boundary | Security | ~~Low~~ | ✅ **Fixed 2026-06-17** — robust `LocalResult` (DST gap/ambiguous never rejects a pass); pad documented |
| 7.9 | Non-atomic `bumpCounter` | DB | ~~Low~~ | ✅ **Fixed 2026-06-17** — single-statement `ON CONFLICT … value+1` upsert |
| 7.10 | Vestigial `gpu_stat` | Training | ~~Low~~ | ✅ **Resolved 2026-06-17** — KEPT by decision (serves NVIDIA users; harmless on others), documented |

> **Note on intent:** all of the above are *robustness / edge-case* findings on a deliberately local-first, offline app. None are remote-exploitable; the highest-impact ones are self-inflicted data loss (7.1), a hard crash (2), and a self-lockout (5).
