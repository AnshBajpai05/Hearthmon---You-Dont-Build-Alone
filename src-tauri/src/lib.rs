mod audio_class;
mod chapter;

use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        app.state::<Visible>().0.store(true, Ordering::Relaxed); // resume the background watchers
        let _ = app.emit("hm-visible", true); // resume audio/speech (was suspended while hidden)
    }
}

// ── Coding Awareness ───────────────────────────────────────────────
// The pet watches a git repo's reflog (.git/logs/HEAD) and reacts to new
// commits. Reading happens in the backend, which has plain filesystem access —
// no capability scoping, no IDE extension needed.
#[derive(Default)]
struct GitWatch {
    repo: Option<PathBuf>,
    seen: usize, // reflog lines already accounted for — we never replay history
}

/// Resolve the real git directory for `repo`. Normally `<repo>/.git` is a directory, but in a
/// **git worktree** `.git` is a FILE containing `gitdir: <path>` pointing at
/// `<main>/.git/worktrees/<name>` — that's where this checkout's `logs/HEAD` actually lives.
/// Without this we'd read `<repo>/.git/logs/HEAD` (a missing path) and silently miss every
/// commit made in a worktree (existing_issues.md — git worktree support).
fn git_dir(repo: &PathBuf) -> PathBuf {
    let dot_git = repo.join(".git");
    if dot_git.is_file() {
        if let Ok(content) = std::fs::read_to_string(&dot_git) {
            if let Some(rest) = content.lines().find_map(|l| l.trim().strip_prefix("gitdir:")) {
                let p = PathBuf::from(rest.trim());
                // worktree pointers are usually absolute; resolve a relative one against the repo
                return if p.is_absolute() { p } else { repo.join(p) };
            }
        }
    }
    dot_git
}

fn git_log_path(repo: &PathBuf) -> PathBuf {
    git_dir(repo).join("logs").join("HEAD")
}

fn reflog_line_count(p: &PathBuf) -> usize {
    std::fs::read_to_string(p)
        .map(|s| s.lines().count())
        .unwrap_or(0)
}

/// Hearthmon's own rolling README status-card commit message — filtered out of the commit
/// watcher (7.2) and reused by `push_card`, so the two can never drift apart.
const CARD_COMMIT_MSG: &str = "chore: Hearthmon status card";

/// A reflog line is `<old> <new> <name> <email> <ts> <tz>\t<action>: <message>`.
/// Return the commit message only when the line records a *new commit* — not a
/// checkout / reset / merge fast-forward / rebase step / pull.
fn parse_commit(line: &str) -> Option<String> {
    let action = line.split('\t').nth(1)?;
    if !action.starts_with("commit") {
        return None;
    }
    let msg = action.splitn(2, ": ").nth(1).unwrap_or("").trim();
    // Ignore Hearthmon's own rolling status-card commit so the companion never "celebrates"
    // its own automated push (existing_issues.md 7.2).
    if msg.is_empty() || msg == CARD_COMMIT_MSG {
        None
    } else {
        Some(msg.to_string())
    }
}

#[tauri::command]
fn git_set_repo(state: tauri::State<'_, Mutex<GitWatch>>, path: String) -> Result<(), String> {
    let repo = PathBuf::from(&path);
    if !repo.join(".git").exists() {
        return Err("That folder isn't a git repository.".into());
    }
    let mut g = state.lock().map_err(|_| "watch state poisoned".to_string())?;
    g.seen = reflog_line_count(&git_log_path(&repo)); // start from now, not the past
    g.repo = Some(repo);
    Ok(())
}

#[tauri::command]
fn git_clear_repo(state: tauri::State<'_, Mutex<GitWatch>>) {
    if let Ok(mut g) = state.lock() {
        g.repo = None;
        g.seen = 0;
    }
}

/// Poll the watched repo's reflog every few seconds; emit `git-commit` (with the
/// commit message) for each genuinely new commit.
fn spawn_git_watcher(handle: tauri::AppHandle) {
    // each lock lives in its own scope so the State handle / MutexGuard never
    // outlive their borrow across the loop body.
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(3));
        if !handle.state::<Visible>().0.load(Ordering::Relaxed) {
            continue; // hidden to tray → don't touch disk
        }

        // snapshot the current watch target (no `state` local → no borrow that
        // outlives the guard; the lock temporary drops at the end of this stmt)
        let (repo, seen) = match handle.state::<Mutex<GitWatch>>().lock() {
            Ok(g) => (g.repo.clone(), g.seen),
            Err(_) => continue,
        };
        let Some(repo) = repo else { continue };

        let content = match std::fs::read_to_string(git_log_path(&repo)) {
            Ok(c) => c,
            Err(_) => continue, // no commits yet, or unreadable — try again later
        };
        let total = content.lines().count();

        if total <= seen {
            if total < seen {
                // history rewritten / gc'd — resync so we don't miss future commits
                match handle.state::<Mutex<GitWatch>>().lock() {
                    Ok(mut g) => g.seen = total,
                    Err(_) => {}
                }
            }
            continue;
        }

        for line in content.lines().skip(seen) {
            if let Some(msg) = parse_commit(line) {
                let _ = handle.emit("git-commit", msg);
            }
        }

        match handle.state::<Mutex<GitWatch>>().lock() {
            Ok(mut g) => g.seen = total,
            Err(_) => {}
        }
    });
}

// ── Build / Training Awareness ─────────────────────────────────────
// Poll nvidia-smi so the companion can react to GPU training runs (the
// recruiter-killer: a Pokémon that knows when you're training a model).
// §7.10: KEPT on purpose (not removed). Training awareness pivoted to log-watch because the dev
// machine is Intel Arc, but a friend on an NVIDIA box still benefits — and on non-NVIDIA hosts
// `gpu_stat` returns available:false so the frontend stops polling and never nags. Removing it
// would drop a working capability for NVIDIA users; the cost of keeping it is ~nil.
#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000; // don't flash a console each poll

#[derive(serde::Serialize, Default)]
struct GpuStat {
    available: bool,
    util: u32,      // GPU utilisation %
    mem_used: u32,  // MiB
    mem_total: u32, // MiB
    temp: u32,      // °C
    procs: u32,     // running compute processes
}

