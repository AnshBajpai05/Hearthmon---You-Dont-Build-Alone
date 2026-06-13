<script lang="ts">
  // The Constellation of Growth — not stats, a night sky. Each memory is a star,
  // laid out oldest → newest, joined by the faint trail of your journey.
  import type { Memory } from "../db";
  import { shortDate } from "../lines";

  let { memories }: { memories: Memory[] } = $props();

  const W = 300;
  const H = 210;
  const PAD = 18;

  const KIND_COLOR: Record<string, string> = {
    win: "#ffd94a",
    learned: "#7fe0e8",
    survived: "#ff9a52",
    praise: "#f0a8d8",
    seed: "#8fe88f",
    letter: "#c4b5f0",
    note: "#9d92bd"
  };
  const MOOD_GOOD = "#7fd88a";
  const MOOD_HEAVY = "#6f86c9";
  const MOOD_OTHER = "#8aa0e0";

  // vertical bands give each kind a rough "altitude", jittered so it feels organic
  const BANDS = ["seed", "win", "learned", "praise", "mood", "survived", "letter", "note"];

  interface Star {
    id: number;
    x: number;
    y: number;
    c: string;
    r: number;
    delay: number;
    label: string;
  }

  function pseudo(n: number): number {
    const s = Math.sin(n * 99.13) * 43758.5453;
    return s - Math.floor(s);
  }
  function ts(m: Memory): number {
    return new Date(m.created_at.replace(" ", "T")).getTime();
  }
  function colorFor(m: Memory): string {
    if (m.kind === "mood") {
      if (m.mood === "good") return MOOD_GOOD;
      if (["low", "stressed", "frustrated"].includes(m.mood ?? "")) return MOOD_HEAVY;
      return MOOD_OTHER;
    }
    return KIND_COLOR[m.kind] ?? "#cccccc";
  }
  function labelFor(m: Memory): string {
    if (m.kind === "mood") return `felt ${m.mood}`;
    if (m.kind === "praise") return "someone saw something in you";
    if (m.kind === "seed") return "where we started";
    if (m.kind === "letter") return "a note to yourself";
    return m.text ?? m.kind;
  }

  const stars = $derived.by<Star[]>(() => {
    const ms = [...memories].sort((a, b) => ts(a) - ts(b)).slice(-100);
    if (!ms.length) return [];
    const times = ms.map(ts);
    const tMin = Math.min(...times);
    const span = Math.max(1, Math.max(...times) - tMin);
    const bandH = (H - 2 * PAD) / BANDS.length;
    return ms.map((m, i) => {
      const fx = ms.length === 1 ? 0.5 : (times[i] - tMin) / span;
      const x = PAD + fx * (W - 2 * PAD);
      const bi = Math.max(0, BANDS.indexOf(m.kind === "mood" ? "mood" : m.kind));
      const y = Math.max(
        PAD,
        Math.min(H - PAD, PAD + (bi + 0.5) * bandH + (pseudo(m.id) * 2 - 1) * 13)
      );
      const big = m.kind === "win" || m.kind === "survived" || m.kind === "seed";
      return {
        id: m.id,
        x,
        y,
        c: colorFor(m),
        r: big ? 2.6 : 1.8,
        delay: (i % 12) * 0.22,
        label: `${shortDate(m.created_at)} · ${labelFor(m)}`
      };
    });
  });

  const trail = $derived(
    stars.map((s, i) => (i ? "L" : "M") + s.x.toFixed(1) + " " + s.y.toFixed(1)).join(" ")
  );
</script>

{#if !stars.length}
  <p class="empty">Your sky is still dark.<br />Each memory you keep becomes a star.</p>
{:else}
  <p class="cap">{stars.length} {stars.length === 1 ? "star" : "stars"} · oldest → newest</p>
  <svg class="sky" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="A constellation of your memories">
    <path class="trail" d={trail} />
    {#each stars as s (s.id)}
      <circle class="star" cx={s.x} cy={s.y} r={s.r} fill={s.c} style="animation-delay: {s.delay}s">
        <title>{s.label}</title>
      </circle>
    {/each}
  </svg>
  <p class="hint">hover a star to remember it</p>
{/if}

<style>
  .cap {
    margin: 0 0 4px;
    font-size: 10px;
    color: #7a7098;
    text-align: right;
    letter-spacing: 0.04em;
  }
  .sky {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 12px;
    background:
      radial-gradient(ellipse at 70% 20%, rgba(90, 80, 150, 0.25), transparent 60%),
      radial-gradient(ellipse at 25% 85%, rgba(70, 90, 150, 0.2), transparent 60%),
      linear-gradient(to bottom, #14101f, #1c1730);
  }
  .trail {
    fill: none;
    stroke: rgba(180, 168, 220, 0.22);
    stroke-width: 0.6;
    stroke-linejoin: round;
  }
  .star {
    cursor: help;
    filter: drop-shadow(0 0 2px currentColor);
    animation: twinkle 3.6s ease-in-out infinite;
  }
  @keyframes twinkle {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
  .star:hover {
    opacity: 1;
    r: 4;
  }
  .empty {
    font-size: 12px;
    line-height: 1.6;
    color: #b6acce;
    text-align: center;
    margin: 18px 4px;
  }
  .hint {
    margin: 5px 0 0;
    font-size: 9.5px;
    color: #5d5580;
    text-align: center;
  }
</style>
