//! CORE — frozen. The pause decision. Computed only here, only in Rust.
//! (secure_Hearthmon.md §4 timeline, Truth 1: the frontend never decides.)

use super::config;
use super::state::{ChapterState, StateKind, SECS_PER_DAY};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Full,
    Grace,
    Paused,
}

impl Phase {
    pub fn as_str(self) -> &'static str {
        match self {
            Phase::Full => "full",
            Phase::Grace => "grace",
            Phase::Paused => "paused",
        }
    }
}

/// Decide the phase for `effective_now` (already clamped against clock rollback by the caller).
/// Only the initial Trial gets the soft-line grace window; passes carry their own forgiveness
/// pad in `expiry`, so they go straight Full → Paused.
pub fn decide(st: &ChapterState, effective_now: i64) -> Phase {
    match st.kind {
        StateKind::Forever | StateKind::Trusted => Phase::Full,
        StateKind::Pass => {
            if effective_now <= st.expiry {
                Phase::Full
            } else {
                Phase::Paused
            }
        }
        StateKind::Trial => {
            let grace_end = st.expiry + config::GRACE_DAYS * SECS_PER_DAY;
            if effective_now <= st.expiry {
                Phase::Full
            } else if effective_now <= grace_end {
                Phase::Grace
            } else {
                Phase::Paused
            }
        }
    }
}

/// Which grace soft-line to show (0-based day into the grace window), clamped to the list.
pub fn grace_index(st: &ChapterState, effective_now: i64) -> u32 {
    let into = (effective_now - st.expiry).max(0) / SECS_PER_DAY;
    let last = config::GRACE_LINE_KEYS.len().saturating_sub(1) as i64;
    into.min(last).max(0) as u32
}

/// Paused-launch nudge level from how many times we've shown the paused state.
pub fn nudge_level(paused_launches: u32) -> &'static str {
    if paused_launches <= config::NUDGE_FULL_UNTIL {
        "full"
    } else if paused_launches <= config::NUDGE_SMALL_UNTIL {
        "small"
    } else {
        "quiet"
    }
}
