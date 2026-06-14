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

fn git_log_path(repo: &PathBuf) -> PathBuf {
    repo.join(".git").join("logs").join("HEAD")
}

fn reflog_line_count(p: &PathBuf) -> usize {
    std::fs::read_to_string(p)
        .map(|s| s.lines().count())
        .unwrap_or(0)
}

/// A reflog line is `<old> <new> <name> <email> <ts> <tz>\t<action>: <message>`.
/// Return the commit message only when the line records a *new commit* — not a
/// checkout / reset / merge fast-forward / rebase step / pull.
fn parse_commit(line: &str) -> Option<String> {
    let action = line.split('\t').nth(1)?;
    if !action.starts_with("commit") {
        return None;
    }
    let msg = action.splitn(2, ": ").nth(1).unwrap_or("").trim();
    if msg.is_empty() {
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
    std::thread::spawn(move || {
        let mut last = String::new();
        let mut primed = false; // skip the first sight so we don't fire on launch
        loop {
            std::thread::sleep(std::time::Duration::from_secs(6));
            let repo = match handle.state::<Mutex<GitWatch>>().lock() {
                Ok(g) => g.repo.clone(),
                Err(_) => continue,
            };
            let Some(repo) = repo else {
                last.clear();
                primed = false;
                continue;
            };
            // porcelain = which files are dirty; numstat = how much (changes on
            // every save, even re-saving the same already-dirty file)
            let snap = format!(
                "{}\n{}",
                git_capture(&repo, &["status", "--porcelain"]),
                git_capture(&repo, &["diff", "--numstat"])
            );
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
    if EDITORS.contains(&proc_name) || proc_name.contains("idea") || proc_name.contains("pycharm") {
        "editor"
    } else if TERMS.contains(&proc_name) {
        "terminal"
    } else if BROWSERS.contains(&proc_name) {
        "browser"
    } else {
        "other"
    }
}

#[cfg(windows)]
fn foreground_proc() -> Option<String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return None;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h == 0 {
            return None;
        }
        let mut buf = [0u16; 260];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut len);
        CloseHandle(h);
        if ok == 0 {
            return None;
        }
        let s = String::from_utf16_lossy(&buf[..len as usize]);
        s.rsplit(|c| c == '\\' || c == '/').next().map(|x| x.to_lowercase())
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
            if !handle.state::<FlowAware>().0.load(Ordering::Relaxed) {
                continue; // opted out — never look
            }
            let cat = foreground_proc().map(|p| app_category(&p)).unwrap_or("other");
            if cat != last {
                last = cat.to_string();
                let _ = handle.emit("focus-app", cat);
            }
        }
    });
}

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

#[cfg(windows)]
fn build_loopback(handle: &tauri::AppHandle) -> Option<cpal::Stream> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    let host = cpal::default_host();
    let device = host.default_output_device()?; // loopback = INPUT stream on OUTPUT device
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
    let mut peak = 0.0008f32; // slow AGC so quiet and loud songs both read 0..1
    let mut last = std::time::Instant::now();
    let h = handle.clone();
    let stream = device
        .build_input_stream(
            &cfg,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                for frame in data.chunks(ch) {
                    let x = frame.iter().copied().sum::<f32>() / ch as f32;
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
                if n > 0 && last.elapsed().as_millis() >= 33 {
                    let nn = n as f32;
                    let (b, m, hi) = ((sb / nn).sqrt(), (sm / nn).sqrt(), (sh / nn).sqrt());
                    let lvl = (b + m + hi) / 3.0;
                    peak = (peak * 0.999).max(lvl).max(0.0008);
                    let nz = |v: f32| (v / peak).clamp(0.0, 1.0);
                    let _ = h.emit("audio-bands", (nz(b), nz(m), nz(hi), nz(lvl)));
                    sb = 0.0; sm = 0.0; sh = 0.0; n = 0;
                    last = std::time::Instant::now();
                }
            },
            move |e| eprintln!("[hearthmon] audio stream error: {e}"),
            None,
        )
        .ok()?;
    stream.play().ok()?;
    Some(stream)
}