fn nvsmi(args: &[&str]) -> Option<String> {
    let mut c = std::process::Command::new("nvidia-smi");
    c.args(args);
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);
    let out = c.output().ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).to_string())
}

/// Read GPU utilisation + compute-process count. `available:false` when there's
/// no NVIDIA GPU / nvidia-smi isn't on PATH — the frontend then stops polling
/// and never nags.
#[tauri::command]
fn gpu_stat() -> GpuStat {
    let mut s = GpuStat::default();
    let Some(q) = nvsmi(&[
        "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu",
        "--format=csv,noheader,nounits",
    ]) else {
        return s;
    };
    if let Some(line) = q.lines().next() {
        let p: Vec<&str> = line.split(',').map(|x| x.trim()).collect();
        if p.len() >= 4 {
            s.util = p[0].parse().unwrap_or(0);
            s.mem_used = p[1].parse().unwrap_or(0);
            s.mem_total = p[2].parse().unwrap_or(0);
            s.temp = p[3].parse().unwrap_or(0);
            s.available = true;
        }
    }
    // count rows whose first column is a real PID (ignores "No running processes")
    if let Some(apps) = nvsmi(&["--query-compute-apps=pid", "--format=csv,noheader"]) {
        s.procs = apps
            .lines()
            .filter(|l| {
                l.trim()
                    .split(',')
                    .next()
                    .and_then(|x| x.trim().parse::<u32>().ok())
                    .is_some()
            })
            .count() as u32;
    }
    s
}

// ── Flow Awareness (working-tree save cadence) ─────────────────────
// We can't see your editor, but `git status`/`git diff` over the watched repo
// reveal the TEXTURE of a session — saves, churn — without an IDE extension and
// while honouring .gitignore (no node_modules noise). The frontend turns this
// into flow / struggle / breakthrough companionship.
fn git_capture(repo: &PathBuf, args: &[&str]) -> String {
    let mut c = std::process::Command::new("git");
    c.current_dir(repo).args(args);
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);
    c.output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

/// Poll the watched repo's working tree every 6s; emit `repo-active` (with the
/// dirty-file count) whenever the uncommitted state changes — i.e. you saved.
fn spawn_repo_activity_watcher(handle: tauri::AppHandle) {
    // Adaptive cadence: on a huge monorepo (kernel/Chromium) `git status` can take seconds and
    // contend on `.git/index`. Polling every 6s there means continuous disk churn + battery drain
    // (existing_issues.md §3). So we time each poll and back off (up to 60s) when it's expensive,
    // snapping back to 6s when it's cheap again.
    const FAST: std::time::Duration = std::time::Duration::from_secs(6);
    const SLOW_MAX: std::time::Duration = std::time::Duration::from_secs(60);
    std::thread::spawn(move || {
        let mut last = String::new();
        let mut primed = false; // skip the first sight so we don't fire on launch
        let mut interval = FAST;
        loop {
            std::thread::sleep(interval);
            if !handle.state::<Visible>().0.load(Ordering::Relaxed) {
                continue; // hidden to tray → don't spawn git / hit disk
            }
            let repo = match handle.state::<Mutex<GitWatch>>().lock() {
                Ok(g) => g.repo.clone(),
                Err(_) => continue,
            };
            let Some(repo) = repo else {
                last.clear();
                primed = false;
                interval = FAST; // forget any monorepo backoff once the repo is cleared
                continue;
            };
            // porcelain = which files are dirty; numstat = how much (changes on
            // every save, even re-saving the same already-dirty file)
            let t0 = std::time::Instant::now();
            let snap = format!(
                "{}\n{}",
                git_capture(&repo, &["status", "--porcelain"]),
                git_capture(&repo, &["diff", "--numstat"])
            );
            let cost = t0.elapsed();
            // expensive repo → stretch the interval; cheap → return to the responsive 6s
            interval = if cost > std::time::Duration::from_millis(1500) {
                (interval * 2).min(SLOW_MAX)
            } else if cost < std::time::Duration::from_millis(400) {
                FAST
            } else {
                interval
            };
            if !primed {
                last = snap;
                primed = true;
                continue;
            }
            if snap != last {
                last = snap.clone();
                let dirty = snap.lines().filter(|l| !l.trim().is_empty()).count() as u32;
                let _ = handle.emit("repo-active", dirty);
            }
        }
    });
}

// ── Builder State: foreground-app rhythm (flow vs. friction) ───────
// We read ONLY the foreground process NAME (never the window title, keystrokes,
// or any content) so the companion can sense effort density across the whole
// machine — a Kaggle notebook, a debug session, docs-reading — not just git.
// Opt-out via `set_flow_aware(false)`.
struct FlowAware(AtomicBool);

#[tauri::command]
fn set_flow_aware(state: tauri::State<'_, FlowAware>, on: bool) {
    state.0.store(on, Ordering::Relaxed);
}

fn app_category(proc_name: &str) -> &'static str {
    const EDITORS: &[&str] = &[
        "code.exe", "cursor.exe", "devenv.exe", "idea64.exe", "pycharm64.exe", "sublime_text.exe",
        "rider64.exe", "clion64.exe", "webstorm64.exe", "goland64.exe", "studio64.exe",
        "windsurf.exe", "zed.exe",
    ];
    const TERMS: &[&str] = &[
        "windowsterminal.exe", "wt.exe", "cmd.exe", "powershell.exe", "pwsh.exe", "conhost.exe",
        "alacritty.exe", "wezterm-gui.exe", "kitty.exe",
    ];
    const BROWSERS: &[&str] = &[
        "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "arc.exe", "zen.exe",
        "vivaldi.exe",
    ];
    // Layer 2 (audio source context): dedicated media players → "music"; calls → "comms". Process
    // NAME only (never titles/URLs) — same privacy bar as the rest of flow-awareness.
    const MUSIC: &[&str] = &[
        "spotify.exe", "music.exe", "applemusic.exe", "musicbee.exe", "foobar2000.exe", "itunes.exe",
        "deezer.exe", "tidal.exe", "aimp.exe", "winamp.exe", "ytmdesktop.exe", "audacious.exe",
        "clementine.exe", "strawberry.exe",
    ];
    const COMMS: &[&str] = &[
        "discord.exe", "zoom.exe", "teams.exe", "ms-teams.exe", "msteams.exe", "slack.exe",
        "skype.exe", "telegram.exe", "webexmta.exe",
    ];
    if MUSIC.contains(&proc_name) {
        "music"
    } else if COMMS.contains(&proc_name) {
        "comms"
    } else if EDITORS.contains(&proc_name) || proc_name.contains("idea") || proc_name.contains("pycharm") {
        "editor"
    } else if TERMS.contains(&proc_name) {
        "terminal"
    } else if BROWSERS.contains(&proc_name) {
        "browser"
    } else {
        "other"
    }
}

