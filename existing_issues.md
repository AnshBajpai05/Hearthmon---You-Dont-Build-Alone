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

## 2. Training Awareness (Log File Watcher)
**Vulnerability: Unbounded Contiguous Memory Allocation (OOM Crash)**
- **Location:** `src-tauri/src/lib.rs` → `read_from()`
- **Mechanism:** The log watcher seeks to the last known byte offset (`pos`) and executes `f.read_to_end(&mut bytes)` into a `Vec<u8>`. The bytes are then converted via `String::from_utf8_lossy`.
- **Exact Fault:** `read_to_end` attempts to allocate a contiguous block of memory equal to the remaining file size. If a training script crashes and dumps a multi-gigabyte traceback, or if Hearthmon is suspended and a large log chunk accumulates, the next 2-second tick will attempt to allocate gigabytes of RAM in a single contiguous block.
- **Impact:** The Rust allocator will fail, triggering an immediate `panic!("capacity overflow")` or an OS-level OOM kill, crashing the entire Tauri backend and terminating the application without warning.
- **Secondary Fault (Metadata Polling):** The log watcher relies on `std::fs::metadata(p).and_then(|m| m.modified())` to detect the newest log. In Windows, NTFS does not synchronously update the directory entry's `LastWriteTime` for a file actively opened in append mode unless the writing process explicitly calls `FlushFileBuffers()`. Hearthmon will severely lag behind real-time log events.

## 3. Coding Awareness (Git Reflog Watcher)
**Vulnerability: Hardcoded Gitdir Pathing**
- **Location:** `src-tauri/src/lib.rs` → `git_log_path()`
- **Mechanism:** Constructs the reflog path via `repo.join(".git").join("logs").join("HEAD")`.
- **Exact Fault:** This assumes `.git` is an NTFS directory. If the user is operating within a Git Worktree (`git worktree add`), `.git` is actually a plain text file containing `gitdir: <absolute_path_to_common_dir>`.
- **Impact:** The `std::fs::read_to_string` call will fail with `ERROR_PATH_NOT_FOUND`, causing the git watcher thread to `continue` indefinitely. Hearthmon completely fails to track commits in worktrees.

**Vulnerability: Synchronous I/O in Unbounded Loops**
- **Location:** `spawn_repo_activity_watcher()`
- **Exact Fault:** Every 6 seconds, the application spawns child processes for `git status --porcelain` and `git diff --numstat`. On massive monorepos (e.g., Linux kernel, Chromium), `git status` can take several seconds to execute due to index stat-checking.
- **Impact:** Continuous synchronous polling will cause high disk I/O, lock contention on the `.git/index`, and severe battery drain, violating the principle of being a lightweight desktop widget.

## 4. Music Awareness (Audio Loopback)
**Vulnerability: Static Audio Endpoint Binding**
- **Location:** `src-tauri/src/lib.rs` → `build_loopback()`
- **Mechanism:** Binds the `cpal` WASAPI loopback stream to `host.default_output_device()` upon activation.
- **Exact Fault:** Windows Core Audio allows the default multimedia endpoint to change dynamically (e.g., when a user unplugs USB headphones, fallback routes to laptop speakers). `cpal` does not automatically handle `AUDCLNT_E_DEVICE_INVALIDATED` to rebuild the stream on the new endpoint.
- **Impact:** The audio reactivity will silently freeze. The callback stops firing, and the `peak` value decays, rendering the companion visually unresponsive to audio until the user manually restarts the toggle.

**Vulnerability: Infinite Peak Hold in AGC (Auto Gain Control)**
- **Mechanism:** The normalizer calculates `peak = (peak * 0.999).max(lvl).max(0.0008);` at 30Hz (every 33ms).
- **Exact Fault:** The decay multiplier of `0.999` is extremely slow (it takes ~693 frames, or ~23 seconds, to halve in magnitude). If a transient loud noise occurs (e.g., a Windows error chime), `peak` jumps to maximum.
- **Impact:** Because the denominator is artificially high, normal-volume music will map to near-zero values (`nz(lvl) ≈ 0.0`), suppressing all companion audio animations for minutes until the peak slowly degrades.

