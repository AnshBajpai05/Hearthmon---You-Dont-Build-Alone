<script lang="ts">
  import { onMount } from "svelte";
  import { allMemories, type Memory } from "../db";
  import { shortDate } from "../lines";

  interface Props {
    onClose: () => void;
  }
  let { onClose }: Props = $props();

  let items = $state<Memory[]>([]);
  let loaded = $state(false);
  let jarOpen = $state(false);
  let revealed = $state(0);

  const EMOJI: Record<string, string> = {
    win: "✨",
    survived: "🛡️",
    learned: "🧠",
    mood: "💛",   // only good moods surface here
    note: "📝",
    seed: "🌱",
    letter: "✉️"
  };
  const LABELS: Record<string, string> = {
    win: "win",
    survived: "survived",
    learned: "learned",
    mood: "good day",
    note: "note",
    seed: "origin",
    letter: "note to self"
  };

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  onMount(async () => {
    // Pull a generous pool: wins, survived, learned, good moods — all are good things.
    // Exclude very recent (< 2 days) so they feel like rediscoveries.
    const all = await allMemories(500);
    const twoDaysAgo = Date.now() - 2 * 86_400_000;
    const pool = all.filter((m) => {
      const ts = new Date(m.created_at.replace(" ", "T")).getTime();
      const old = ts < twoDaysAgo;
      if (m.kind === "win") return true;          // all wins, any age
      if (m.kind === "survived") return old;
      if (m.kind === "learned") return old;
      if (m.kind === "mood" && m.mood === "good") return old;
      return false;
    });

    items = shuffle(pool).slice(0, 3);
    loaded = true;

    setTimeout(() => (jarOpen = true), 180);
    setTimeout(() => (revealed = 1), 520);
    setTimeout(() => (revealed = 2), 780);
    setTimeout(() => (revealed = 3), 1040);
  });
</script>

<div class="panel" role="dialog" aria-label="Good Things Jar">
  <div class="head">
    <span>Good Things Jar 🫙</span>
    <button class="x" onclick={onClose}>✕</button>
  </div>

  <div class="jar-area">
    <div class="jar">
      <div class="jar-lid" class:popped={jarOpen}>🪄</div>
      <span class="jar-icon">🫙</span>
      {#if jarOpen}
        <span class="sparkle s1" aria-hidden="true">✦</span>
        <span class="sparkle s2" aria-hidden="true">✦</span>
        <span class="sparkle s3" aria-hidden="true">✦</span>
      {/if}
    </div>
  </div>

  <div class="cards">
    {#if !loaded}
      <p class="hint">…reaching in…</p>
    {:else if items.length === 0}
      <p class="hint">
        The jar is waiting to be filled.<br />
        Log a win, something you learned, or a good day — future you will reach for it.
      </p>
    {:else}
      {#each items as m, i (m.id)}
        <div class="card" class:visible={revealed > i}>
          <span class="card-icon">{EMOJI[m.kind] ?? "✨"}</span>
          <div class="card-body">
            <span class="card-label">{LABELS[m.kind] ?? m.kind}</span>
            <p class="card-text">{m.text ?? (m.mood === "good" ? "a good day" : "")}</p>
            <span class="card-date">{shortDate(m.created_at)}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <p class="footer">One tap. Instant warmth.</p>
</div>

<style>
  .panel {
    position: absolute;
    top: 10px; left: 10px; right: 10px;
    padding: 12px 14px 10px;
    border-radius: 18px;
    background: rgba(30, 24, 46, 0.97);
    border: 1px solid rgba(240, 182, 106, 0.35);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(240,182,106,0.08);
    color: #ece6f7;
    display: flex; flex-direction: column; gap: 10px;
    z-index: 5;
  }
  .head {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; font-weight: 600; color: #f0b66a;
  }
  .x { background: none; border: none; color: #8d82ab; cursor: pointer; font-size: 12px; padding: 0; }
  .x:hover { color: #f0b66a; }

  .jar-area { display: flex; justify-content: center; padding: 4px 0 0; }
  .jar { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; }

  .jar-lid {
    font-size: 20px;
    transition: transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
    filter: drop-shadow(0 0 6px rgba(240,182,106,0.5));
  }
  .jar-lid.popped { transform: translateY(-10px) rotate(20deg); }

  .jar-icon { font-size: 38px; filter: drop-shadow(0 4px 12px rgba(240,182,106,0.3)); }

  .sparkle {
    position: absolute;
    top: 2px;
    font-size: 10px; color: #f0b66a; pointer-events: none;
    opacity: 0; animation: sparklefly 0.9s ease-out forwards;
  }
  .s1 { left: 2px;  animation-delay: 0.05s; --sdx: -14px; }
  .s2 { left: 16px; animation-delay: 0.13s; --sdx: 2px; }
  .s3 { left: 30px; animation-delay: 0.22s; --sdx: 16px; }
  @keyframes sparklefly {
    0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
    30%  { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--sdx, 0px), -22px) scale(1.3); }
  }

  .cards { display: flex; flex-direction: column; gap: 7px; }
  .hint { font-size: 12px; color: #9d92bd; text-align: center; line-height: 1.55; margin: 4px 0; }

  .card {
    display: flex; align-items: flex-start; gap: 9px;
    padding: 8px 10px; border-radius: 12px;
    background: rgba(50, 42, 72, 0.65);
    border: 1px solid rgba(120, 108, 160, 0.25);
    opacity: 0;
    transform: translateY(12px) scale(0.97);
    transition:
      opacity 0.36s cubic-bezier(0.34, 1.2, 0.64, 1),
      transform 0.36s cubic-bezier(0.34, 1.2, 0.64, 1),
      border-color 0.2s;
  }
  .card.visible { opacity: 1; transform: translateY(0) scale(1); }
  .card:hover { border-color: rgba(240,182,106,0.4); background: rgba(60,50,85,0.75); }

  .card-icon { font-size: 17px; flex-shrink: 0; margin-top: 1px; }
  .card-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .card-label {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: #f0b66a; opacity: 0.8;
  }
  .card-text { font-size: 12px; line-height: 1.4; color: #ddd5ee; margin: 0; word-break: break-word; }
  .card-date { font-size: 10px; color: #7a7098; margin-top: 1px; }

  .footer { font-size: 10px; color: #5d5580; text-align: center; margin: 0; padding-bottom: 2px; }
</style>
