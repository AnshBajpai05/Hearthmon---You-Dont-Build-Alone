//! EDIT THESE. Rebuild. The core does not move.
//! (secure_Hearthmon.md §1 — this is the only file you touch to tune behaviour.)

/// Full, uninterrupted first chapter. (Trusted beta: 5+2 — a "short season", enough time to
/// bond before the soft pause, so feedback measures presence, not just first impression.)
pub const CORE_DAYS: i64 = 5;
/// After the core: still fully working, with a quiet soft-line, NO dim yet.
pub const GRACE_DAYS: i64 = 2;
/// Invisible pad added to every *pass* expiry so it feels like "he waited for me".
pub const FORGIVENESS_DAYS: i64 = 1;

/// Clock-anomaly tolerance. `last_seen` is our rollback floor; a bad NTP sync, a wrong
/// system date, or a dual-boot time jump can shove the wall clock years into the future.
/// If we trusted such a leap we'd poison `last_seen` forever and lock the user out even
/// after their clock heals. So a single forward jump larger than this many days is treated
/// as a fault: we hold our last good position instead of advancing into the bogus future.
/// Generous on purpose — a real human absence of weeks/a couple months still flows through
/// and expires normally; only an implausible (year+) leap trips it. Erring toward "never
/// lock out a real user" is the soul-aligned choice.
pub const CLOCK_JUMP_TOLERANCE_DAYS: i64 = 366;
// Trial timeline: full days 1..5 → quiet grace days 6..7 → pause on the first launch from day 8.
// (FORGIVENESS_DAYS pads PASS expiries only, not the trial.) Bump these when you scale up.

/// Soft-line keys shown during grace (days 8..10). Wire matching copy in `src/lib/lines.ts`.
/// One per grace day; the last one repeats if grace is longer than this list.
pub const GRACE_LINE_KEYS: &[&str] = &["grace_a", "grace_b", "grace_c"];

/// Paused-launch nudge fade (§ decision 4): launch 1 → full card, 2..4 → compact, 5+ → quiet.
pub const NUDGE_FULL_UNTIL: u32 = 1;
pub const NUDGE_SMALL_UNTIL: u32 = 4;

/// How a trusted machine is rewarded. Variants are constructed only when you add rows to
/// `TRUSTED` below, so they read as "dead" on a fresh checkout — that's expected.
#[derive(Clone, Copy)]
#[allow(dead_code)]
pub enum TrustGrant {
    Forever,
    Days(i64),
}

/// Trusted builders, keyed by **machine hash** (8 lowercase hex), never username (§6 — a
/// username is self-asserted and unverifiable offline). Collect a friend's `HM-XXXXXXXX`
/// once, paste the lowercase hex here, rebuild — that machine auto-extends and never asks again.
pub const TRUSTED: &[(&str, TrustGrant)] = &[
    // ("7x9k2p4m", TrustGrant::Forever),
    // ("a3f10b22", TrustGrant::Days(90)),
];