/// Hold the loopback stream alive only while the user has music-awareness on.
/// The cpal Stream is !Send, so it's built and dropped on this owning thread.
#[cfg(windows)]
fn spawn_audio_watcher(handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut stream: Option<cpal::Stream> = None;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(300));
            let want = handle.state::<AudioAware>().0.load(Ordering::Relaxed);
            if want && stream.is_none() {
                stream = build_loopback(&handle);
            } else if !want && stream.is_some() {
                stream = None; // drop → capture stops immediately
            }
        }
    });
}

#[cfg(not(windows))]
fn spawn_audio_watcher(_handle: tauri::AppHandle) {}

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

fn newest_log(dir: &PathBuf) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file())
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
    let mut f = std::fs::File::open(file).ok()?;
    let len = f.metadata().ok()?.len();
    let start = if pos > len { 0 } else { pos };
    f.seek(SeekFrom::Start(start)).ok()?;
    let mut bytes = Vec::new();
    f.read_to_end(&mut bytes).ok()?;
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

/// Automatically push the README card to GitHub.
/// Also rewrites the static companion text block in README.md so it stays in sync.
#[tauri::command]
fn push_card(path: String, companion: String, mood: String, status: String) -> Result<(), String> {
    let repo_path = std::path::Path::new(&path);

    // Integrate any remote changes FIRST (e.g. a README edited on github.com) so
    // the amend + --force-with-lease below can't be rejected as "stale info".
    let branch = std::process::Command::new("git")
        .current_dir(repo_path)
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "main".to_string());
    let _ = std::process::Command::new("git")
        .current_dir(repo_path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .args(["fetch", "origin"])
        .status();
    let rebased = std::process::Command::new("git")
        .current_dir(repo_path)
        .args(["rebase", "--autostash", &format!("origin/{branch}")])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !rebased {
        // a conflict — don't leave the repo mid-rebase; bail out of the integration
        let _ = std::process::Command::new("git")
            .current_dir(repo_path)
            .args(["rebase", "--abort"])
            .status();
    }

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
    let add_status = std::process::Command::new("git")
        .current_dir(repo_path)
        .args(["add", "assets/hearthmon-status.svg", "README.md"])
        .status()
        .map_err(|e| e.to_string())?;
        
    if !add_status.success() {
        return Err("Failed to 'git add' the card.".into());
    }

    // To keep the profile clean, AMEND our own rolling card commit instead of
    // stacking a new commit every push — unless a real commit landed since.
    const MSG: &str = "chore: Hearthmon status card";
    let last = std::process::Command::new("git")
        .current_dir(repo_path)
        .args(["log", "-1", "--pretty=%s"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    let amend = last == MSG;

    let commit_args: Vec<&str> = if amend {
        vec!["commit", "--amend", "--no-edit"]
    } else {
        vec!["commit", "-m", MSG]
    };
    let _ = std::process::Command::new("git")
        .current_dir(repo_path)
        .args(&commit_args)
        .status();

    let push_args: &[&str] = if amend {
        &["push", "--force-with-lease"]
    } else {
        &["push", "-u", "origin", "HEAD"]
    };
    let push_status = std::process::Command::new("git")
        .current_dir(repo_path)
        .env("GIT_TERMINAL_PROMPT", "0") // fail fast instead of hanging on auth
        .args(push_args)
        .status()
        .map_err(|e| e.to_string())?;

    if !push_status.success() {
        return Err("Failed to 'git push' to GitHub.".into());
    }

    Ok(())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(GitWatch::default()))
        .manage(Mutex::new(LogWatch::default()))
        .manage(FlowAware(AtomicBool::new(true)))
        .manage(AudioAware(AtomicBool::new(false))) // music awareness OFF by default (privacy)
        .invoke_handler(tauri::generate_handler![git_set_repo, git_clear_repo, write_card, push_card, gpu_stat, log_set_path, log_clear, set_flow_aware, set_audio_aware])
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
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