/// Result of reading the foreground window's process.
#[cfg(windows)]
enum Foreground {
    Name(String), // resolved foreground exe (lowercased file name)
    Denied,       // a real foreground window we're not allowed to open (elevated / higher integrity)
    None,         // no foreground window at all
}

#[cfg(windows)]
fn foreground_proc() -> Foreground {
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, ERROR_ACCESS_DENIED, ERROR_INSUFFICIENT_BUFFER,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return Foreground::None;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return Foreground::None;
        }
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h == 0 {
            // Mandatory Integrity Control: a Medium-integrity Hearthmon can't open a High-integrity
            // foreground (elevated shell / IDE-as-admin / Task Manager) → ERROR_ACCESS_DENIED. That
            // is NOT idleness — the user is actively at the keyboard; flag it so we don't degrade to
            // "other" and misread their debugging session as unrelated activity (existing_issues.md §1).
            return if GetLastError() == ERROR_ACCESS_DENIED {
                Foreground::Denied
            } else {
                Foreground::None
            };
        }
        // Grow the buffer until the full path fits. The old fixed 260-wchar buffer made any
        // long path (deeply-nested conda/npm/temp installs, long-paths enabled) fail to resolve,
        // collapsing real editors to "other" — the same end-state as the Admin Drop (§7.4).
        let mut cap = 1024usize;
        let name = loop {
            let mut buf = vec![0u16; cap];
            let mut len = cap as u32;
            if QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut len) != 0 {
                let s = String::from_utf16_lossy(&buf[..len as usize]);
                break s.rsplit(|c| c == '\\' || c == '/').next().map(|x| x.to_lowercase());
            }
            if GetLastError() == ERROR_INSUFFICIENT_BUFFER && cap < 32_768 {
                cap *= 2; // path longer than the buffer → grow and retry
                continue;
            }
            break None;
        };
        CloseHandle(h);
        match name {
            Some(n) => Foreground::Name(n),
            None => Foreground::None,
        }
    }
}

/// Poll the foreground app every 4s; emit `focus-app` (the category) when it
/// changes. The frontend turns the rhythm into flow / friction companionship.
#[cfg(windows)]
fn spawn_focus_watcher(handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut last = String::new();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(4));
            if !handle.state::<Visible>().0.load(Ordering::Relaxed) {
                continue; // hidden to tray → stop sampling the foreground
            }
            if !handle.state::<FlowAware>().0.load(Ordering::Relaxed) {
                continue; // opted out — never look
            }
            match foreground_proc() {
                Foreground::Name(p) => {
                    let cat = app_category(&p);
                    if cat != last {
                        last = cat.to_string();
                        let _ = handle.emit("focus-app", cat);
                    }
                }
                // Elevated/inaccessible foreground → the user IS working on something we can't name.
                // Hold the current category instead of emitting "other" so flow stays intact (§1).
                Foreground::Denied => {}
                Foreground::None => {
                    if last != "other" {
                        last = "other".to_string();
                        let _ = handle.emit("focus-app", "other");
                    }
                }
            }
        }
    });
}

// Flow Awareness reads the Win32 foreground process; there's no portable equivalent, so on
// macOS/Linux this is an intentional no-op (the frontend simply never receives `focus-app`
// and falls back to its git/log signals). Documented stub, not a silent gap (§1 cross-platform).
#[cfg(not(windows))]
fn spawn_focus_watcher(_handle: tauri::AppHandle) {}

// ── Music awareness: read system AUDIO OUTPUT (opt-in) ─────────────
// We capture the system's playback via WASAPI loopback and emit ONLY ephemeral
// energy bands (bass / mid / high / level) ~30×/s. No audio is recorded, stored,
// or transmitted — the raw samples never leave the callback. Off by default;
// the companion only listens when the user turns it on (`set_audio_aware`).
struct AudioAware(AtomicBool);

#[tauri::command]
fn set_audio_aware(state: tauri::State<'_, AudioAware>, on: bool) {
    state.0.store(on, Ordering::Relaxed);
}

// Window visibility — flipped on show/hide so the background watchers can stop polling (disk
// I/O + spawned git processes) while the app is hidden to tray. "Quit"/✕ only hide the window,
// so without this they'd churn forever while the user thinks the app is closed (7.3).
struct Visible(AtomicBool);

// ── Startup: was this launch triggered by Windows autostart? ───────
// Autostart registers the app with a `--autostarted` arg (see init); the frontend
// reads this to ASK before fully showing — "start Hearthmon now?" — so boot-launch
// stays a choice, not an ambush.
#[tauri::command]
fn is_autostart_launch() -> bool {
    std::env::args().any(|a| a == "--autostarted")
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Bring the widget on top so a gentle reminder is actually SEEN even when tucked in the tray —
/// but WITHOUT stealing keyboard focus (the window is always-on-top, so showing it is enough).
/// Mirrors `show_main` minus `set_focus`, and resumes the watchers/audio it had paused on hide.
#[tauri::command]
fn surface_window(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        app.state::<Visible>().0.store(true, Ordering::Relaxed);
        let _ = app.emit("hm-visible", true);
    }
}

// Dev builds load the Vite server (localhost) — registering THIS exe for autostart
// would boot a broken "localhost refused" window. Only allow autostart on a release exe.
#[tauri::command]
fn is_dev_build() -> bool {
    cfg!(debug_assertions)
}

