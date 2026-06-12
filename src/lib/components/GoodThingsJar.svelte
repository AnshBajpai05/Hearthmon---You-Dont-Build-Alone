<script lang="ts">
  import { onMount } from "svelte";
  import { memoriesOfKind, forgottenWins, type Memory } from "../db";
  import { shortDate } from "../lines";

  interface Props {
    onClose: () => void;
  }
  let { onClose }: Props = $props();

  let items = $state<Memory[]>([]);
  let loaded = $state(false);
  let jarOpen = $state(false);
  let revealed = $state(0); // how many cards have animated in

  const EMOJI: Record<string, string> = {
    win: "✨",
    survived: "🛡️",
    learned: "🧠",
    mood: "💛",
    note: "📝",
    seed: "🌱"
  };

  const LABELS: Record<string, string> = {
    win: "win",
    survived: "survived",
    learned: "learned",
    mood: "good day",
    note: "note",
    seed: "origin"
  };

  async function drawFromJar() {
    // Mix: prefer forgotten wins, also pull from survived + learned
    const forgotten = await forgottenWins(3);
    const survived = await memoriesOfKind("survived", 3);
    const learned = await memoriesOfKind("learned", 3);
    const wins = await memoriesOfKind("win", 3);

    // Pool and deduplicate by id, then pick 3 randomly
    const pool = [...forgotten, ...survived, ...learned, ...wins].filter(
      (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
    );
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    items = pool.slice(0, 3);
    loaded = true;
  }

  onMount(async () => {
    await drawFromJar();
    // Jar lid pops open first
    setTimeout(() => (jarOpen = true), 180);
    // Cards float up one by one
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

  <!-- The jar itself -->
  <div class="jar-area">
    <div class="jar" class:open={jarOpen}>
      <div class="jar-lid" class:popped={jarOpen}>🪄</div>
      <div class="jar-body">
        <span class="jar-icon">🫙</span>
      </div>
      {#if jarOpen}
        <span class="sparkle s1" aria-hidden="true">✦</span>
        <span class="sparkle s2" aria-hidden="true">✦</span>
        <span class="sparkle s3" aria-hidden="true">✦</span>
      {/if}
    </div>
  </div>

  <!-- Memory cards float up -->
  <div class="cards">
    {#if !loaded}
      <p class="hint">…reaching in…</p>
    {:else if items.length === 0}
      <p class="hint">
        The jar is waiting to be filled.<br />
        Log a win or something you learned — future you will reach for it.
      </p>
    {:else}
      {#each items as m, i (m.id)}
        <div class="card" class:visible={revealed > i}>
          <span class="card-icon">{EMOJI[m.kind] ?? "✨"}</span>
          <div class="card-body">
            <span class="card-label">{LABELS[m.kind] ?? m.kind}</span>
            <p class="card-text">{m.text ?? `you felt ${m.mood}`}</p>
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
    top: 10px;
    left: 10px;
    right: 10px;
    padding: 12px 14px 10px;
    border-radius: 18px;
    background: rgba(30, 24, 46, 0.97);
    border: 1px solid rgba(240, 182, 106, 0.35);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(240, 182, 106, 0.08);
    color: #ece6f7;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 5;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    color: #f0b66a;
  }
  .x {
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 12px;
    padding: 0;
  }
  .x:hover { color: #f0b66a; }

  /* ---- Jar area ---- */
  .jar-area {
    display: flex;
    justify-content: center;
    padding: 6px 0 2px;
  }
  .jar {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .jar-lid {
    font-size: 20px;
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: center bottom;
    filter: drop-shadow(0 0 6px rgba(240, 182, 106, 0.5));
  }
  .jar-lid.popped {
    transform: translateY(-12px) rotate(18deg);
  }
  .jar-body {
    position: relative;
  }
  .jar-icon {
    font-size: 38px;
    filter: drop-shadow(0 4px 12px rgba(240, 182, 106, 0.3));
  }

  /* sparkles that fly out when the lid pops */
  .sparkle {
    position: absolute;
    font-size: 10px;
    color: #f0b66a;
    pointer-events: none;
    opacity: 0;
    animation: sparklefly 0.9s ease-out forwards;
  }
  .s1 { top: -8px; left: 6px;  animation-delay: 0.05s; }
  .s2 { top: -14px; left: 18px; animation-delay: 0.12s; }
  .s3 { top: -6px;  left: 28px; animation-delay: 0.20s; }

  @keyframes sparklefly {
    0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
    30%  { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--sdx, 0px), -24px) scale(1.2); }
  }
  .s1 { --sdx: -12px; }
  .s2 { --sdx: 2px; }
  .s3 { --sdx: 14px; }

  /* ---- Memory cards ---- */
  .cards {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .hint {
    font-size: 12px;
    color: #9d92bd;
    text-align: center;
    line-height: 1.55;
    margin: 4px 0;
  }

  .card {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(50, 42, 72, 0.65);
    border: 1px solid rgba(120, 108, 160, 0.25);
    opacity: 0;
    transform: translateY(14px) scale(0.97);
    transition:
      opacity 0.38s cubic-bezier(0.34, 1.2, 0.64, 1),
      transform 0.38s cubic-bezier(0.34, 1.2, 0.64, 1);
  }
  .card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  .card:hover {
    border-color: rgba(240, 182, 106, 0.4);
    background: rgba(60, 50, 85, 0.75);
  }

  .card-icon {
    font-size: 17px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .card-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #f0b66a;
    opacity: 0.8;
  }
  .card-text {
    font-size: 12px;
    line-height: 1.4;
    color: #ddd5ee;
    margin: 0;
    word-break: break-word;
  }
  .card-date {
    font-size: 10px;
    color: #7a7098;
    margin-top: 1px;
  }

  .footer {
    font-size: 10px;
    color: #5d5580;
    text-align: center;
    margin: 0;
    padding-bottom: 2px;
  }
</style>
