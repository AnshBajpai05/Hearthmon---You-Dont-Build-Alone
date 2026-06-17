//! Chapter Access (secure_Hearthmon) — offline, device-bound chapter gate.
//!
//! Layout: `config.rs` is the only editable file (durations, grace, nudges, trusted list).
//! `crypto.rs` / `state.rs` / `gate.rs` are the frozen core. The two commands below are the
//! whole public surface; the frontend renders the result but never makes the decision.

mod config;
mod crypto;
mod gate;
mod state;

use chrono::{Local, NaiveDate, TimeZone};
use serde::Serialize;

use config::TrustGrant;
use state::{ChapterState, StateKind, FOREVER, SECS_PER_DAY};

/// What the frontend gets. `phase` is the source of truth; everything else is for rendering.
#[derive(Serialize)]
pub struct ChapterStatus {
    pub phase: String,        // "full" | "grace" | "paused"
    pub request_code: String, // "HM-XXXXXXXX"
    pub expiry_ts: i64,
    pub grace_index: u32, // which grace soft-line (→ config::GRACE_LINE_KEYS)
    pub nudge: String,    // "full" | "small" | "quiet"
    pub has_end: bool,    // false for Forever/Trusted → no trial intro / grace tail for them
}

/// Evaluated once at boot. Loads/heals the dual store, clamps the clock, applies trusted
/// grants, decides the phase, and persists the (encrypted) result.
#[tauri::command]
pub fn chapter_status(app: tauri::AppHandle) -> ChapterStatus {
    // Founder build (built_me.bat → HEARTHMON_FOUNDER=1): full access, no trial, no awareness.
    if !env!("HEARTHMON_FOUNDER").is_empty() {
        return ChapterStatus {
            phase: "full".to_string(),
            request_code: crypto::request_code(),
            expiry_ts: FOREVER,
            grace_index: 0,
            nudge: "full".to_string(),
            has_end: false,
        };
    }
    let mut st = state::load_or_init(&app);

    // Clock guard: time only moves forward as far as we've ever seen (rollback cheat),
    // AND we refuse to follow an implausible forward leap in one step (bad NTP / wrong
    // system date / dual-boot time jump) — that would poison last_seen and lock the user
    // out forever once their clock heals. See config::CLOCK_JUMP_TOLERANCE_DAYS.
    let effective_now = clamp_clock(state::now(), st.last_seen);
    st.last_seen = effective_now;

    apply_trusted(&mut st, effective_now);

    let phase = gate::decide(&st, effective_now);
    let grace_index = gate::grace_index(&st, effective_now);

    if phase == gate::Phase::Paused {
        st.paused_launches = st.paused_launches.saturating_add(1);
    } else {
        st.paused_launches = 0;
    }
    let nudge = gate::nudge_level(st.paused_launches).to_string();

    state::persist(&app, &st);

    ChapterStatus {
        phase: phase.as_str().to_string(),
        request_code: crypto::request_code(),
        expiry_ts: st.expiry,
        grace_index,
        nudge,
        has_end: matches!(st.kind, StateKind::Trial | StateKind::Pass),
    }
}

/// Founder's Mark — provable authorship. The visible habitat signature is deletable in a fork;
/// THIS (compiled in, secret-signed) is the unforgeable lineage proof.
#[derive(Serialize)]
pub struct Founder {
    pub founder: String,
    pub handle: String,
    pub build_ts: String,
    pub git_commit: String,
    pub origin_hash: String,
    pub signature: String,
}

#[tauri::command]
pub fn founder_mark() -> Founder {
    let founder = obfstr::obfstr!("Ansh Bajpai").to_string();
    let handle = obfstr::obfstr!("AnshBajpai05").to_string();
    let build_ts = env!("HEARTHMON_BUILD_TS").to_string();
    let git_commit = env!("HEARTHMON_GIT_COMMIT").to_string();
    let origin = format!("hearthmon|{handle}|{build_ts}|{git_commit}");
    Founder {
        origin_hash: crypto::origin_hash(&origin),
        signature: crypto::founder_signature(&origin),
        founder,
        handle,
        build_ts,
        git_commit,
    }
}