/// Build a loopback capture on the CURRENT default output device. Returns the stream plus the
/// device name it bound to, so the watcher can notice when the default device later changes
/// (unplugged headphones → speakers) and rebuild — otherwise the stream stays bound to a gone
/// device and audio awareness silently dies until restart (existing_issues.md — audio device
/// invalidation). `err_flag` is raised from the stream's error callback for the same reason.
// Raw mono samples at the device rate, shared from the loopback callback (producer) to the YAMNet
// classifier thread (consumer). Bounded to ~2s. The classifier resamples to 16kHz on read. This is
// the ONLY place raw audio is buffered, and it never leaves the process (same soul rule as bands).
#[derive(Default)]
struct AudioRing {
    samples: std::collections::VecDeque<f32>,
    sr: u32,
    updated: Option<std::time::Instant>, // last producer write — lets the classifier skip a stale
                                         // buffer on pause instead of re-emitting phantom "music"
}

#[cfg(windows)]
fn build_loopback(
    handle: &tauri::AppHandle,
    err_flag: std::sync::Arc<AtomicBool>,
    ring: std::sync::Arc<std::sync::Mutex<AudioRing>>,
) -> Option<(cpal::Stream, String)> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    let host = cpal::default_host();
    let device = host.default_output_device()?; // loopback = INPUT stream on OUTPUT device
    let device_name = device.name().unwrap_or_default();
    let supported = device.default_output_config().ok()?;
    if supported.sample_format() != cpal::SampleFormat::F32 {
        return None; // shared-mode Windows output is virtually always f32
    }
    let cfg = supported.config();
    let sr = cfg.sample_rate.0 as f32;
    let ch = cfg.channels.max(1) as usize;
    let a1 = 1.0 - (-2.0 * std::f32::consts::PI * 200.0 / sr).exp(); // bass cutoff ~200Hz
    let a2 = 1.0 - (-2.0 * std::f32::consts::PI * 2000.0 / sr).exp(); // mid/high split ~2kHz
    let (mut lp1, mut lp2) = (0f32, 0f32);
    let (mut sb, mut sm, mut sh, mut n) = (0f32, 0f32, 0f32, 0u32);
    // AGC peak for normalisation. Decay must be fast enough that a one-off transient (a Windows
    // error chime, a notification) doesn't pin `peak` high and suppress real music for ~20s+
    // (existing_issues.md §4). 0.995 @30Hz ≈ a ~4.6s half-life — recovers in seconds, still smooth.
    let mut peak = 0.0008f32;
    let mut last = std::time::Instant::now();
    let h = handle.clone();
    // record the device rate so the classifier knows how to resample; reset stale samples on rebuild
    if let Ok(mut r) = ring.lock() {
        r.sr = sr as u32;
        r.samples.clear();
    }
    let ring_cb = ring.clone();
    let stream = device
        .build_input_stream(
            &cfg,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let mut mono = Vec::with_capacity(data.len() / ch + 1);
                for frame in data.chunks(ch) {
                    let x = frame.iter().copied().sum::<f32>() / ch as f32;
                    mono.push(x); // feed the YAMNet ring (speech-vs-music vote), separate from bands
                    lp1 += a1 * (x - lp1);
                    lp2 += a2 * (x - lp2);
                    let bass = lp1;
                    let mid = lp2 - lp1;
                    let high = x - lp2;
                    sb += bass * bass;
                    sm += mid * mid;
                    sh += high * high;
                    n += 1;
                }
                // push this block to the classifier ring every callback (independent of the 33ms
                // band-emit throttle and the silence gate below), bounded to ~2s of audio.
                if let Ok(mut r) = ring_cb.lock() {
                    let cap = (r.sr as usize).max(16000) * 2;
                    r.samples.extend(mono.iter().copied());
                    while r.samples.len() > cap {
                        r.samples.pop_front();
                    }
                    r.updated = Some(std::time::Instant::now());
                }
                if n > 0 && last.elapsed().as_millis() >= 33 {
                    let nn = n as f32;
                    let (b, m, hi) = ((sb / nn).sqrt(), (sm / nn).sqrt(), (sh / nn).sqrt());
                    let lvl = (b + m + hi) / 3.0;
                    // SILENCE GATE: the AGC `peak` decays toward its 0.0008 floor, so during a pause the
                    // tiny residual noise floor gets normalised UP into a "loud" reading and the UI keeps
                    // reacting to nothing. Below an absolute RMS floor (~-60 dBFS), it's silence — emit
                    // zeros so the frontend rests instead of chasing amplified hiss. (Tunable.)
                    const SILENCE: f32 = 0.0010;
                    if lvl < SILENCE {
                        let _ = h.emit("audio-bands", (0.0f32, 0.0f32, 0.0f32, 0.0f32));
                        sb = 0.0; sm = 0.0; sh = 0.0; n = 0;
                        last = std::time::Instant::now();
                        return;
                    }
                    peak = (peak * 0.995).max(lvl).max(0.0008); // faster decay → no minutes-long suppression (§4)
                    let nz = |v: f32| (v / peak).clamp(0.0, 1.0);
                    let _ = h.emit("audio-bands", (nz(b), nz(m), nz(hi), nz(lvl)));
                    sb = 0.0; sm = 0.0; sh = 0.0; n = 0;
                    last = std::time::Instant::now();
                }
            },
            move |e| {
                eprintln!("[hearthmon] audio stream error: {e}");
                err_flag.store(true, Ordering::Relaxed); // device likely invalidated → ask for a rebuild
            },
            None,
        )
        .ok()?;
    stream.play().ok()?;
    Some((stream, device_name))
}

