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
  let seed = $state<Memory | null>(null);
  let loaded = $state(false);

  const moodWord: Record<string, string> = {
    low: "low",
    stressed: "stressed",
    frustrated: "frustrated"
  };

  onMount(async () => {
    survived = await memoriesOfKind("survived", 5);
    learned = await memoriesOfKind("learned", 5);
    wins = await forgottenWins(4);
    if (!wins.length) wins = await memoriesOfKind("win", 4);
    hardDays = await hardDaysSurvived(4);
    const seeds = await memoriesOfKind("seed", 1);
    seed = seeds.length ? seeds[0] : null;
    loaded = true;
  });

  const isEmpty = $derived(
    loaded && !survived.length && !learned.length && !wins.length && !hardDays.length
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
      {#if survived.length}
        <h3>Things we survived</h3>
        {#each survived as m (m.id)}
          <div class="item"><span class="date">{shortDate(m.created_at)}</span>{m.text}</div>
        {/each}
      {/if}

      {#if learned.length}
        <h3>Things you learned</h3>
        {#each learned as m (m.id)}
          <div class="item"><span class="date">{shortDate(m.created_at)}</span>{m.text}</div>
        {/each}
      {/if}

      {#if wins.length}
        <h3>Wins you forgot</h3>
        {#each wins as m (m.id)}
          <div class="item"><span class="date">{shortDate(m.created_at)}</span>{m.text}</div>
        {/each}
      {/if}

      {#if hardDays.length}
        <h3>Hard days you survived</h3>
        {#each hardDays as m (m.id)}
          <div class="item">
            <span class="date">{shortDate(m.created_at)}</span>
            you felt {moodWord[m.mood ?? ""] ?? m.mood}{m.text ? ` — ${m.text}` : ""}. You're still here.
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
    margin: 8px 0 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9d92bd;
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
  .empty {
    font-size: 12px;
    line-height: 1.6;
    color: #b6acce;
    text-align: center;
    margin: 14px 4px;
  }
</style>
