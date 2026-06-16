fn main() {
    // Chapter Access secret (secure_Hearthmon §3). Injected here so `env!("HEARTHMON_PASS_SECRET")`
    // always resolves at compile time: the real value when set, a clearly-marked dev fallback
    // otherwise (so `cargo check` / dev builds work). RELEASE builds MUST set the real one —
    // we refuse to compile a release that would ship the dev secret.
    let secret = std::env::var("HEARTHMON_PASS_SECRET")
        .ok()
        .filter(|s| !s.is_empty());
    let profile = std::env::var("PROFILE").unwrap_or_default();
    let secret = match secret {
        Some(s) => s,
        None => {
            if profile == "release" {
                panic!(
                    "HEARTHMON_PASS_SECRET must be set for release builds \
                     (see hearthmon/docs/secure_Hearthmon.md §3)."
                );
            }
            "dev-only-insecure-secret-do-not-ship".to_string()
        }
    };
    println!("cargo:rustc-env=HEARTHMON_PASS_SECRET={secret}");
    println!("cargo:rerun-if-env-changed=HEARTHMON_PASS_SECRET");

    // Founder's Mark provenance: stamp the build time + git commit so every binary carries a
    // signed, hard-to-dispute lineage.
    let build_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    println!("cargo:rustc-env=HEARTHMON_BUILD_TS={build_ts}");

    let git_commit = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "nogit".to_string());
    println!("cargo:rustc-env=HEARTHMON_GIT_COMMIT={git_commit}");
    println!("cargo:rerun-if-changed=../.git/HEAD");

    // Founder build flag: built_me.bat sets HEARTHMON_FOUNDER=1 → full access, no trial gate.
    // The friends' build (built_friends.bat) leaves it empty → normal trial gate.
    let founder = std::env::var("HEARTHMON_FOUNDER")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_default();
    println!("cargo:rustc-env=HEARTHMON_FOUNDER={founder}");
    println!("cargo:rerun-if-env-changed=HEARTHMON_FOUNDER");

    tauri_build::build()
}