/// Hold the loopback stream alive only while the user has music-awareness on.
/// The cpal Stream is !Send, so it's built and dropped on this owning thread.
#[cfg(windows)]
fn spawn_audio_watcher(handle: tauri::AppHandle) {
    use cpal::traits::{DeviceTrait, HostTrait};
    // shared raw-audio ring feeding the YAMNet classifier thread (speech-vs-music vote)
    let ring = std::sync::Arc::new(std::sync::Mutex::new(AudioRing::default()));
    spawn_audio_classifier(handle.clone(), ring.clone());
    std::thread::spawn(move || {
        let mut stream: Option<cpal::Stream> = None;
        let mut bound_device = String::new(); // the output device our stream is bound to
        let err_flag = std::sync::Arc::new(AtomicBool::new(false)); // raised by the stream error cb
        loop {
            std::thread::sleep(std::time::Duration::from_millis(300));
            // capture only when opted in AND visible — drop the stream when hidden so we don't
            // process audio for a window the user thinks is closed (7.3 / "silent while hidden")
            let want = handle.state::<AudioAware>().0.load(Ordering::Relaxed)
                && handle.state::<Visible>().0.load(Ordering::Relaxed);
            if !want {
                if stream.is_some() {
                    stream = None; // drop → capture stops immediately
                    bound_device.clear();
                    err_flag.store(false, Ordering::Relaxed);
                }
                continue;
            }

            // The default output device can change under us (headphones unplugged, swapped to
            // speakers). A cpal stream stays bound to its original device, so it goes silent
            // forever. Rebuild when the stream errored OR the current default device differs
            // from the one we bound to.
            let now_device = cpal::default_host()
                .default_output_device()
                .and_then(|d| d.name().ok())
                .unwrap_or_default();
            if stream.is_some()
                && (err_flag.load(Ordering::Relaxed) || now_device != bound_device)
            {
                stream = None; // drop the dead/stale stream before rebuilding
            }
            if stream.is_none() {
                err_flag.store(false, Ordering::Relaxed);
                if let Some((s, name)) = build_loopback(&handle, err_flag.clone(), ring.clone()) {
                    stream = Some(s);
                    bound_device = name;
                }
                // build failed (device mid-switch / none present) → retry next tick
            }
        }
    });
}

#[cfg(not(windows))]
fn spawn_audio_watcher(_handle: tauri::AppHandle) {}

/// YAMNet audio-class vote: every ~700ms, take the most recent ~0.96s from the ring, resample to
/// 16kHz, run the YAMNet core, and emit `audio-class` = (music_prob, speech_prob). The model is
/// loaded LAZILY on first opt-in (privacy-off-by-default keeps ~15MB unloaded until the user asks).
/// This is the strong vote the Moment Engine can't get from heuristics — speech vs music.
#[cfg(windows)]
fn spawn_audio_classifier(handle: tauri::AppHandle, ring: std::sync::Arc<std::sync::Mutex<AudioRing>>) {
    std::thread::spawn(move || {
        let mut clf: Option<audio_class::Classifier> = None;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(700));
            let want = handle.state::<AudioAware>().0.load(Ordering::Relaxed)
                && handle.state::<Visible>().0.load(Ordering::Relaxed);
            if !want {
                continue;
            }
            if clf.is_none() {
                match audio_class::Classifier::load() {
                    Ok(c) => clf = Some(c),
                    Err(e) => {
                        eprintln!("[hearthmon] yamnet load failed: {e}");
                        std::thread::sleep(std::time::Duration::from_secs(10));
                        continue;
                    }
                }
            }
            let (data, sr, fresh) = {
                let r = ring.lock().unwrap();
                let fresh = matches!(r.updated, Some(t) if t.elapsed().as_millis() < 400);
                (r.samples.iter().copied().collect::<Vec<f32>>(), r.sr, fresh)
            };
            // skip a stale buffer (producer paused) so we don't re-emit phantom classes
            if !fresh || sr == 0 {
                continue;
            }
            // +64 samples of headroom: linear resampling rounds the output length down by up to a
            // sample, which would leave us 1 short of a full patch (classify -> None). Grab a hair
            // more device audio so the 16k window is always >= one patch; classify takes the newest.
            let need_dev = ((audio_class::PATCH_SAMPLES + 64) as f32 * sr as f32 / 16000.0).ceil() as usize;
            if data.len() < need_dev {
                continue; // not enough audio buffered yet (just started / silent)
            }
            let wav16 = audio_class::resample_to_16k(&data[data.len() - need_dev..], sr);
            if let Some((music, speech)) = clf.as_ref().unwrap().classify(&wav16) {
                let _ = handle.emit("audio-class", (music, speech));
            }
        }
    });
}

#[cfg(not(windows))]
fn spawn_audio_classifier(_h: tauri::AppHandle, _r: std::sync::Arc<std::sync::Mutex<AudioRing>>) {}

// ── Layer 2: which PROCESS is actually emitting audio (WASAPI sessions) ───────────
// The decisive source signal: enumerate the default render device's audio sessions, take the one
// with the loudest current peak (= what you're actually hearing), resolve its process NAME, and
// classify it (music/comms/browser/…). Works even when the player is in the BACKGROUND (coding +
// Spotify) — which the foreground app can never tell us. Process name only — no titles, no content.
#[cfg(windows)]
fn proc_name_of(pid: u32) -> Option<String> {
    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, ERROR_INSUFFICIENT_BUFFER};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h == 0 {
            return None;
        }
        let mut cap = 1024usize;
        let out = loop {
            let mut buf = vec![0u16; cap];
            let mut len = cap as u32;
            if QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut len) != 0 {
                let s = String::from_utf16_lossy(&buf[..len as usize]);
                break s.rsplit(|c| c == '\\' || c == '/').next().map(|x| x.to_lowercase());
            }
            if GetLastError() == ERROR_INSUFFICIENT_BUFFER && cap < 32_768 {
                cap *= 2;
                continue;
            }
            break None;
        };
        CloseHandle(h);
        out
    }
}

