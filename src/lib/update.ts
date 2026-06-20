// Auto-update service — V2's first online feature.
//
// Flow (driven from the frontend so the UX stays in Poki's voice):
//   launch -> check GitHub Releases -> newer signed build? -> show card (once/day)
//   "Update now" -> download + verify (minisign) + install -> relaunch
//   first launch after an update -> one-time "It feels better with this update." line
//
// %APPDATA% (hearthmon.db, memories, settings, companion) and the HKCU chapter store are
// preserved across an NSIS update — only the program files change.
//
// Everything here no-ops safely in dev / browser / offline: `check()` throws when there's no
// updater endpoint or network, and callers swallow it, so nothing ever nags.
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

export type { Update };
export { getVersion };

/** True when `a` is a strictly newer dot-numeric version than `b` (e.g. "0.2.0" > "0.1.9"). */
export function isNewer(a: string, b: string): boolean {
  const parts = (v: string) => v.split(/[.\-+]/).map((n) => parseInt(n, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Check GitHub Releases for a newer signed build.
 * Returns the `Update` when one is genuinely available, otherwise `null`.
 * Throws only when the updater itself can't run (dev build / no endpoint / offline) — callers
 * treat a throw the same as "no update" and stay silent.
 */
export async function checkForUpdate(): Promise<Update | null> {
  const u = await check();
  return u && u.available ? u : null;
}

/**
 * Download + verify + install `update`, reporting 0–100% via `onProgress`, then relaunch.
 * The await after relaunch never resolves (the process is replaced), which is expected.
 */
export async function installAndRelaunch(
  update: Update,
  onProgress: (pct: number) => void
): Promise<void> {
  let total = 0;
  let got = 0;
  await update.downloadAndInstall((e) => {
    switch (e.event) {
      case "Started":
        total = e.data.contentLength ?? 0;
        onProgress(0);
        break;
      case "Progress":
        got += e.data.chunkLength ?? 0;
        onProgress(total > 0 ? Math.min(100, Math.round((got / total) * 100)) : 0);
        break;
      case "Finished":
        onProgress(100);
        break;
    }
  });
  await relaunch();
}

/**
 * Release notes for `tag` (e.g. "v0.2.0"), pulled straight from the GitHub Release body — so the
 * "What's new" panel has a single source of truth and we never maintain a second changelog.
 * Used as a fallback when notes weren't persisted at install time. Returns "" on any failure
 * (offline / private repo) so the panel degrades gracefully rather than erroring.
 */
export async function fetchReleaseNotes(
  owner: string,
  repo: string,
  tag: string
): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return "";
    const json = (await res.json()) as { body?: string };
    return (json.body ?? "").trim();
  } catch {
    return "";
  }
}