## 5. Chapter Access & Security (`secure_Hearthmon`)
**Vulnerability: Non-Resilient Monotonic Clock Clamping**
- **Location:** `src-tauri/src/chapter/mod.rs` → `chapter_status()`
- **Mechanism:** To prevent users from spoofing the trial expiry, the clock is clamped: `effective_now = state::now().max(st.last_seen);`.
- **Exact Fault:** If the host machine temporarily syncs to an incorrect NTP server providing a future date (e.g., 2030), or if dual-booting Linux/Windows causes a UTC/Localtime desync, `state::now()` spikes. `last_seen` saves this future timestamp to the local disk state. Once the OS clock corrects back to 2024, `effective_now` is permanently stuck in 2030.
- **Impact:** The Builder's Pass immediately expires, and the user is permanently locked out of the application with no recovery mechanism short of deleting the hidden state file.

## 6. Frontend SQLite Database (`db.ts`)
**Vulnerability: Non-Deterministic Timezone Evaluation**
- **Location:** `src/lib/db.ts` → e.g., `hardDaysSurvived()`
- **Mechanism:** Queries execute `datetime('now','localtime','-7 days')`.
- **Exact Fault:** SQLite's `localtime` modifier delegates to the host OS timezone API at query execution. If a user crosses timezones (e.g., flying from New York to London), the absolute bounds of "yesterday" shift by hours.
- **Impact:** Time capsules may be delayed, and interaction streaks (like `weeklyMemoryCount`) can break because records stored under a previous timezone offset are evaluated against the new local boundary.

**Vulnerability: Missing Index Scans**
- **Mechanism:** The `memories` table has no indexes beyond the primary key.
- **Exact Fault:** Methods like `hardMoodCount()` or `allMemories(250)` use `WHERE kind = ... AND created_at > ... ORDER BY created_at DESC`.
- **Impact:** Without a composite index on `(kind, created_at)` or `(mood, created_at)`, SQLite must perform a full table scan. Over months of journaling (thousands of rows), this introduces blocking latency on the Tauri SQL plugin IPC channel, causing frontend frame drops when evaluating historical data.

---

## 7. Additional Findings (code-verified, this audit pass)
> Pinpointed by reading the current `lib.rs`, `chapter/mod.rs`, `chapter/state.rs`, `db.ts`, and `LeaveNote.svelte`. Each extends or sits alongside the sections above.

### 7.1 Auto-Push: `fetch` immediately before `--force-with-lease` nullifies the lease (DATA LOSS)
- **Location:** `src-tauri/src/lib.rs` → `push_card()`
- **Mechanism:** `push_card()` runs `git fetch origin`, then (on the rolling-card amend path) `git push --force-with-lease`.
- **Exact Fault:** `--force-with-lease` with no explicit `<ref>:<expected>` compares against the local remote-tracking ref (`refs/remotes/origin/<branch>`). The `git fetch origin` executed seconds earlier *updates that very ref* to the current remote tip, so the lease always matches and the force always succeeds — even if a commit (e.g., a README edited directly on github.com) landed in between.
- **Impact:** The safety of force-with-lease is defeated; it behaves like a plain `git push --force`. Any change pushed to that branch from elsewhere is silently overwritten by the background card amend. Automated, silent data loss on the **user's own repo**.

### 7.2 Auto-Push: the card's own amend self-triggers the commit watcher (FEEDBACK LOOP)
- **Location:** `src-tauri/src/lib.rs` → `push_card()` + `parse_commit()` + `spawn_git_watcher()`
- **Mechanism:** `push_card` writes a commit `chore: Hearthmon status card`; the reflog records `commit (amend): chore: Hearthmon status card`. `spawn_git_watcher` tails `.git/logs/HEAD` and `parse_commit()` fires on any action starting with `"commit"`.
- **Exact Fault:** (a) If the Coding-Awareness repo is the same repo the card is pushed to, every automated card push appends a reflog `commit` line → the watcher emits `git-commit` with the card's message → the companion reacts to its **own** automated push as a "new commit" (false breakthrough/celebration). (b) `parse_commit` also accepts `commit (amend)` and `commit (initial)`, so amends inflate the perceived commit count.
- **Impact:** Self-referential signal pollution; the pet celebrates its own status-card pushes. Directly undermines the soul rule that companionship signals must reflect real effort.

