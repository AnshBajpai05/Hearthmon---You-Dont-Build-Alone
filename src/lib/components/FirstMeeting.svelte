<script lang="ts">
  // The first five minutes. No setup wizard — a meeting.
  // One question at the end; the answer becomes our first shared memory.
  import { fade } from "svelte/transition";
  import { STARTERS, spriteUrl, fallbackUrl, type Creature } from "../sprites";

  interface Props {
    onDone: (creature: Creature, name: string, building: string) => void;
  }
  let { onDone }: Props = $props();

  let step = $state(1);
  let chosen = $state<Creature | null>(null);
  let name = $state("");
  let building = $state("");
  let failedIds = $state<Set<number>>(new Set());

  function srcFor(dexId: number): string {
    return failedIds.has(dexId) ? fallbackUrl(dexId) : spriteUrl(dexId);
  }
  function markFailed(dexId: number) {
    failedIds = new Set([...failedIds, dexId]);
  }
  function choose(c: Creature) {
    chosen = c;
    name = c.name;
    step = 2;
  }
</script>

<div class="card">
  {#if step === 1}
    <div in:fade={{ duration: 300 }} class="step">
      <p class="title">Someone wants to meet you.</p>
      <div class="grid">
        {#each STARTERS as c (c.id)}
          <button class="starter" onclick={() => choose(c)}>
            <img src={srcFor(c.dexId)} alt={c.name} onerror={() => markFailed(c.dexId)} />
            <span class="name">{c.name}</span>
            <span class="vibe">{c.vibe}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if step === 2 && chosen}
    <div in:fade={{ duration: 300 }} class="step center">
      <img class="big" src={srcFor(chosen.dexId)} alt={chosen.name} onerror={() => chosen && markFailed(chosen.dexId)} />
      <p class="title">What should you call me?</p>
      <input type="text" bind:value={name} maxlength="20" />
      <button class="go" disabled={!name.trim()} onclick={() => (step = 3)}>that's you</button>
    </div>
  {:else if step === 3 && chosen}
    <div in:fade={{ duration: 300 }} class="step center">
      <img class="big" src={srcFor(chosen.dexId)} alt={name} onerror={() => chosen && markFailed(chosen.dexId)} />
      <p class="title">So — what are you building right now?</p>
      <textarea bind:value={building} rows="3" placeholder="anything. a project, a skill, a life…"></textarea>
      <button class="go" disabled={!building.trim()} onclick={() => chosen && onDone(chosen, name.trim(), building)}>
        we build it together
      </button>
    </div>
  {/if}
</div>

<style>
  .card {
    position: absolute;
    inset: 8px;
    border-radius: 18px;
    background: rgba(33, 28, 48, 0.97);
    border: 1px solid rgba(120, 108, 160, 0.45);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    color: #ece6f7;
    padding: 16px 14px;
    overflow-y: auto;
  }
  .step {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .center {
    align-items: center;
    text-align: center;
    margin-top: 26px;
  }
  .title {
    margin: 2px 0;
    font-size: 14px;
    color: #f0b66a;
    text-align: center;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .starter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 4px;
    border-radius: 12px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    color: inherit;
  }
  .starter:hover {
    border-color: #f0b66a;
    background: rgba(240, 182, 106, 0.1);
  }
  .starter img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .name {
    font-size: 12px;
    font-weight: 600;
  }
  .vibe {
    font-size: 10px;
    color: #9d92bd;
  }
  .big {
    width: 96px;
    height: 96px;
    object-fit: contain;
    image-rendering: pixelated;
  }
  input,
  textarea {
    width: 85%;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(0, 0, 0, 0.25);
    color: #ece6f7;
    font-size: 13px;
    outline: none;
    text-align: center;
    font-family: inherit;
    resize: none;
  }
  textarea {
    text-align: left;
  }
  textarea::placeholder,
  input::placeholder {
    color: #7d7398;
  }
  .go {
    padding: 9px 18px;
    border-radius: 11px;
    border: none;
    background: #f0b66a;
    color: #2b2138;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .go:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
