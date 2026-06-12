// The Memory Engine — local-first SQLite. Nothing ever leaves this machine.
import Database from "@tauri-apps/plugin-sql";

export type MemoryKind = "mood" | "win" | "learned" | "survived" | "seed" | "note" | "letter";
export type Mood = "good" | "stressed" | "tired" | "low" | "frustrated" | "uncertain";

export interface Memory {
  id: number;
  kind: MemoryKind;
  mood: Mood | null;
  text: string | null;
  created_at: string;
}

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:hearthmon.db");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        mood TEXT,
        text TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
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

export async function addMemory(kind: MemoryKind, opts: { mood?: Mood; text?: string } = {}): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT INTO memories (kind, mood, text) VALUES ($1, $2, $3)", [
    kind,
    opts.mood ?? null,
    opts.text ?? null
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

/** The most recent letter not yet acknowledged by the user (id > lastReadId). */
export async function unreadLetter(lastReadId: number): Promise<Memory | null> {
  const d = await getDb();
  const rows = await d.select<Memory[]>(
    `SELECT * FROM memories
     WHERE kind = 'letter' AND id > $1
     ORDER BY id ASC LIMIT 1`,
    [lastReadId]
  );
  return rows.length ? rows[0] : null;
}
