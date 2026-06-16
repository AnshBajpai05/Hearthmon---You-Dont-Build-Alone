// The Memory Engine — local-first SQLite. Nothing ever leaves this machine.
import Database from "@tauri-apps/plugin-sql";

export type MemoryKind =
  | "mood"
  | "win"
  | "learned"
  | "survived"
  | "seed"
  | "note"
  | "letter"
  | "praise" // kind words others said — the "Someone Believed In You" archive
  | "chapter" // a named period (Life RPG) — read_at doubles as the close date
  | "arc"; // an auto-detected "chapter moment" — a dense stretch of building
export type Mood = "good" | "stressed" | "tired" | "low" | "frustrated" | "uncertain";

export interface Memory {
  id: number;
  kind: MemoryKind;
  mood: Mood | null;
  text: string | null;
  created_at: string;
  open_at?: string | null; // memory capsules: don't surface until this time
  read_at?: string | null; // when the user opened this letter/capsule
}

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:hearthmon.db");
    // Concurrency hardening (existing_issues.md 7.8): WAL lets a reader and a writer coexist,
    // and busy_timeout makes a contended statement wait briefly instead of failing instantly
    // with SQLITE_BUSY — so a background write can't collide with a long memory-recall read.
    await db.select("PRAGMA journal_mode = WAL;");
    await db.execute("PRAGMA busy_timeout = 3000;");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        mood TEXT,
        text TEXT,
        open_at TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // migrate older DBs that predate capsules (ALTER fails harmlessly if column exists)
    for (const col of ["open_at", "read_at"]) {
      try {
        await db.execute(`ALTER TABLE memories ADD COLUMN ${col} TEXT`);
      } catch {
        /* column already present */
      }
    }
  }
  return db;
}

export async function getMeta(key: string): Promise<string | null> {
  const d = await getDb();
  const rows = await d.select<{ value: string }[]>("SELECT value FROM meta WHERE key = $1", [key]);
  return rows.length ? rows[0].value : null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ($1, $2)", [key, value]);
}

export async function addMemory(
  kind: MemoryKind,
  opts: { mood?: Mood; text?: string; openAt?: string } = {}
): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT INTO memories (kind, mood, text, open_at) VALUES ($1, $2, $3, $4)", [
    kind,
    opts.mood ?? null,
    opts.text ?? null,
    opts.openAt ?? null
  ]);
}

export async function memoriesOfKind(kind: MemoryKind, limit = 8): Promise<Memory[]> {
  const d = await getDb();
  return d.select<Memory[]>(
    "SELECT * FROM memories WHERE kind = $1 ORDER BY created_at DESC LIMIT $2",
    [kind, limit]
  );
}

/** Wins old enough to have been forgotten — the doc's "Wins You Forgot". */
export async function forgottenWins(limit = 4): Promise<Memory[]> {
  const d = await getDb();
  return d.select<Memory[]>(
    `SELECT * FROM memories
     WHERE kind = 'win' AND created_at < datetime('now','localtime','-7 days')
     ORDER BY RANDOM() LIMIT $1`,
    [limit]
  );
}

/** Hard days more than a week back — proof of survival, not a guilt trip. */
export async function hardDaysSurvived(limit = 4): Promise<Memory[]> {
  const d = await getDb();
  return d.select<Memory[]>(
    `SELECT * FROM memories
     WHERE kind = 'mood' AND mood IN ('low','stressed','frustrated')
       AND created_at < datetime('now','localtime','-7 days')
     ORDER BY RANDOM() LIMIT $1`,
    [limit]
  );
}

/** A meaningful older memory (win / learned / survived) for a long-term callback. */
export async function oldMilestone(minDaysAgo = 30): Promise<Memory | null> {
  const d = await getDb();
  const rows = await d.select<Memory[]>(
    `SELECT * FROM memories
     WHERE kind IN ('win','learned','survived') AND text IS NOT NULL AND text != ''
       AND created_at < datetime('now','localtime','-' || $1 || ' days')
     ORDER BY RANDOM() LIMIT 1`,
    [minDaysAgo]
  );
  return rows.length ? rows[0] : null;
}

/** A past "chapter moment" (a dense building stretch) at least N days old. */
export async function oldArc(minDaysAgo = 7): Promise<Memory | null> {
  const d = await getDb();
  const rows = await d.select<Memory[]>(
    `SELECT * FROM memories
     WHERE kind = 'arc' AND text IS NOT NULL AND text != ''
       AND created_at < datetime('now','localtime','-' || $1 || ' days')
     ORDER BY RANDOM() LIMIT 1`,
    [minDaysAgo]
  );
  return rows.length ? rows[0] : null;
}

