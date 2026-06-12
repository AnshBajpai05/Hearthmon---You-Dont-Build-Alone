<script lang="ts">
  // "Our Journey" — the living scrapbook. Years later you open this and see
  // what you survived, learned, felt, and built. Memory > motivation.
  import { onMount } from "svelte";
  import { allMemories, getMeta, type Memory } from "../db";
  import { daysTogether, bondStage } from "../bond";
  import { shortDate } from "../lines";

  interface Props {
    petName: string;
    onClose: () => void;
  }
  let { petName, onClose }: Props = $props();

  let groups = $state<{ month: string; items: Memory[] }[]>([]);
  let days = $state(0);
  let stage = $state("Stranger");
  let loaded = $state(false);

  const MOOD_EMOJI: Record<string, string> = {
    good: "🙂",
    stressed: "😓",
    tired: "😴",
    low: "😞",
    frustrated: "😤",
    uncertain: "🤔"
  };

  function iconFor(m: Memory): string {
    if (m.kind === "mood") return MOOD_EMOJI[m.mood ?? ""] ?? "·";
    if (m.kind === "win") return "✦";
    if (m.kind === "learned") return "📘";
    if (m.kind === "survived") return "⛰";
    if (m.kind === "seed") return "🌱";
    return "◓";
  }

  function textFor(m: Memory): string {
    if (m.kind === "mood") return m.text ? `felt ${m.mood} — ${m.text}` : `felt ${m.mood}`;
    if (m.kind === "seed") return `where we started: "${m.text}"`;
    return m.text ?? "";
  }

  function monthLabel(dateStr: string): string {
    const d = new Date(dateStr.replace(" ", "T"));
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  onMount(async () => {
    const memories = await allMemories(250);
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
    loaded = true;
  });
</script>

<div class="panel">
  <div class="head">
    <span>Our journey</span>
    <button class="x" onclick={onClose}>✕</button>
  </div>
  <p class="sub">
    {petName} & you — {days}
    {days === 1 ? "day" : "days"} · <em>{stage}</em>
  </p>

  <div class="scroll">
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
  </div>
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    max-height: 300px;
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
  .sub {
    margin: 0;
    font-size: 11px;
    color: #9d92bd;
    text-align: center;
  }
  .sub em {
    color: #f0b66a;
    font-style: normal;
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
</style>
