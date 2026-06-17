<script lang="ts">
  // The first five minutes. No setup wizard — a meeting.
  // One question at the end; the answer becomes our first shared memory.
  import { fade } from "svelte/transition";
  import { STARTERS, spriteUrl, fallbackUrl, type Creature } from "../sprites";

  interface Props {
    onDone: (creature: Creature, name: string, building: string, birthday: string, mode: "alive" | "classic") => void;
  }
  let { onDone }: Props = $props();

  let step = $state(0); // 0 = pick how the companion appears (Alive vs Classic), then the meeting
  let mode = $state<"alive" | "classic">("alive");
  let chosen = $state<Creature | null>(null);
  let name = $state("");
  let building = $state("");
  let birthday = $state(""); // "YYYY-MM-DD" or "" if skipped
  let failedIds = $state<Set<number>>(new Set());
  const todayISO = new Date().toISOString().slice(0, 10);

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
  {#if step === 0}
    <div in:fade={{ duration: 300 }} class="step center">
      <p class="title">How should I live on your desktop?</p>
      <p class="sub">Two looks, same companion. Pick a vibe.</p>
      <div class="modes">
        <button class="mode" class:sel={mode === "alive"} onclick={() => { mode = "alive"; step = 1; }}>
          <span class="mode-name">✦ Alive</span>
          <span class="mode-desc">a living snow-globe — premium, animated</span>
        </button>
        <button class="mode" class:sel={mode === "classic"} onclick={() => { mode = "classic"; step = 1; }}>
          <span class="mode-name">Classic</span>
          <span class="mode-desc">cozy &amp; lightweight</span>
        </button>
      </div>
      <p class="tip">You can switch anytime — click on me, then press <kbd>V</kbd>.</p>
    </div>
  {:else if step === 1}
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
      <p class="title">When's your birthday?</p>
      <p class="sub">So I can remember. Totally optional.</p>
      <input type="date" bind:value={birthday} max={todayISO} />
      <div class="row">
        <button class="ghost" onclick={() => { birthday = ""; step = 4; }}>skip</button>
        <button class="go" onclick={() => (step = 4)}>save</button>
      </div>
    </div>
  {:else if step === 4 && chosen}
    <div in:fade={{ duration: 300 }} class="step center">
      <img class="big" src={srcFor(chosen.dexId)} alt={name} onerror={() => chosen && markFailed(chosen.dexId)} />
      <p class="title">So — what are you building right now?</p>
      <textarea bind:value={building} rows="3" placeholder="anything. a project, a skill, a life…"></textarea>
      <button class="go" disabled={!building.trim()} onclick={() => chosen && onDone(chosen, name.trim(), building, birthday, mode)}>
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
  .sub {
    margin: -6px 0 2px;
    font-size: 11px;
    color: #9d92bd;
    text-align: center;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .ghost {
    padding: 9px 16px;
    border-radius: 11px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: transparent;
    color: #b6acce;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .ghost:hover {
    border-color: #8d82ab;
    color: #ece6f7;
  }
  input[type="date"] {
    width: auto;
    color-scheme: dark;
  }
  .modes {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 88%;
    margin-top: 4px;
  }
  .mode {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    cursor: pointer;
    text-align: left;
  }
  .mode:hover,
  .mode.sel {
    border-color: #f0b66a;
    background: rgba(240, 182, 106, 0.1);
  }
  .mode-name {
    font-size: 13px;
    font-weight: 700;
    color: #f0b66a;
  }
  .mode-desc {
    font-size: 11px;
    color: #9d92bd;
  }
  .tip {
    margin: 10px 2px 0;
    font-size: 11px;
    color: #8d82ab;
    text-align: center;
    line-height: 1.5;
  }
  .tip kbd {
    font-family: inherit;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 5px;
    border: 1px solid rgba(120, 108, 160, 0.5);
    background: rgba(0, 0, 0, 0.3);
    color: #ece6f7;
  }
</style>
