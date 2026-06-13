<script lang="ts">
  import { onMount } from "svelte";
  import {
    memoriesOfKind,
    forgottenWins,
    hardDaysSurvived,
    type Memory
  } from "../db";
  import { shortDate } from "../lines";

  interface Props {
    onClose: () => void;
  }
  let { onClose }: Props = $props();

  let survived = $state<Memory[]>([]);
  let learned = $state<Memory[]>([]);
  let wins = $state<Memory[]>([]);
  let hardDays = $state<Memory[]>([]);
  let praise = $state<Memory[]>([]);
  let seed = $state<Memory | null>(null);
  let loaded = $state(false);

  // chronological (oldest → newest) so the wall/timeline read as a journey
  const survivedAsc = $derived([...survived].reverse());
  const learnedAsc = $derived([...learned].reverse());

  const moodWord: Record<string, string> = {
    low: "low",
    stressed: "stressed",
    frustrated: "frustrated"
  };

  onMount(async () => {
    survived = await memoriesOfKind("survived", 8);
    learned = await memoriesOfKind("learned", 8);
    wins = await forgottenWins(6);
    if (!wins.length) wins = await memoriesOfKind("win", 6);
    hardDays = await hardDaysSurvived(4);
    praise = await memoriesOfKind("praise", 5);
    const seeds = await memoriesOfKind("seed", 1);
    seed = seeds.length ? seeds[0] : null;
    loaded = true;
  });

  const isEmpty = $derived(
    loaded &&
      !survived.length &&
      !learned.length &&
      !wins.length &&
      !hardDays.length &&
      !praise.length
  );
</script>

<div class="panel">
  <div class="head">
    <span>Proof you're growing</span>
    <button class="x" onclick={onClose}>✕</button>
  </div>

  <div class="scroll">
    {#if isEmpty}
      <p class="empty">
        This page fills itself as we go.<br />
        Log a win when one happens — future you will need it.
      </p>
    {:else}
      {#if wins.length}
        <h3>🫙 Wins you forgot</h3>
        <div class="cards">
          {#each wins as m (m.id)}
            <div class="card">
              <span class="card-date">{shortDate(m.created_at)}</span>
              <span class="card-text">{m.text}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if learnedAsc.length}
        <h3>🌱 Things you learned</h3>
        <div class="timeline">
          {#each learnedAsc as m (m.id)}
            <div class="node">
              <span class="dot" aria-hidden="true"></span>
              <div class="node-body">
                <span class="date">{shortDate(m.created_at)}</span>{m.text}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if survivedAsc.length}
        <h3>🎖 Hard things you survived</h3>
        <div class="medals">
          {#each survivedAsc as m (m.id)}
            <div class="medal">
              <span class="medal-icon" aria-hidden="true">🎖️</span>
              <div class="medal-body">
                <span class="date">{shortDate(m.created_at)}</span>{m.text}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if hardDays.length}
        <h3>Hard days you got through</h3>
        {#each hardDays as m (m.id)}
          <div class="item">
            <span class="date">{shortDate(m.created_at)}</span>
            you felt {moodWord[m.mood ?? ""] ?? m.mood}{m.text ? ` — ${m.text}` : ""}. You're still here.
          </div>
        {/each}
      {/if}

      {#if praise.length}
        <h3>Things people saw in you</h3>
        {#each praise as m (m.id)}
          <div class="item praise">
            <span class="date">{shortDate(m.created_at)}</span>"{m.text}"
          </div>
        {/each}
      {/if}
    {/if}

    {#if seed}
      <h3>Where we started</h3>
      <div class="item seed">"{seed.text}" <span class="date">{shortDate(seed.created_at)}</span></div>
    {/if}
  </div>
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    max-height: 290px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(33, 28, 48, 0.96);
    border: 1px solid rgba(120, 108, 160, 0.45);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    color: #ece6f7;
    display: flex;
    flex-direction: column;
    gap: 8px;
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
  .scroll {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
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
    margin: 9px 0 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9d92bd;
  }

  /* ── Wins you forgot → little glowing cards ── */
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 7px 8px;
    border-radius: 10px;
    background: linear-gradient(155deg, rgba(240, 182, 106, 0.14), rgba(120, 100, 180, 0.1));
    border: 1px solid rgba(240, 182, 106, 0.28);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }
  .card-date {
    font-size: 9px;
    color: #f0b66a;
    letter-spacing: 0.04em;
  }
  .card-text {
    font-size: 11px;
    line-height: 1.4;
    color: #f3eefc;
  }

  /* ── Things you learned → a growth timeline ── */
  .timeline {
    position: relative;
    margin-left: 6px;
    padding-left: 12px;
    border-left: 2px solid rgba(140, 200, 150, 0.35);
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .node {
    position: relative;
  }
  .dot {
    position: absolute;
    left: -17px;
    top: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #8fd6a0;
    box-shadow: 0 0 7px rgba(143, 214, 160, 0.7);
  }
  .node-body {
    font-size: 11.5px;
    line-height: 1.45;
    color: #ddeede;
  }

  /* ── Hard things survived → medal wall ── */
  .medals {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .medal {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 10px;
    background: rgba(120, 108, 160, 0.12);
    border: 1px solid rgba(150, 130, 210, 0.3);
  }
  .medal-icon {
    font-size: 16px;
    line-height: 1.2;
    filter: drop-shadow(0 0 4px rgba(240, 182, 106, 0.45));
  }
  .medal-body {
    font-size: 11.5px;
    line-height: 1.45;
    color: #e6def5;
  }

  .item {
    font-size: 12px;
    line-height: 1.45;
    color: #ddd5ee;
    padding: 4px 0;
    border-bottom: 1px solid rgba(120, 108, 160, 0.14);
  }
  .date {
    display: inline-block;
    margin-right: 7px;
    font-size: 10px;
    color: #8d82ab;
  }
  .seed {
    font-style: italic;
  }
  .praise {
    font-style: italic;
    color: #f0cfe6;
  }
  .empty {
    font-size: 12px;
    line-height: 1.6;
    color: #b6acce;
    text-align: center;
    margin: 14px 4px;
  }
</style>
