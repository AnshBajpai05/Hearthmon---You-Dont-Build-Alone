use std::path::PathBuf;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(GitWatch::default()))
        .invoke_handler(tauri::generate_handler![git_set_repo, git_clear_repo])
        .setup(|app| {
            // Coding Awareness: start the background reflog watcher.
            spawn_git_watcher(app.handle().clone());
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