/// Apply a builder pass. Verifies the HMAC against THIS machine, then extends in both stores.
#[tauri::command]
pub fn submit_builder_pass(app: tauri::AppHandle, pass_code: String) -> Result<(), String> {
    let parts: Vec<&str> = pass_code.trim().split('-').collect();
    if parts.len() != 3 || parts[0] != "PASS" || parts[1].len() != 6 || parts[2].len() != 8 {
        return Err("malformed".into());
    }
    let (yymmdd, sig) = (parts[1], parts[2]);
    if !crypto::verify_pass(yymmdd, sig) {
        return Err("invalid".into());
    }
    let expiry = pass_expiry(yymmdd).ok_or("malformed")?;

    let mut st = state::load_or_init(&app);
    let now = clamp_clock(state::now(), st.last_seen); // don't poison the floor with a bad clock
    st.expiry = st.expiry.max(expiry); // never shrink an existing runway
    st.kind = if expiry >= FOREVER {
        StateKind::Forever
    } else {
        StateKind::Pass
    };
    st.last_seen = now;
    st.paused_launches = 0;
    state::persist(&app, &st);
    Ok(())
}

/// Clamp the wall clock against `last_seen`, our trial floor.
/// - rolled back  → hold the floor (never un-spend trial time)
/// - leapt implausibly far forward → distrust it, keep the last good position (a bad clock
///   must not poison the floor and lock the user out once it heals)
/// - otherwise    → take the clock at face value
fn clamp_clock(raw_now: i64, last_seen: i64) -> i64 {
    if raw_now < last_seen {
        last_seen
    } else if raw_now - last_seen > config::CLOCK_JUMP_TOLERANCE_DAYS * SECS_PER_DAY {
        last_seen
    } else {
        raw_now
    }
}

/// Auto-extend machines on the trusted list (matched by machine hash — see §6).
fn apply_trusted(st: &mut ChapterState, effective_now: i64) {
    let mh = crypto::machine_hash();
    if let Some((_, grant)) = config::TRUSTED.iter().find(|(h, _)| *h == mh.as_str()) {
        match grant {
            TrustGrant::Forever => {
                st.kind = StateKind::Trusted;
                st.expiry = FOREVER;
            }
            TrustGrant::Days(n) => {
                let target = effective_now + n * SECS_PER_DAY;
                if target > st.expiry {
                    st.expiry = target;
                }
                st.kind = StateKind::Pass;
            }
        }
    }
}

/// `YYMMDD` → end of that day in the USER's local timezone, plus the invisible forgiveness pad.
/// `999999` → the permanent sentinel.
fn pass_expiry(yymmdd: &str) -> Option<i64> {
    if yymmdd == "999999" {
        return Some(FOREVER);
    }
    let yy: i32 = yymmdd.get(0..2)?.parse().ok()?;
    let mm: u32 = yymmdd.get(2..4)?.parse().ok()?;
    let dd: u32 = yymmdd.get(4..6)?.parse().ok()?;
    let date = NaiveDate::from_ymd_opt(2000 + yy, mm, dd)?;
    let naive = date.and_hms_opt(23, 59, 59)?;
    // Resolve the local day-end robustly. `.single()` returns None for a DST spring-forward gap and
    // is Ambiguous for a fall-back hour — a bare `.single()?` would then REJECT a perfectly valid
    // pass over a clock quirk (existing_issues.md §7.6). Take the earliest valid instant, and on a
    // gap fall back to an earlier minute so we never bail. (The pass is minted on the issuer's local
    // day and evaluated on the user's; the tz delta is absorbed by FORGIVENESS_DAYS below.)
    let local = match Local.from_local_datetime(&naive) {
        chrono::LocalResult::Single(t) => t,
        chrono::LocalResult::Ambiguous(earliest, _) => earliest,
        chrono::LocalResult::None => Local.from_local_datetime(&date.and_hms_opt(23, 0, 0)?).earliest()?,
    };
    Some(local.timestamp() + config::FORGIVENESS_DAYS * SECS_PER_DAY)
}