/// (category, exe-name) of the process producing the loudest audio on the default output (or None).
#[cfg(windows)]
fn active_audio_source() -> Option<(String, String)> {
    use windows::core::Interface;
    use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator,
        MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
    unsafe {
        let enumr: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let device = enumr.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
        let mgr: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None).ok()?;
        let sessions = mgr.GetSessionEnumerator().ok()?;
        let count = sessions.GetCount().ok()?;
        let own_pid = std::process::id();
        let mut best_peak = 0.0f32;
        let mut best_pid = 0u32;
        for i in 0..count {
            let ctrl = match sessions.GetSession(i) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let meter: IAudioMeterInformation = match ctrl.cast() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let peak = meter.GetPeakValue().unwrap_or(0.0);
            if peak < 0.01 || peak <= best_peak {
                continue; // inaudible / not the loudest session
            }
            let ctrl2: IAudioSessionControl2 = match ctrl.cast() {
                Ok(c) => c,
                Err(_) => continue,
            };
            let pid = ctrl2.GetProcessId().unwrap_or(0);
            if pid == 0 || pid == own_pid {
                continue; // system sounds, OR our own audio (cries/sfx) — never the music source
            }
            best_peak = peak;
            best_pid = pid;
        }
        if best_pid == 0 {
            return None;
        }
        let name = proc_name_of(best_pid)?;
        Some((app_category(&name).to_string(), name))
    }
}

/// Poll the active audio source ~1.5s while music-awareness is on; emit `audio-source` on change.
#[cfg(windows)]
fn spawn_audio_source_watcher(handle: tauri::AppHandle) {
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
    std::thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
        let mut last = String::new();
        loop {
            std::thread::sleep(std::time::Duration::from_millis(1500));
            let want = handle.state::<AudioAware>().0.load(Ordering::Relaxed)
                && handle.state::<Visible>().0.load(Ordering::Relaxed);
            if !want {
                last.clear();
                continue;
            }
            let payload = active_audio_source()
                .map(|(cat, name)| format!("{cat}|{name}"))
                .unwrap_or_default();
            if payload != last {
                last = payload.clone();
                let _ = handle.emit("audio-source", payload); // "category|exe.name"
            }
        }
    });
}
#[cfg(not(windows))]
fn spawn_audio_source_watcher(_handle: tauri::AppHandle) {}

// ── Training Awareness via log-watch ───────────────────────────────
// The user points us at a training log file OR a folder (we follow the
// newest file in it). We tail appended lines and emit `train-log` for each;
// the frontend matches epoch/loss/done/crash patterns. Works no matter where
// the compute actually runs (this laptop, a lab box, Colab synced to a dir).
#[derive(Default)]
struct LogWatch {
    path: Option<PathBuf>, // file or directory the user chose
    file: Option<PathBuf>, // the concrete file currently being followed
    pos: u64,              // byte offset already emitted
}

/// A run folder holds more than logs — checkpoints, datasets, images. When the user points us at
/// a directory we must not follow the newest `model.pt` / `checkpoint.ckpt` / `.zip` / `.png`;
/// restrict the auto-pick to text logs (`.log` / `.txt`, or any name containing "log" such as
/// `training.log` / `output.log`). A file the user points at DIRECTLY is honoured as-is — this
/// only filters the directory auto-pick (existing_issues.md — log file type filtering).
fn is_log_file(p: &std::path::Path) -> bool {
    let ext_ok = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let e = e.to_ascii_lowercase();
            e == "log" || e == "txt"
        })
        .unwrap_or(false);
    let name_ok = p
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.to_ascii_lowercase().contains("log"))
        .unwrap_or(false);
    ext_ok || name_ok
}

fn newest_log(dir: &PathBuf) -> Option<PathBuf> {
    // §2-secondary (NTFS mtime lag): a file open in append mode may not refresh its directory
    // LastWriteTime until the writer flushes, so this `modified()` ranking can be a little stale
    // when first PICKING which file to follow. Accepted: once a file is chosen the watcher tails
    // appended BYTES directly each tick (no mtime dependence), so steady-state lag is negligible;
    // only the initial/switch selection can lag, and forcing a foreign writer to flush isn't ours.
    std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file() && is_log_file(p))
        .max_by_key(|p| std::fs::metadata(p).and_then(|m| m.modified()).ok())
}

fn resolve_target(path: &PathBuf) -> Option<PathBuf> {
    if path.is_dir() {
        newest_log(path)
    } else if path.is_file() {
        Some(path.clone())
    } else {
        None
    }
}

/// Read bytes appended to `file` since `pos`; returns (text, new_len). Resets to
/// the start if the file was truncated/rotated under us.
fn read_from(file: &PathBuf, pos: u64) -> Option<(String, u64)> {
    // Bound the allocation: a crashing trainer can dump a multi-GB traceback, and a suspended
    // app can let a huge chunk accumulate. Never slurp more than MAX_READ in one tick — if a
    // giant slice is pending, skip ahead and tail only its newest bytes (existing_issues.md §2).
    const MAX_READ: u64 = 1 << 20; // 1 MiB
    let mut f = std::fs::File::open(file).ok()?;
    let len = f.metadata().ok()?.len();
    let start = if pos > len {
        0 // file truncated/rotated under us → restart from the top
    } else if len - pos > MAX_READ {
        len - MAX_READ // huge backlog → jump to the tail so we can't OOM
    } else {
        pos
    };
    f.seek(SeekFrom::Start(start)).ok()?;
    let mut bytes = Vec::new();
    f.take(len - start).read_to_end(&mut bytes).ok()?;
    Some((String::from_utf8_lossy(&bytes).to_string(), len))
}

#[tauri::command]
fn log_set_path(state: tauri::State<'_, Mutex<LogWatch>>, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("That path doesn't exist.".into());
    }
    let mut g = state.lock().map_err(|_| "watch state poisoned".to_string())?;
    let target = resolve_target(&p);
    // attach at the END of the current newest file so we never replay an old run
    g.pos = target
        .as_ref()
        .and_then(|t| std::fs::metadata(t).ok())
        .map(|m| m.len())
        .unwrap_or(0);
    g.file = target;
    g.path = Some(p);
    Ok(())
}

#[tauri::command]
fn log_clear(state: tauri::State<'_, Mutex<LogWatch>>) {
    if let Ok(mut g) = state.lock() {
        g.path = None;
        g.file = None;
        g.pos = 0;
    }
}