### 7.3 Background watchers never pause when hidden-to-tray (BATTERY/IO)
- **Location:** `src-tauri/src/lib.rs` → `spawn_git_watcher` / `spawn_repo_activity_watcher` / `spawn_log_watcher`
- **Mechanism:** Each is a detached `loop { sleep; poll }`. The audio + speech path was taught to suspend on the `hm-visible=false` event (tray hide / window close), but these watchers were not.
- **Exact Fault:** "Quit" and the window **X** only *hide* the app (the only real exit is tray → Quit). While hidden, `spawn_repo_activity_watcher` still spawns **two** `git` child processes every 6s, and the git/log watchers still hit disk every 2–3s, forever.
- **Impact:** Continuous background disk I/O, `.git/index` stat-churn, and battery drain while the user believes the app is closed. Amplifies §3 on monorepos and violates the lightweight-widget principle.

### 7.4 Foreground process path truncated at 260 wchars
- **Location:** `src-tauri/src/lib.rs` → `foreground_proc()`
- **Mechanism:** `let mut buf = [0u16; 260]; QueryFullProcessImageNameW(...)`.
- **Exact Fault:** With Win32 long paths enabled, an executable path longer than 259 chars makes `QueryFullProcessImageNameW` fail (insufficient buffer) → `ok == 0` → returns `None`.
- **Impact:** Deeply-nested editors/tools (long conda/npm/temp install paths) resolve to "other"; flow-awareness misreads them as unrelated activity — the same end-state as §1's Admin Drop.

### 7.5 Log watcher follows the newest file of ANY type (OOM amplifier)
- **Location:** `src-tauri/src/lib.rs` → `newest_log()` / `read_from()`
- **Mechanism:** Pointed at a directory, `newest_log()` returns the most-recently-modified *file* with no extension/type filter; `read_from()` then reads it whole and `from_utf8_lossy`-decodes it.
- **Exact Fault:** If the newest file in the chosen folder is a binary artifact (a `.pt`/`.ckpt` checkpoint, a `.zip`, an image) it is read as a "log". Combined with §2's unbounded `read_to_end`, a multi-GB checkpoint written into the watched folder is slurped entirely into RAM.
- **Impact:** Garbage `train-log` emissions at best; a hard OOM crash at worst. A direct amplifier of §2.

### 7.6 Chapter day-boundary is computed in local time while state math is UTC
- **Location:** `src-tauri/src/chapter/mod.rs` → `pass_expiry()` vs `src-tauri/src/chapter/state.rs` → `now()`
- **Mechanism:** `pass_expiry()` builds expiry from `YYMMDD` via `Local.from_local_datetime(23:59:59)`, while `now()`, `last_seen`, and all clamping use `Utc::now()`.
- **Exact Fault:** A pass is minted against the **issuer's** local day boundary (`generate_pass.ps1` host timezone) but evaluated against the **user's** local timezone; the two day-ends differ by the tz delta. `FORGIVENESS_DAYS` masks small deltas, not large ones; DST transitions can also make `.single()` (ambiguous local time) return `None`.
- **Impact:** A pass can expire up to a day early/late for users far from the issuer's timezone. Low severity (pad covers most cases) but it is an undocumented, silent assumption.

### 7.7 Memory recall sorts with `ORDER BY RANDOM()` over a full scan
- **Location:** `src/lib/db.ts` → `forgottenWins` / `hardDaysSurvived` / `oldMilestone` / `oldArc` / `findFamiliar`
- **Mechanism:** Each filters on `kind`/`mood`/`created_at`, then `ORDER BY RANDOM() LIMIT n`.
- **Exact Fault:** `RANDOM()` assigns a random key to every matching row and sorts them; no index can satisfy that ordering, so it is a full filtered scan **plus** an O(n log n) sort on every call. This stacks directly on §6's missing-index full scan.
- **Impact:** These recalls fire during normal idle companionship; each one re-scans and re-sorts the whole `memories` table, on the same IPC channel as §6. Latency grows with journal size → idle frame hitches.

