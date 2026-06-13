<script lang="ts">
  // "Our Journey" — the living scrapbook. Years later you open this and see
  // what you survived, learned, felt, and built. Memory > motivation.
  import { onMount } from "svelte";
  import { allMemories, getMeta, allChapters, startChapter, closeChapter, type Memory } from "../db";
  import { daysTogether, bondStage } from "../bond";
  import { shortDate } from "../lines";
  import { derivePersona, type Persona } from "../personality";
  import { quirkSummary } from "../quirks";
  import BadgesPanel from "./BadgesPanel.svelte";
  import Constellation from "./Constellation.svelte";

  interface Props {
    petName: string;
    dexId: number;
    temperament?: string; // drift summary, e.g. "playful · affectionate"
    onClose: () => void;
    onChapterClose?: (name: string) => void; // fire the closing ceremony in +page
  }
  let { petName, dexId, temperament = "", onClose, onChapterClose }: Props = $props();

  let groups = $state<{ month: string; items: Memory[] }[]>([]);
  let memories = $state<Memory[]>([]);
  let days = $state(0);
  let stage = $state("Stranger");
  let persona = $state<Persona | null>(null);
  let loaded = $state(false);
  let tab = $state<"timeline" | "badges" | "sky" | "moods" | "chapters">("timeline");

  // ---- chapters (Life RPG) ----
  let chapters = $state<Memory[]>([]);
  let newChap = $state("");
  const openCh = $derived(chapters.find((c) => !c.read_at) ?? null);
  const pastChapters = $derived(chapters.filter((c) => c.read_at));
  async function reloadChapters() {
    chapters = await allChapters();
  }
  function countIn(ch: Memory): number {
    const start = ch.created_at;
    const end = ch.read_at ?? "9999-12-31";
    return memories.filter(
      (m) => m.kind !== "chapter" && m.created_at >= start && m.created_at <= end
    ).length;
  }
  async function doStartChapter() {
    const n = newChap.trim();
    if (!n) return;
    await startChapter(n);
    newChap = "";
    await reloadChapters();
  }
  async function doCloseChapter(id: number, name: string) {
    await closeChapter(id);
    await reloadChapters();
    onChapterClose?.(name);
  }

  const MOOD_EMOJI: Record<string, string> = {
    good: "🙂",
    stressed: "😓",
    tired: "😴",
    low: "😞",
    frustrated: "😤",
    uncertain: "🤔"
  };

  // ── Mood heatmap (12 weeks) + gentle weekday pattern ──
  const MOOD_COLOR: Record<string, string> = {
    good: "#8fd6a0",
    stressed: "#f0a86a",
    tired: "#8aa0c0",
    low: "#9a8fd6",
    frustrated: "#e08a8a",
    uncertain: "#c4a0e0"
  };
  const DOW_FULL = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const HEAVY = new Set(["low", "stressed", "frustrated"]);

  function localKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // latest mood per day (created_at is stored localtime, so slice(0,10) = local day)
  const moodByDay = $derived.by(() => {
    const map = new Map<string, string>();
    for (const m of memories) {
      if (m.kind !== "mood" || !m.mood) continue;
      const key = m.created_at.slice(0, 10);
      if (!map.has(key)) map.set(key, m.mood); // memories are newest-first → keep the latest
    }
    return map;
  });

  // 12 columns (weeks) × 7 rows (Sun→Sat)
  const heat = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - 7 * 11); // Sunday, 11 weeks back
    const weeks: { key: string; mood: string | null; future: boolean }[][] = [];
    for (let w = 0; w < 12; w++) {
      const col: { key: string; mood: string | null; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + w * 7 + d);
        const key = localKey(cur);
        const future = cur.getTime() > today.getTime();
        col.push({ key, mood: future ? null : (moodByDay.get(key) ?? null), future });
      }
      weeks.push(col);
    }
    return weeks;
  });

  // a soft observation, only when there's enough signal — never a diagnosis
  const pattern = $derived.by(() => {
    const dow = Array.from({ length: 7 }, () => ({ heavy: 0, good: 0, total: 0 }));
    for (const [key, mood] of moodByDay) {
      const i = new Date(key + "T00:00:00").getDay();
      dow[i].total++;
      if (HEAVY.has(mood)) dow[i].heavy++;
      if (mood === "good") dow[i].good++;
    }
    if (dow.reduce((a, b) => a + b.total, 0) < 8) return "";
    let heavyDay = -1, heavyRatio = 0, goodDay = -1, goodRatio = 0;
    dow.forEach((x, i) => {
      if (x.total < 2) return;
      const hr = x.heavy / x.total;
      const gr = x.good / x.total;
      if (hr > heavyRatio) { heavyRatio = hr; heavyDay = i; }
      if (gr > goodRatio) { goodRatio = gr; goodDay = i; }
    });
    const parts: string[] = [];
    if (heavyDay >= 0 && heavyRatio >= 0.5) parts.push(`${DOW_FULL[heavyDay]} tend to feel heavier — good to know.`);
    if (goodDay >= 0 && goodRatio >= 0.5 && goodDay !== heavyDay) parts.push(`${DOW_FULL[goodDay]} are often a good one.`);
    return parts.join(" ");
  });

  function iconFor(m: Memory): string {
    if (m.kind === "mood") return MOOD_EMOJI[m.mood ?? ""] ?? "·";
    if (m.kind === "win") return "✦";
    if (m.kind === "learned") return "📘";
    if (m.kind === "survived") return "⛰";
    if (m.kind === "seed") return "🌱";
    if (m.kind === "praise") return "💬";
    if (m.kind === "letter") return "✉️";
    return "◓";
  }

  function textFor(m: Memory): string {
    if (m.kind === "mood") return m.text ? `felt ${m.mood} — ${m.text}` : `felt ${m.mood}`;
    if (m.kind === "seed") return `where we started: "${m.text}"`;
    if (m.kind === "praise") return `"${m.text}"`;
    return m.text ?? "";
  }

  function monthLabel(dateStr: string): string {
    const d = new Date(dateStr.replace(" ", "T"));
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  onMount(async () => {
    memories = await allMemories(250);
    const byMonth = new Map<string, Memory[]>();
    for (const m of memories) {
      const k = monthLabel(m.created_at);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(m);
    }
    groups = [...byMonth.entries()].map(([month, items]) => ({ month, items }));
    days = daysTogether(await getMeta("first_met"));
    const interactions = Number((await getMeta("interactions")) ?? 0);
    stage = bondStage(days, interactions).label;

    // emergent personality, from real signals
    const moods = memories.filter((m) => m.kind === "mood");
    const good = moods.filter((m) => m.mood === "good").length;
    persona = derivePersona({
      nightSessions: Number((await getMeta("sess_night")) ?? 0),
      daySessions: Number((await getMeta("sess_day")) ?? 0),
      commits: Number((await getMeta("commits")) ?? 0),
      learned: memories.filter((m) => m.kind === "learned").length,
      wins: memories.filter((m) => m.kind === "win").length,
      goodRatio: moods.length ? good / moods.length : 0,
      days
    });
    chapters = await allChapters();
    loaded = true;
  });
  /** Export all memories as a plain-text file — local only, no cloud. */
  function exportTxt() {
    const lines: string[] = [
      `Hearthmon — ${petName}'s Journey`,
      `Exported: ${new Date().toLocaleDateString()}`,
      `Days together: ${days} · Bond: ${stage}`,
      "",
      "=".repeat(48),
      ""
    ];
    for (const g of groups) {
      lines.push(`── ${g.month} ──`);
      for (const m of g.items) {
        const icon = iconFor(m);
        const txt  = textFor(m);
        const date = shortDate(m.created_at);
        lines.push(`  ${icon}  [${date}]  ${txt}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), {
      href: url,
      download: `hearthmon-journey-${new Date().toISOString().slice(0,10)}.txt`
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="panel">
  <div class="head">
    <span>Our journey</span>
    <div class="head-actions">
      <button class="export-btn" onclick={exportTxt} title="Export memories as .txt">⬇ export</button>
      <button class="x" onclick={onClose}>✕</button>
    </div>
  </div>
  <p class="sub">
    {petName} & you — {days}
    {days === 1 ? "day" : "days"} · <span class="tier-badge">✦ {stage}</span>
  </p>
  {#if persona}
    <p class="persona" title={persona.blurb}>{persona.icon} {persona.label}</p>
  {/if}
  <p class="quirks">🎭 {quirkSummary(dexId)}</p>
  {#if temperament}
    <p class="quirks">🌡️ {temperament} <span class="quirk-note">— shaped by you</span></p>
  {/if}

  <!-- Tab strip -->
  <div class="tabs">
    <button class="tab" class:active={tab === "timeline"} onclick={() => (tab = "timeline")}>
      Timeline
    </button>
    <button class="tab" class:active={tab === "badges"} onclick={() => (tab = "badges")}>
      Badges 🏅
    </button>
    <button class="tab" class:active={tab === "moods"} onclick={() => (tab = "moods")}>
      Moods 📊
    </button>
    <button class="tab" class:active={tab === "chapters"} onclick={() => (tab = "chapters")}>
      Chapters 📔
    </button>
    <button class="tab" class:active={tab === "sky"} onclick={() => (tab = "sky")}>
      Sky ✦
    </button>
  </div>

  <div class="scroll">
    {#if tab === "timeline"}
      {#if loaded && !groups.length}
        <p class="empty">The first page is still blank.<br />It won't stay that way.</p>
      {/if}
      {#each groups as g (g.month)}
        <h3>{g.month}</h3>
        {#each g.items as m (m.id)}
          <div class="item">
            <span class="icon">{iconFor(m)}</span>
            <span class="text">{textFor(m)}</span>
            <span class="date">{shortDate(m.created_at)}</span>
          </div>
        {/each}
      {/each}
    {:else if tab === "badges"}
      <BadgesPanel {petName} />
    {:else if tab === "moods"}
      {#if loaded && !moodByDay.size}
        <p class="empty">Log a few moods and a 12-week map blooms here.</p>
      {:else}
        <div class="heat">
          <div class="heat-rows">
            {#each ["S", "M", "T", "W", "T", "F", "S"] as lbl, r (r)}
              <span class="rowlbl">{r % 2 === 1 ? lbl : ""}</span>
            {/each}
          </div>
          <div class="heat-grid">
            {#each heat as col, w (w)}
              <div class="heat-col">
                {#each col as cell (cell.key)}
                  <span
                    class="cell"
                    class:empty={!cell.mood}
                    class:future={cell.future}
                    style={cell.mood ? `background:${MOOD_COLOR[cell.mood]}` : ""}
                    title={cell.future ? "" : `${cell.key}${cell.mood ? " · " + cell.mood : ""}`}
                  ></span>
                {/each}
              </div>
            {/each}
          </div>
        </div>
        <div class="legend">
          {#each Object.entries(MOOD_COLOR) as [mood, col] (mood)}
            <span class="leg"><span class="swatch" style="background:{col}"></span>{mood}</span>
          {/each}
        </div>
        {#if pattern}<p class="pattern">{pattern}</p>{/if}
      {/if}
    {:else if tab === "chapters"}
      {#if openCh}
        <div class="chap open">
          <div class="chap-name">📖 {openCh.text}</div>
          <div class="chap-meta">since {shortDate(openCh.created_at)} · {countIn(openCh)} memories</div>
          <button class="chap-close" onclick={() => doCloseChapter(openCh.id, openCh.text ?? "")}>
            close this chapter ✓
          </button>
        </div>
      {:else}
        <div class="chap-start">
          <input
            type="text"
            placeholder="name this chapter… (e.g. Docker Journey)"
            bind:value={newChap}
            onkeydown={(e) => e.key === "Enter" && doStartChapter()}
          />
          <button disabled={!newChap.trim()} onclick={doStartChapter}>begin</button>
        </div>
      {/if}

      {#if pastChapters.length}
        <h3>Closed chapters</h3>
        {#each pastChapters as ch (ch.id)}
          <div class="chap">
            <div class="chap-name">{ch.text}</div>
            <div class="chap-meta">
              {shortDate(ch.created_at)} – {ch.read_at ? shortDate(ch.read_at) : "now"} · {countIn(ch)} memories
            </div>
          </div>
        {/each}
      {:else if !openCh}
        <p class="empty">Name a stretch of life — "Internship", "Thesis crunch" — and it'll gather everything that happens inside it.</p>
      {/if}
    {:else}
      <Constellation {memories} />
    {/if}
  </div>
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    max-height: 320px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(33, 28, 48, 0.96);
    border: 1px solid rgba(120, 108, 160, 0.45);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    color: #ece6f7;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 5;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: #f0b66a;
  }
  .x {
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 12px;
  }
  .x:hover { color: #f0b66a; }
  .head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .export-btn {
    background: none;
    border: 1px solid rgba(120, 108, 160, 0.35);
    border-radius: 6px;
    color: #9d92bd;
    cursor: pointer;
    font-size: 9.5px;
    padding: 2px 7px;
    transition: color 0.18s, border-color 0.18s;
  }
  .export-btn:hover {
    color: #f0b66a;
    border-color: rgba(240, 182, 106, 0.5);
  }
  .sub {
    margin: 0;
    font-size: 11px;
    color: #9d92bd;
    text-align: center;
  }
  .tier-badge {
    display: inline-block;
    padding: 1px 9px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    color: #f0d9a6;
    background: rgba(240, 182, 106, 0.14);
    border: 1px solid rgba(240, 182, 106, 0.4);
    box-shadow: 0 0 10px rgba(240, 182, 106, 0.18);
  }
  .persona {
    margin: -2px 0 2px;
    text-align: center;
    font-size: 10.5px;
    color: #c4b5f0;
    cursor: default;
  }
  .quirks {
    margin: 0 0 4px;
    text-align: center;
    font-size: 10px;
    color: #9d92bd;
    cursor: default;
  }
  .quirk-note {
    color: #7b7099;
    font-style: italic;
  }

  /* ---- Tab strip ---- */
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid rgba(120, 108, 160, 0.22);
    padding-bottom: 6px;
  }
  .tab {
    flex: 1;
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    color: #7a7098;
    font-size: 11px;
    cursor: pointer;
    padding: 4px 0;
    font-family: inherit;
    transition: color 0.18s, border-color 0.18s, background 0.18s;
  }
  .tab:hover {
    color: #c4b5f0;
  }
  .tab.active {
    color: #f0b66a;
    border-color: rgba(240, 182, 106, 0.35);
    background: rgba(240, 182, 106, 0.08);
    font-weight: 600;
  }

  .scroll {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-right: 4px;
  }
  .scroll::-webkit-scrollbar {
    width: 5px;
  }
  .scroll::-webkit-scrollbar-thumb {
    background: rgba(120, 108, 160, 0.4);
    border-radius: 3px;
  }
  h3 {
    margin: 8px 0 2px;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #9d92bd;
  }
  .item {
    display: flex;
    align-items: baseline;
    gap: 7px;
    font-size: 11.5px;
    line-height: 1.45;
    color: #ddd5ee;
    padding: 3px 0;
    border-bottom: 1px solid rgba(120, 108, 160, 0.12);
  }
  .icon {
    flex: 0 0 16px;
    text-align: center;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .date {
    flex: 0 0 auto;
    font-size: 9.5px;
    color: #8d82ab;
  }
  .empty {
    font-size: 12px;
    line-height: 1.6;
    color: #b6acce;
    text-align: center;
    margin: 16px 4px;
  }

  /* ── mood heatmap ── */
  .heat {
    display: flex;
    gap: 4px;
    align-items: flex-start;
    padding: 6px 0 2px;
  }
  .heat-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rowlbl {
    height: 11px;
    line-height: 11px;
    width: 9px;
    text-align: right;
    font-size: 7px;
    color: #7a7098;
  }
  .heat-grid {
    display: flex;
    gap: 2px;
    overflow-x: auto;
  }
  .heat-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cell {
    width: 11px;
    height: 11px;
    border-radius: 2px;
    background: rgba(120, 108, 160, 0.5);
  }
  .cell.empty {
    background: rgba(120, 108, 160, 0.14);
  }
  .cell.future {
    background: transparent;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 10px;
    margin-top: 8px;
  }
  .leg {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    color: #9d92bd;
  }
  .swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }
  .pattern {
    margin: 8px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #c4b5f0;
  }

  /* ── chapters ── */
  .chap {
    border: 1px solid rgba(120, 108, 160, 0.28);
    border-radius: 10px;
    padding: 8px 10px;
    margin-bottom: 5px;
    background: rgba(255, 255, 255, 0.04);
  }
  .chap.open {
    border-color: rgba(240, 182, 106, 0.45);
    background: rgba(240, 182, 106, 0.1);
  }
  .chap-name {
    font-size: 12.5px;
    font-weight: 700;
    color: #f3eefc;
  }
  .chap-meta {
    font-size: 10px;
    color: #9d92bd;
    margin-top: 2px;
  }
  .chap-close {
    margin-top: 7px;
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid rgba(240, 182, 106, 0.5);
    background: rgba(240, 182, 106, 0.16);
    color: #f0d9a6;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
  }
  .chap-close:hover { background: rgba(240, 182, 106, 0.28); }
  .chap-start {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .chap-start input {
    flex: 1;
    min-width: 0;
    padding: 7px 9px;
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.45);
    background: rgba(22, 17, 36, 0.9);
    color: #ece6f7;
    font-size: 11.5px;
    font-family: inherit;
    outline: none;
  }
  .chap-start input:focus { border-color: #f0b66a; }
  .chap-start button {
    padding: 0 14px;
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.45);
    background: rgba(48, 38, 68, 0.92);
    color: #ece6f7;
    font-size: 11.5px;
    font-family: inherit;
    cursor: pointer;
  }
  .chap-start button:disabled { opacity: 0.45; cursor: default; }
</style>