/// Poll the watched log every 2s; emit `train-newfile` when a fresh run file
/// appears and `train-log` for each newly-appended line.
fn spawn_log_watcher(handle: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(2));
        if !handle.state::<Visible>().0.load(Ordering::Relaxed) {
            continue; // hidden to tray → don't tail the log
        }

        let (path, file, pos) = match handle.state::<Mutex<LogWatch>>().lock() {
            Ok(g) => (g.path.clone(), g.file.clone(), g.pos),
            Err(_) => continue,
        };
        let Some(path) = path else { continue };
        let Some(target) = resolve_target(&path) else { continue };

        let new_file = file.as_ref() != Some(&target);
        let start_pos = if new_file { 0 } else { pos };
        let Some((chunk, len)) = read_from(&target, start_pos) else { continue };

        if new_file {
            let name = target
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let _ = handle.emit("train-newfile", name);
        }
        for line in chunk.lines() {
            let t = line.trim();
            if !t.is_empty() {
                let _ = handle.emit("train-log", t.to_string());
            }
        }

        if let Ok(mut g) = handle.state::<Mutex<LogWatch>>().lock() {
            g.file = Some(target);
            g.pos = len;
        }
    });
}

/// Write a generated README card (SVG) to disk — used by the "Living Companion"
/// feature so the user can commit a live status card into their repo.
#[tauri::command]
fn write_card(path: String, svg: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(dir) = p.parent() {
        let _ = std::fs::create_dir_all(dir); // ensure assets/ exists
    }
    std::fs::write(p, svg).map_err(|e| e.to_string())
}

