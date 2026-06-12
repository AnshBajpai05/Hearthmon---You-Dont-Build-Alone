<script lang="ts">
  // Emotional achievement badges — not productivity metrics.
  // Vision doc: "no boring badges. Instead: emotional milestones."
  import { onMount } from "svelte";
  import { allMemories, getMeta, type Memory } from "../db";
  import { daysTogether } from "../bond";

  interface Props {
    petName: string;
  }
  let { petName }: Props = $props();

  interface Badge {
    id: string;
    icon: string;
    name: string;
    flavour: string;
    earned: boolean;
    rare?: boolean;
  }

  let badges = $state<Badge[]>([]);
  let loaded = $state(false);
  let revealCount = $state(0);

  onMount(async () => {
    const memories = await allMemories(500);
    const firstMet = await getMeta("first_met");
    const days = daysTogether(firstMet);
    const interactions = Number((await getMeta("interactions")) ?? 0);

    // --- counts by kind ---
    const moodCount      = memories.filter((m) => m.kind === "mood").length;
    const winCount       = memories.filter((m) => m.kind === "win").length;
    const survivedCount  = memories.filter((m) => m.kind === "survived").length;
    const learnedCount   = memories.filter((m) => m.kind === "learned").length;
    const letterCount    = memories.filter((m) => m.kind === "letter").length;
    const heavyCount     = memories.filter(
      (m) => m.kind === "mood" && ["low","stressed","frustrated"].includes(m.mood ?? "")
    ).length;
    const goodCount      = memories.filter((m) => m.kind === "mood" && m.mood === "good").length;
    const seed           = memories.find((m) => m.kind === "seed");

    // Late-night sessions (11pm–5am)
    const lateNightCount = memories.filter((m) => {
      const h = new Date(m.created_at.replace(" ", "T")).getHours();
      return h >= 23 || h < 5;
    }).length;

    // CUDA/GPU reference in any memory text
    const hasCuda = memories.some(
      (m) => m.text && /cuda|gpu|nvidia|torch|vram/i.test(m.text)
    );

    // Comeback: win exists after a low/stressed mood (O(n) with a Set)
    const hasComeback = (() => {
      const sorted = [...memories].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      let sawHeavy = false;
      for (const m of sorted) {
        if (m.kind === "mood" && ["low","stressed"].includes(m.mood ?? "")) sawHeavy = true;
        if (sawHeavy && m.kind === "win") return true;
      }
      return false;
    })();

    // Returned after 7+ days away
    const hasLongReturn = (() => {
      const sorted = [...memories]
        .filter((m) => m.kind === "mood")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      for (let i = 1; i < sorted.length; i++) {
        const gap =
          (new Date(sorted[i].created_at).getTime() -
            new Date(sorted[i - 1].created_at).getTime()) /
          86_400_000;
        if (gap >= 7) return true;
      }
      return false;
    })();

    const result: Badge[] = [
      {
        id: "first_step",
        icon: "🌱",
        name: "First Step",
        flavour: "You said what you were building. That's how everything starts.",
        earned: !!seed
      },
      {
        id: "self_aware",
        icon: "🙂",
        name: "Self-Aware",
        flavour: "You started paying attention to how you actually feel.",
        earned: moodCount >= 3
      },
      {
        id: "quiet_win",
        icon: "✦",
        name: "Quiet Win",
        flavour: "You logged something worth remembering.",
        earned: winCount >= 1
      },
      {
        id: "still_standing",
        icon: "⛰️",
        name: "Still Standing",
        flavour: "You logged something hard — and you're still here.",
        earned: survivedCount >= 1
      },
      {
        id: "hard_things",
        icon: "🛡️",
        name: "Hard Things Archive",
        flavour: "Five hard things. Five times you kept going.",
        earned: survivedCount >= 5
      },
      {
        id: "curious",
        icon: "📘",
        name: "Curious Builder",
        flavour: "You kept learning even when you didn't have to.",
        earned: learnedCount >= 3
      },
      {
        id: "consistency",
        icon: "🕯️",
        name: "Quiet Consistency",
        flavour: "30 steady days. Not perfect. Present.",
        earned: days >= 30
      },
      {
        id: "night_owl",
        icon: "🌙",
        name: "Night Owl",
        flavour: "You and the dark hours have an understanding.",
        earned: lateNightCount >= 5
      },
      {
        id: "cuda",
        icon: "💀",
        name: "CUDA Survivor",
        flavour: "You fought the GPU. You lived to tell it.",
        earned: hasCuda
      },
      {
        id: "comeback",
        icon: "🔥",
        name: "Builder's Courage",
        flavour: "You logged a win after a hard day. That's the whole game.",
        earned: hasComeback
      },
      {
        id: "long_return",
        icon: "🚪",
        name: "Welcome Back",
        flavour: "You left. You came back. The door was always open.",
        earned: hasLongReturn
      },
      {
        id: "letter",
        icon: "✉️",
        name: "Letter Writer",
        flavour: "You trusted tomorrow-you with something.",
        earned: letterCount >= 1
      },
      {
        id: "heavy",
        icon: "🌧️",
        name: "Heavy Week",
        flavour: "You felt it. You logged it. That's not nothing.",
        earned: heavyCount >= 5
      },
      {
        id: "good_col",
        icon: "☀️",
        name: "Good Column",
        flavour: "Five days worth putting in the good column.",
        earned: goodCount >= 5
      },
      {
        id: "bonded",
        icon: "💛",
        name: "Familiar",
        flavour: "You came back enough that this stopped feeling new.",
        earned: interactions >= 25 && days >= 14
      },
      {
        id: "one_year",
        icon: "🌟",
        name: "One Year",
        flavour: "A whole year together. Look how far you've come.",
        earned: days >= 365,
        rare: true
      },
      {
        id: "lifetime",
        icon: "♾️",
        name: "Lifetime Companion",
        flavour: "Still here. Still building. Still together.",
        earned: days >= 365 && interactions >= 400,
        rare: true
      }
    ];

    // Sort: rare earned → earned → locked
    badges = [
      ...result.filter((b) => b.earned && b.rare),
      ...result.filter((b) => b.earned && !b.rare),
      ...result.filter((b) => !b.earned)
    ];
    loaded = true;

    // Stagger reveal: one badge every 80ms
    const earnedCount = badges.filter((b) => b.earned).length;
    for (let i = 1; i <= earnedCount; i++) {
      setTimeout(() => (revealCount = i), i * 80);
    }
  });

  const earnedTotal = $derived(badges.filter((b) => b.earned).length);