/** "We've been here before" — an old memory of this same mood, if one exists. */
export async function findFamiliar(mood: Mood): Promise<Memory | null> {
  const d = await getDb();
  const rows = await d.select<Memory[]>(
    `SELECT * FROM memories
     WHERE kind = 'mood' AND mood = $1
       AND created_at < datetime('now','localtime','-7 days')
     ORDER BY RANDOM() LIMIT 1`,
    [mood]
  );
  return rows.length ? rows[0] : null;
}

/** Everything, newest first — the raw material of the Journey scrapbook. */
export async function allMemories(limit = 250): Promise<Memory[]> {
  const d = await getDb();
  return d.select<Memory[]>("SELECT * FROM memories ORDER BY created_at DESC LIMIT $1", [limit]);
}

/** How many heavy moods in the last N days — for gentle burnout awareness. */
export async function hardMoodCount(days = 7): Promise<number> {
  const d = await getDb();
  const rows = await d.select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM memories
     WHERE kind = 'mood' AND mood IN ('low','stressed','frustrated')
       AND created_at > datetime('now','localtime','-' || $1 || ' days')`,
    [days]
  );
  return rows[0]?.n ?? 0;
}

/** Count of memories per kind — `{ win: 12, learned: 5, ... }`. For the recap. */
export async function kindCounts(): Promise<Record<string, number>> {
  const d = await getDb();
  const rows = await d.select<{ kind: string; n: number }[]>(
    "SELECT kind, COUNT(*) AS n FROM memories GROUP BY kind"
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.kind] = r.n;
  return out;
}

/** Count of mood check-ins per mood — `{ good: 9, low: 3, ... }`. */
export async function moodCounts(): Promise<Record<string, number>> {
  const d = await getDb();
  const rows = await d.select<{ mood: string; n: number }[]>(
    "SELECT mood, COUNT(*) AS n FROM memories WHERE kind = 'mood' AND mood IS NOT NULL GROUP BY mood"
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.mood] = r.n;
  return out;
}

// ---- Chapters (Life RPG): a named period; read_at = when it was closed ----
export async function startChapter(name: string): Promise<void> {
  await addMemory("chapter", { text: name });
}
export async function currentChapter(): Promise<Memory | null> {
  const d = await getDb();
  const rows = await d.select<Memory[]>(
    "SELECT * FROM memories WHERE kind = 'chapter' AND read_at IS NULL ORDER BY created_at DESC LIMIT 1",
    []
  );
  return rows.length ? rows[0] : null;
}
export async function closeChapter(id: number): Promise<void> {
  const d = await getDb();
  await d.execute("UPDATE memories SET read_at = datetime('now','localtime') WHERE id = $1", [id]);
}
export async function allChapters(): Promise<Memory[]> {
  const d = await getDb();
  return d.select<Memory[]>("SELECT * FROM memories WHERE kind = 'chapter' ORDER BY created_at DESC", []);
}

/** Increment a numeric meta counter (e.g. lifetime interactions). */
export async function bumpCounter(key: string): Promise<number> {
  const n = Number((await getMeta(key)) ?? 0) + 1;
  await setMeta(key, String(n));
  return n;
}

/** How many memories of any kind were logged in the last N days. */
export async function weeklyMemoryCount(days = 7): Promise<number> {
  const d = await getDb();
  const rows = await d.select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM memories
     WHERE kind NOT IN ('seed','letter')
       AND created_at > datetime('now','localtime','-' || $1 || ' days')`,
    [days]
  );
  return rows[0]?.n ?? 0;
}

/**
 * The oldest unread letter/capsule that is *due* — i.e. not yet read and either
 * has no release date or its release date has passed. Capsules stay hidden until then.
 */
export async function unreadLetter(): Promise<Memory | null> {
  const d = await getDb();
  const rows = await d.select<Memory[]>(
    `SELECT * FROM memories
     WHERE kind = 'letter' AND read_at IS NULL
       AND (open_at IS NULL OR open_at <= datetime('now','localtime'))
     ORDER BY created_at ASC LIMIT 1`,
    []
  );
  return rows.length ? rows[0] : null;
}

/** Mark a letter/capsule as opened, so it never surfaces again. */
export async function markLetterRead(id: number): Promise<void> {
  const d = await getDb();
  await d.execute("UPDATE memories SET read_at = datetime('now','localtime') WHERE id = $1", [id]);
}

/** Capsules sealed for the future that aren't due yet — for a gentle waiting count. */
export async function pendingCapsules(): Promise<Memory[]> {
  const d = await getDb();
  return d.select<Memory[]>(
    `SELECT * FROM memories
     WHERE kind = 'letter' AND read_at IS NULL
       AND open_at IS NOT NULL AND open_at > datetime('now','localtime')
     ORDER BY open_at ASC`,
    []
  );
}