### 7.8 SQLite opened without WAL or `busy_timeout`
- **Location:** `src/lib/db.ts` → `getDb()`
- **Mechanism:** `Database.load("sqlite:hearthmon.db")` with no `PRAGMA journal_mode=WAL` and no `PRAGMA busy_timeout`.
- **Exact Fault:** In the default rollback-journal mode a writer blocks readers (and vice-versa); with no `busy_timeout`, a concurrent access returns `SQLITE_BUSY` immediately instead of waiting.
- **Impact:** A write (`addMemory`) overlapping a long read (`allMemories(250)` or a 7.7 `RANDOM()` scan) can throw "database is locked" — a dropped memory or a rejected query. `WAL` + a few-second `busy_timeout` removes the whole class.

### 7.9 `bumpCounter` is a non-atomic read-modify-write
- **Location:** `src/lib/db.ts` → `bumpCounter()`
- **Mechanism:** `getMeta(key)` → `+1` → `setMeta(key)` across two awaited round-trips.
- **Exact Fault:** Two `bumpCounter` calls awaiting concurrently can both read `N` and both write `N+1`, losing an increment; there is no atomic `value = value + 1` upsert.
- **Impact:** Lifetime counters (interactions, etc.) can under-count. Cosmetic, but they feed milestone/recap copy.

### 7.10 Vestigial `gpu_stat` (nvidia-smi) still ships
- **Location:** `src-tauri/src/lib.rs` → `gpu_stat()` / `nvsmi()`
- **Mechanism:** Training awareness pivoted to log-watch (the dev machine is Intel Arc — no NVIDIA), but `gpu_stat` remains a registered command that shells out to `nvidia-smi`.
- **Exact Fault:** Dead surface — on a non-NVIDIA host it returns `available:false` (harmless), but it is unused code that still spawns a process when invoked and widens the command surface.
- **Impact:** Maintenance/clarity debt. Either wire it back in or remove it.

---

## Severity & Fix Priority

| # | Issue | Area | Severity | Suggested fix |
|---|-------|------|----------|---------------|
| 2 | Unbounded `read_to_end` OOM | Training | **Critical** | Cap the read (`take(MAX)`), tail only the last N KB |
| 5 | Permanent future-clock lockout | Security | **Critical** | Allow downward heal within a tolerance; recovery path |
| 7.1 | `fetch` defeats `--force-with-lease` | Auto-push | **Critical** | Don't fetch before the lease, or pin `--force-with-lease=<ref>:<sha>` |
| 1 | Admin Drop + no Unix impl | Flow | High | Treat `ACCESS_DENIED` as "still active"; stub Unix |
| 3 | Worktree `.git` file + monorepo polling | Coding | High | Resolve `gitdir:`; back off / cache on slow repos |
| 4 | Audio device-invalidation + slow AGC | Music | High | Rebuild on `DEVICE_INVALIDATED`; faster peak decay |
| 6 | localtime drift + missing indexes | DB | High | Store UTC; add `(kind, created_at)` / `(mood, created_at)` indexes |
| 7.2 | Card amend self-triggers commit watcher | Auto-push | High | Ignore `chore: Hearthmon status card`; exclude amend reflog |
| 7.3 | Watchers never pause when hidden | Lifecycle | High | Gate watcher loops on `hm-visible` like audio/speech |
| 7.5 | Newest-file-any-type log read | Training | High | Filter by extension; cap size (ties to #2) |
| 7.7 | `ORDER BY RANDOM()` full scan | DB | Medium | Random-offset / id-sampling instead of full sort |
| 7.8 | No WAL / `busy_timeout` | DB | Medium | `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000` |
| 7.4 | 260-wchar path truncation | Flow | Low | Grow buffer / retry on `ERROR_INSUFFICIENT_BUFFER` |
| 7.6 | Local vs UTC day boundary | Security | Low | Compute expiry in UTC, or document the pad |
| 7.9 | Non-atomic `bumpCounter` | DB | Low | Atomic upsert `value = value + 1` |
| 7.10 | Vestigial `gpu_stat` | Training | Low | Remove or re-integrate |

> **Note on intent:** all of the above are *robustness / edge-case* findings on a deliberately local-first, offline app. None are remote-exploitable; the highest-impact ones are self-inflicted data loss (7.1), a hard crash (2), and a self-lockout (5).