/// Build a `git` command rooted at `repo`, with the console window suppressed on
/// Windows so the periodic auto-push doesn't flash a terminal at the user.
fn git_cmd(repo: &std::path::Path) -> std::process::Command {
    let mut c = std::process::Command::new("git");
    c.current_dir(repo);
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

/// Automatically push the README card to GitHub.
/// Also rewrites the static companion text block in README.md so it stays in sync.
#[tauri::command]
fn push_card(path: String, companion: String, mood: String, status: String) -> Result<(), String> {
    let repo_path = std::path::Path::new(&path);

    // §8.3 — never interfere with a repo you're actively coding in. The card flow only touches its
    // OWN two files; if the working tree has uncommitted changes to anything ELSE, skip this repo
    // entirely (don't `rebase --autostash` your WIP, don't force-push the branch you're on). The
    // mirror is for DEDICATED profile/showcase repos; a dev clone (e.g. on `v2`) is left untouched.
    {
        const CARD_FILES: &[&str] = &["assets/hearthmon-status.svg", "README.md"];
        let porcelain = git_capture(&repo_path.to_path_buf(), &["status", "--porcelain"]);
        let has_unrelated = porcelain.lines().any(|line| {
            let line = line.trim_end();
            // Untracked files ("?? path") are never added/stashed/pushed by the card flow (it adds
            // only the card files + autostashes TRACKED changes), so they're safe — don't block on
            // them, only on tracked modifications to non-card files.
            if line.is_empty() || line.starts_with("??") {
                return false;
            }
            // porcelain: "XY <path>" (rename: "R  old -> new"); take the post-status / new path.
            let p = line.get(3..).unwrap_or("").trim();
            let p = p.rsplit(" -> ").next().unwrap_or(p);
            !CARD_FILES.contains(&p)
        });
        if has_unrelated {
            return Err("Skipped the card push — this repo has uncommitted changes you're working \
                        on. Mirror only dedicated profile/showcase repos."
                .into());
        }
    }

    // Integrate any remote changes FIRST (e.g. a README edited on github.com) so
    // the amend + --force-with-lease below can't be rejected as "stale info".
    let branch = git_cmd(repo_path)
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "main".to_string());
    let _ = git_cmd(repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .args(["fetch", "origin"])
        .status();
    let rebased = git_cmd(repo_path)
        .args(["rebase", "--autostash", &format!("origin/{branch}")])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !rebased {
        // Conflict: we could NOT integrate the remote's changes. Abort to leave the repo clean
        // and BAIL — force-pushing now would overwrite remote work we failed to merge (the fetch
        // above already refreshed the lease baseline, so a bare --force-with-lease can't catch it).
        // See existing_issues.md 7.1.
        let _ = git_cmd(repo_path).args(["rebase", "--abort"]).status();
        return Err("Remote and local have diverged — skipped the card push to avoid overwriting your repo.".into());
    }
    // The remote SHA we just integrated onto. We pin the lease to THIS at push time so the
    // force can only fast-forward over our own card commit, never clobber a commit that landed
    // concurrently (a bare --force-with-lease leases against the just-fetched ref → always passes).
    let lease_base = git_cmd(repo_path)
        .args(["rev-parse", &format!("origin/{branch}")])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty());

    let readme_path = repo_path.join("README.md");
    if let Ok(content) = std::fs::read_to_string(&readme_path) {
        use std::time::{SystemTime, UNIX_EPOCH};
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        
        // 1) Cache-bust the SVG src
        let mut new_content = String::new();
        let mut rest = content.as_str();
        while let Some(idx) = rest.find("hearthmon-status.svg") {
            new_content.push_str(&rest[..idx + "hearthmon-status.svg".len()]);
            rest = &rest[idx + "hearthmon-status.svg".len()..];
            if rest.starts_with("?v=") {
                let digits_len = rest[3..].find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len() - 3);
                rest = &rest[3 + digits_len..];
            }
            new_content.push_str(&format!("?v={}", ts));
        }
        new_content.push_str(rest);

        // 2) Rewrite the "Current Companion / Mood / Status" lines
        let re_companion = format!("**Current Companion:** {}<br/>", companion);
        let re_mood = format!("**Mood:** {}<br/>", mood);
        let re_status = format!("**Status:** *\"{}\"*<br/>", status);

        let updated = new_content
            .lines()
            .map(|line| {
                if line.starts_with("**Current Companion:**") {
                    re_companion.clone()
                } else if line.starts_with("**Mood:**") {
                    re_mood.clone()
                } else if line.starts_with("**Status:**") {
                    re_status.clone()
                } else {
                    line.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join("\n");

        let _ = std::fs::write(&readme_path, updated);
    }
    
    // git add
    let add_status = git_cmd(repo_path)
        .args(["add", "assets/hearthmon-status.svg", "README.md"])
        .status()
        .map_err(|e| e.to_string())?;
        
    if !add_status.success() {
        return Err("Failed to 'git add' the card.".into());
    }

    // To keep the profile clean, AMEND our own rolling card commit instead of
    // stacking a new commit every push — unless a real commit landed since.
    let last = git_cmd(repo_path)
        .args(["log", "-1", "--pretty=%s"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    let amend = last == CARD_COMMIT_MSG;

    let commit_args: Vec<&str> = if amend {
        vec!["commit", "--amend", "--no-edit"]
    } else {
        vec!["commit", "-m", CARD_COMMIT_MSG]
    };
    let _ = git_cmd(repo_path)
        .args(&commit_args)
        .status();

    // Pin the lease to the integrated remote SHA (lease_base). A bare --force-with-lease leases
    // against the just-fetched tracking ref, so it can never fail → silent clobber (7.1).
    let lease_flag = lease_base.as_ref().map(|b| format!("--force-with-lease={branch}:{b}"));
    let head_to_branch = format!("HEAD:{branch}");
    let push_status = if amend {
        match lease_flag.as_deref() {
            Some(flag) => git_cmd(repo_path)
                .env("GIT_TERMINAL_PROMPT", "0")
                .args(["push", "origin", flag, &head_to_branch])
                .status(),
            None => git_cmd(repo_path)
                .env("GIT_TERMINAL_PROMPT", "0")
                .args(["push", "--force-with-lease"])
                .status(),
        }
    } else {
        git_cmd(repo_path)
            .env("GIT_TERMINAL_PROMPT", "0") // fail fast instead of hanging on auth
            .args(["push", "-u", "origin", "HEAD"])
            .status()
    }
    .map_err(|e| e.to_string())?;

    if !push_status.success() {
        return Err("Failed to 'git push' to GitHub.".into());
    }

    Ok(())
}


// ── Sprite disk cache ─────────────────────────────────────────────────────────
// Pet/mega sprites are fetched live from raw.githubusercontent.com, which 429s
// (rate-limits) under active use → a blank pet. The FRONTEND fetches (the webview
// has CORS) and hands the bytes here to persist; on a later 429 it reads them back
// from disk. So each sprite hits GitHub at most once, ever. Cache: <app_cache>/sprites/.
fn sprite_cache_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let d = app.path().app_cache_dir().ok()?.join("sprites");
    std::fs::create_dir_all(&d).ok()?;
    Some(d)
}
// keys are opaque, frontend-sanitized filenames (e.g. "other_showdown_5.gif"); reject
// any path-traversal so a bad key can't read/write outside the cache dir.
fn safe_key(key: &str) -> bool {
    !key.is_empty() && key.len() < 200 && !key.contains('/') && !key.contains('\\') && !key.contains("..")
}

#[tauri::command]
fn read_sprite(app: tauri::AppHandle, key: String) -> Option<String> {
    if !safe_key(&key) {
        return None;
    }
    let bytes = std::fs::read(sprite_cache_dir(&app)?.join(&key)).ok()?;
    if bytes.is_empty() {
        return None;
    }
    use base64::Engine as _;
    Some(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
fn save_sprite(app: tauri::AppHandle, key: String, b64: String) -> Result<(), String> {
    if !safe_key(&key) {
        return Err("bad key".into());
    }
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.as_bytes())
        .map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("empty sprite".into());
    }
    let dir = sprite_cache_dir(&app).ok_or("no cache dir")?;
    // write a temp then rename → a crash mid-write can't leave a truncated file that
    // later reads back as a "cached" but broken sprite.
    let tmp = dir.join(format!("{key}.part"));
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, dir.join(&key)).map_err(|e| e.to_string())
}

#[tauri::command]
fn sprite_cached(app: tauri::AppHandle, key: String) -> bool {
    safe_key(&key)
        && sprite_cache_dir(&app)
            .map(|d| d.join(&key).metadata().map(|m| m.len() > 0).unwrap_or(false))
            .unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostarted"]), // tag boot-launches so we can ASK before showing
        ))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Auto-update: the frontend drives check/download/install from JS so the UX stays in
        // Poki's voice; `process` gives us the relaunch after the installer swaps the binary.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Mutex::new(GitWatch::default()))
        .manage(Mutex::new(LogWatch::default()))
        .manage(FlowAware(AtomicBool::new(true)))
        .manage(AudioAware(AtomicBool::new(false))) // music awareness OFF by default (privacy)
        .manage(Visible(AtomicBool::new(true))) // window starts shown; watchers pause when hidden
        .invoke_handler(tauri::generate_handler![git_set_repo, git_clear_repo, write_card, push_card, gpu_stat, log_set_path, log_clear, set_flow_aware, set_audio_aware, is_autostart_launch, quit_app, surface_window, is_dev_build, read_sprite, save_sprite, sprite_cached, chapter::chapter_status, chapter::submit_builder_pass, chapter::founder_mark])
        .setup(|app| {
            // Coding Awareness: start the background reflog watcher.
            spawn_git_watcher(app.handle().clone());
            // Training Awareness: start the background log watcher.
            spawn_log_watcher(app.handle().clone());
            // Flow Awareness: working-tree save cadence + foreground-app rhythm.
            spawn_repo_activity_watcher(app.handle().clone());
            spawn_focus_watcher(app.handle().clone());
            // Music awareness: idle until the user opts in (set_audio_aware true).
            spawn_audio_watcher(app.handle().clone());
            spawn_audio_source_watcher(app.handle().clone()); // Layer 2: which process emits audio

            // Tray: the companion rests here instead of quitting — it never truly leaves.
            let show = MenuItem::with_id(app, "show", "Show Hearthmon", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide to tray", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Hearthmon — your companion is here")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                            app.state::<Visible>().0.store(false, Ordering::Relaxed); // pause watchers
                            let _ = app.emit("hm-visible", false); // hush audio while hidden
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // left-click the tray icon: summon the companion back
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // closing the window tucks it into the tray rather than exiting —
            // the only real quit is the tray menu. (Soul: "the companion stays.")
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                window.app_handle().state::<Visible>().0.store(false, Ordering::Relaxed); // pause watchers
                let _ = window.emit("hm-visible", false); // hush audio while hidden
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