</script>

<div class="badges-root">
  {#if !loaded}
    <p class="hint">…checking your archive…</p>
  {:else if earnedTotal === 0}
    <p class="empty">
      No badges yet — but they're waiting.<br />
      Log something. Anything. The first one is easy.
    </p>
  {:else}
    <p class="tally">{earnedTotal} of {badges.length} earned</p>
  {/if}

  <div class="grid">
    {#each badges as b, i (b.id)}
      <div
        class="badge"
        class:earned={b.earned}
        class:rare={b.rare && b.earned}
        class:visible={b.earned && i < revealCount}
        title={b.earned ? b.flavour : "Not yet"}
      >
        <span class="badge-icon">{b.icon}</span>
        <span class="badge-name">{b.name}</span>
        {#if b.earned}
          <span class="badge-flavour">{b.flavour}</span>
        {:else}
          <span class="badge-locked">not yet</span>
        {/if}
        {#if b.rare && b.earned}
          <span class="rare-glow" aria-hidden="true"></span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .badges-root { display: flex; flex-direction: column; gap: 8px; }

  .hint, .empty {
    font-size: 11.5px; color: #9d92bd;
    text-align: center; line-height: 1.6; margin: 6px 0 0;
  }
  .tally {
    font-size: 10px; color: #7a7098;
    text-align: right; margin: 0; letter-spacing: 0.04em;
  }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

  .badge {
    position: relative; overflow: hidden;
    display: flex; flex-direction: column; gap: 2px;
    padding: 7px 9px; border-radius: 11px;
    border: 1px solid rgba(120, 108, 160, 0.18);
    background: rgba(40, 34, 58, 0.5);
    transition: border-color 0.2s, background 0.2s;
  }
  .badge:not(.earned) {
    opacity: 0.35;
    filter: saturate(0.25) brightness(0.85);
  }

  /* earned: start invisible, float in when .visible is added */
  .badge.earned {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
    transition:
      opacity 0.3s cubic-bezier(0.34, 1.2, 0.64, 1),
      transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1),
      border-color 0.2s, background 0.2s;
    border-color: rgba(240, 182, 106, 0.3);
    background: rgba(55, 44, 76, 0.7);
  }
  .badge.earned.visible { opacity: 1; transform: translateY(0) scale(1); }
  .badge.earned:hover { border-color: rgba(240,182,106,0.55); background: rgba(65,52,90,0.85); }

  .badge.rare {
    border-color: rgba(255, 215, 80, 0.5);
    background: rgba(55, 44, 18, 0.7);
  }
  .badge.rare:hover { border-color: rgba(255,215,80,0.8); }

  .rare-glow {
    position: absolute; inset: 0; border-radius: 11px;
    background: radial-gradient(ellipse at 50% 0%, rgba(255,200,60,0.14) 0%, transparent 70%);
    pointer-events: none;
    animation: rarepulse 3s ease-in-out infinite;
  }
  @keyframes rarepulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }

  .badge-icon { font-size: 18px; line-height: 1; }
  .badge-name { font-size: 11px; font-weight: 700; color: #e8e0f8; line-height: 1.2; }
  .badge-flavour { font-size: 9.5px; color: #9d92bd; line-height: 1.4; margin-top: 1px; }
  .badge-locked { font-size: 9px; color: #3d3560; font-style: italic; }
</style>
