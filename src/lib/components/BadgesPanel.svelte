<script lang="ts">
  // Emotional achievement badges — not productivity metrics.
  // Vision doc: "no boring badges. Instead: emotional milestones."
  // CUDA Survivor · Builder's Courage · Quiet Consistency · Night Owl · etc.
  import { onMount } from "svelte";
  import { allMemories, getMeta, memoriesOfKind, hardMoodCount, type Memory } from "../db";
  import { daysTogether } from "../bond";

  interface Props {
    petName: string;
  }
  let { petName }: Props = $props();

  interface Badge {
    id: string;
    icon: string;
    name: string;
    flavour: string;       // emotional description, not metric
    earned: boolean;
    earnedOn?: string;     // ISO date string if applicable
    rare?: boolean;        // legendary-tier badge
  }

  let badges = $state<Badge[]>([]);
  let loaded = $state(false);
  let revealCount = $state(0);

  onMount(async () => {
    const memories = await allMemories(500);
    const firstMet = await getMeta("first_met");
    const days = daysTogether(firstMet);
    const interactions = Number((await getMeta("interactions")) ?? 0);
    const moodCount = memories.filter((m) => m.kind === "mood").length;
    const winCount = memories.filter((m) => m.kind === "win").length;
    const survivedMems = memories.filter((m) => m.kind === "survived");
    const learnedMems = memories.filter((m) => m.kind === "learned");
    const heavyMoods = memories.filter(
      (m) => m.kind === "mood" && ["low", "stressed", "frustrated"].includes(m.mood ?? "")
    );
    const goodDays = memories.filter((m) => m.kind === "mood" && m.mood === "good");
    const seed = memories.find((m) => m.kind === "seed");

    // Check for CUDA/GPU references in any memory text
    const hasCuda = memories.some(
      (m) => m.text && /cuda|gpu|nvidia|torch|vram/i.test(m.text)
    );
    // Check for late-night mood logs (between 11pm – 5am from created_at)
    const lateNightCount = memories.filter((m) => {
      const h = new Date(m.created_at.replace(" ", "T")).getHours();
      return h >= 23 || h < 5;
    }).length;
    // Check for wins after low/stressed periods (comeback arc)
    const hasComeback = (() => {
      const sorted = [...memories].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        if (
          sorted[i].kind === "mood" &&
          ["low", "stressed"].includes(sorted[i].mood ?? "")
        ) {
          const after = sorted.slice(i + 1, i + 6);
          if (after.some((m) => m.kind === "win")) return true;
        }
      }
      return false;
    })();

    // Letters written
    const letters = memories.filter((m) => m.kind === ("letter" as any)).length;

    const result: Badge[] = [
      {
        id: "first_step",
        icon: "🌱",
        name: "First Step",
        flavour: "You said what you were building, and began.",
        earned: !!seed
      },
      {
        id: "check_in",
        icon: "🙂",
        name: "Self-Aware",
        flavour: "You started paying attention to how you actually feel.",
        earned: moodCount >= 3
      },
      {
        id: "good_things_jar",
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
        earned: survivedMems.length >= 1
      },
      {
        id: "hard_things_archive",
        icon: "🛡️",
        name: "Hard Things Archive",
        flavour: "Five hard things. Five times you kept going.",
        earned: survivedMems.length >= 5
      },
      {
        id: "curious_builder",
        icon: "📘",
        name: "Curious Builder",
        flavour: "You kept learning even when it was hard.",
        earned: learnedMems.length >= 3
      },
      {
        id: "quiet_consistency",
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
        id: "cuda_survivor",
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
        id: "letter_writer",
        icon: "✉️",
        name: "Letter Writer",
        flavour: "You trusted tomorrow-you with something.",
        earned: letters >= 1
      },
      {
        id: "heavy_week",
        icon: "🌧️",
        name: "Heavy Week",
        flavour: "You felt it. You logged it. You didn't pretend it wasn't real.",
        earned: heavyMoods.length >= 5
      },
      {
        id: "good_column",
        icon: "☀️",
        name: "Good Column",
        flavour: "Five days worth putting in the good column.",
        earned: goodDays.length >= 5
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
        flavour: "A whole year. Look how far you've come.",
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

    // Sort: earned first (by rarity), then locked
    badges = [
      ...result.filter((b) => b.earned && b.rare),
      ...result.filter((b) => b.earned && !b.rare),
      ...result.filter((b) => !b.earned)
    ];
    loaded = true;

    // Stagger reveal of earned badges
    const earnedCount = badges.filter((b) => b.earned).length;
    for (let i = 0; i <= earnedCount; i++) {
      setTimeout(() => (revealCount = i), i * 90);
    }
  });

  const earnedTotal = $derived(badges.filter((b) => b.earned).length);
</script>

<div class="badges-root">
  {#if !loaded}
    <p class="hint">…</p>
  {:else if earnedTotal === 0}
    <p class="empty">
      No badges yet — but that changes as soon as you log something.<br />
      They're waiting.
    </p>
  {:else}
    <p class="tally">
      {earnedTotal} of {badges.length} earned
    </p>
  {/if}

  <div class="grid">
    {#each badges as b, i (b.id)}
      <div
        class="badge"
        class:earned={b.earned}
        class:rare={b.rare}
        class:visible={b.earned ? i < revealCount : true}
        title={b.earned ? b.flavour : "Not yet earned"}
      >
        <span class="badge-icon">{b.icon}</span>
        <span class="badge-name">{b.name}</span>
        {#if b.earned}
          <span class="badge-flavour">{b.flavour}</span>
        {:else}
          <span class="badge-locked">—</span>
        {/if}
        {#if b.rare && b.earned}
          <span class="rare-glow" aria-hidden="true"></span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .badges-root {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hint, .empty {
    font-size: 11.5px;
    color: #9d92bd;
    text-align: center;
    line-height: 1.6;
    margin: 8px 0 0;
  }
  .tally {
    font-size: 10px;
    color: #7a7098;
    text-align: right;
    margin: 0;
    letter-spacing: 0.04em;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .badge {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 7px 9px;
    border-radius: 11px;
    border: 1px solid rgba(120, 108, 160, 0.18);
    background: rgba(40, 34, 58, 0.5);
    overflow: hidden;
    transition: border-color 0.2s, background 0.2s;
    /* locked badges show at full opacity but muted */
  }

  .badge:not(.earned) {
    opacity: 0.38;
    filter: saturate(0.3);
  }

  /* earned badges float in one by one */
  .badge.earned {
    opacity: 0;
    transform: translateY(6px) scale(0.97);
    transition:
      opacity 0.32s cubic-bezier(0.34, 1.2, 0.64, 1),
      transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1),
      border-color 0.2s;
    border-color: rgba(240, 182, 106, 0.28);
    background: rgba(55, 44, 76, 0.7);
  }
  .badge.earned.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  .badge.earned:hover {
    border-color: rgba(240, 182, 106, 0.55);
    background: rgba(65, 52, 90, 0.85);
  }

  /* rare badges glow */
  .badge.rare.earned {
    border-color: rgba(255, 215, 80, 0.5);
    background: rgba(60, 48, 20, 0.7);
  }
  .badge.rare.earned:hover {
    border-color: rgba(255, 215, 80, 0.8);
  }
  .rare-glow {
    position: absolute;
    inset: 0;
    border-radius: 11px;
    background: radial-gradient(ellipse at 50% 0%, rgba(255, 200, 60, 0.12) 0%, transparent 70%);
    pointer-events: none;
    animation: rarepulse 3s ease-in-out infinite;
  }
  @keyframes rarepulse {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1; }
  }

  .badge-icon {
    font-size: 18px;
    line-height: 1;
  }
  .badge-name {
    font-size: 11px;
    font-weight: 700;
    color: #e8e0f8;
    line-height: 1.2;
  }
  .badge-flavour {
    font-size: 9.5px;
    color: #9d92bd;
    line-height: 1.4;
    margin-top: 1px;
  }
  .badge-locked {
    font-size: 9px;
    color: #4a4068;
  }
</style>
