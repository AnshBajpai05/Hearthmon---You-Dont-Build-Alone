//! CORE — frozen. The encrypted, authenticated, dual-store chapter state.
//! (secure_Hearthmon.md §4.)

use std::path::PathBuf;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::Manager;

use super::config;
use super::crypto;

pub const SECS_PER_DAY: i64 = 86_400;
/// Sentinel "no expiry". Far in the future, still a normal i64 for serde/math.
pub const FOREVER: i64 = 4_102_444_800; // 2100-01-01 UTC

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum StateKind {
    Trial,
    Pass,
    Trusted,
    Forever,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
pub struct ChapterState {
    pub first_launch: i64,
    pub expiry: i64,
    pub last_seen: i64,
    pub kind: StateKind,
    pub paused_launches: u32,
}

impl ChapterState {
    /// A fresh trial starting now: full for CORE_DAYS, then the grace window handles the rest.
    fn fresh(now: i64) -> Self {
        ChapterState {
            first_launch: now,
            expiry: now + config::CORE_DAYS * SECS_PER_DAY,
            last_seen: now,
            kind: StateKind::Trial,
            paused_launches: 0,
        }
    }
}

/// Current wall-clock in Unix seconds (UTC).
pub fn now() -> i64 {
    Utc::now().timestamp()
}

/// Load state from the dual store, healing/cross-checking, or initialise a fresh trial.
/// - one store missing/forged → rebuilt from the other
/// - both valid but disagree   → take the EARLIER expiry (conservative; never reward a cheat)
/// - neither present           → fresh trial, written to both
pub fn load_or_init(app: &tauri::AppHandle) -> ChapterState {
    let reg = read_registry().and_then(|b| crypto::decrypt_state(&b));
    let file = read_file(app).and_then(|b| crypto::decrypt_state(&b));

    let st = match (reg, file) {
        (Some(a), Some(b)) => {
            // Both readable: trust the more conservative (earlier-expiring) record.
            if a.expiry <= b.expiry {
                a
            } else {
                b
            }
        }
        (Some(a), None) => a,
        (None, Some(b)) => b,
        (None, None) => ChapterState::fresh(now()),
    };

    // Re-sync both stores to the chosen record (also re-seals after any tamper/heal).
    persist(app, &st);
    st
}

/// Write the (encrypted) state to BOTH stores.
pub fn persist(app: &tauri::AppHandle, st: &ChapterState) {
    if let Some(blob) = crypto::encrypt_state(st) {
        write_registry(&blob);
        write_file(app, &blob);
    }
}

fn file_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(".hm_chapter"))
}

fn read_file(app: &tauri::AppHandle) -> Option<String> {
    std::fs::read_to_string(file_path(app)?).ok()
}

fn write_file(app: &tauri::AppHandle, blob: &str) {
    if let Some(p) = file_path(app) {
        let _ = std::fs::write(p, blob);
    }
}

#[cfg(windows)]
fn read_registry() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Hearthmon")
        .ok()?;
    key.get_value::<String, _>("state").ok()
}

#[cfg(windows)]
fn write_registry(blob: &str) {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    if let Ok((key, _)) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(r"Software\Hearthmon") {
        let _ = key.set_value("state", &blob.to_string());
    }
}

#[cfg(not(windows))]
fn read_registry() -> Option<String> {
    None
}

#[cfg(not(windows))]
fn write_registry(_blob: &str) {}
