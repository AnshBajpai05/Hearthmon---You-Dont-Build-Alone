<script lang="ts">
  import {
    STARTERS,
    POKEDEX,
    filterDex,
    randomEntry,
    thumbUrl,
    displayName,
    GENERATIONS,
    type DexEntry
  } from "../sprites";
  import { TYPE_FX } from "../attackfx";

  interface Props {
    currentDexId: number;
    currentName: string;
    autoMinutes: number;
    autoMode?: "random" | "evolve";
    canEvolve?: boolean;
    onPick: (entry: DexEntry, name: string) => void;
    onAutoSave: (minutes: number, mode: "random" | "evolve") => void;
    onSaveName: (name: string) => void;
    onClose: () => void;
  }
  let {
    currentDexId,
    currentName,
    autoMinutes,
    autoMode = "random",
    canEvolve = false,
    onPick,
    onAutoSave,
    onSaveName,
    onClose
  }: Props = $props();

  let name = $state("");
  let query = $state("");
  let selType = $state("");
  let selGen = $state(0);
  let autoOn = $state(false);
  let autoMins = $state(60);
  let mode = $state<"random" | "evolve">("random");
  // Sync local state from props on mount (avoids state_referenced_locally warnings)
  $effect(() => {
    name = currentName;
    autoOn = autoMinutes > 0;
    autoMins = autoMinutes > 0 ? autoMinutes : 60;
    mode = autoMode;
  });

  const suggested: DexEntry[] = STARTERS.map(
    (s) => POKEDEX.find((e) => e.id === s.dexId)!
  ).filter(Boolean);

  const TYPES = Object.keys(TYPE_FX);
  const filtering = $derived(Boolean(query.trim() || selType || selGen));
  const results = $derived(
    filtering ? filterDex({ query, type: selType || undefined, gen: selGen || undefined }) : suggested
  );
  const current = POKEDEX.find((e) => e.id === currentDexId);

  /** Random respects the active filters — "surprise me, but make it a fire type". */
  function pickRandom() {
    if (filtering) {
      const pool = filterDex({
        query,
        type: selType || undefined,
        gen: selGen || undefined,
        limit: 2000
      }).filter((e) => e.id !== currentDexId);
      if (pool.length) {
        onPick(pool[Math.floor(Math.random() * pool.length)], name.trim());
        return;
      }
    }
    onPick(randomEntry(currentDexId), name.trim());
  }

  function saveAuto() {
    const mins = autoOn ? Math.max(1, Math.floor(autoMins) || 60) : 0;
    onAutoSave(mins, mode);
  }
</script>

<div class="panel">
  <div class="head">
    <span>Switch form</span>
    <button class="x" onclick={onClose}>✕</button>
  </div>
  {#if current}
    <p class="whoami">
      {currentName}
      {#if displayName(current.name) !== currentName}— {displayName(current.name)}{/if}
      <span class="ctype">· {current.type}</span>
    </p>
  {/if}

  <div class="searchrow">
    <input
      class="search"
      type="text"
      placeholder="search all {POKEDEX.length} pokémon…"
      bind:value={query}
    />
    <button class="dice" title="Surprise me (respects filters)" onclick={pickRandom}>🎲</button>
  </div>

  <div class="chips types">
    {#each TYPES as t (t)}
      <button
        class="tchip"
        class:on={selType === t}
        style="--tc: {TYPE_FX[t].color}"
        onclick={() => (selType = selType === t ? "" : t)}>{t}</button
      >
    {/each}
  </div>
  <div class="chips gens">
    {#each GENERATIONS as _g, i (i)}
      <button class="gchip" class:on={selGen === i + 1} onclick={() => (selGen = selGen === i + 1 ? 0 : i + 1)}
        >G{i + 1}</button
      >
    {/each}
  </div>

  <div class="grid" class:empty={!results.length}>
    {#each results as e (e.id)}
      <button
        class="starter"
        class:current={e.id === currentDexId}
        disabled={e.id === currentDexId}
        onclick={() => onPick(e, name.trim())}
      >
        <img src={thumbUrl(e.id)} alt={displayName(e.name)} loading="lazy" />
        <span class="name">{displayName(e.name)}</span>
        <span class="vibe">{e.id === currentDexId ? "that's me" : e.type}</span>
      </button>
    {:else}
      <p class="nores">no one by that name yet</p>
    {/each}
  </div>

  <div class="autorow">
    <label class="autotoggle">
      <input type="checkbox" bind:checked={autoOn} onchange={saveAuto} />
      auto every
    </label>
    <input
      class="mins"
      type="number"
      min="1"
      max="10080"
      bind:value={autoMins}
      onchange={saveAuto}
      disabled={!autoOn}
    />
    <span class="unit">min</span>
  </div>
  {#if autoOn}
    <div class="modes">
      <button class="mchip" class:on={mode === "random"} onclick={() => { mode = "random"; saveAuto(); }}>
        🎲 random
      </button>
      <button
        class="mchip"
        class:on={mode === "evolve"}
        disabled={!canEvolve}
        title={canEvolve ? "Grow through the evolution chain over the interval" : "This form has no evolution"}
        onclick={() => { mode = "evolve"; saveAuto(); }}
      >
        ✦ grow
      </button>
    </div>
    {#if mode === "evolve" && canEvolve}
      <p class="autonote">Splits the interval evenly across the whole evolution line.</p>
    {/if}
  {/if}

  <div class="namerow">
    <input
      class="namebox"
      type="text"
      bind:value={name}
      maxlength="20"
      placeholder="nickname"
      title="Give your companion a nickname"
      onkeydown={(e) => { if (e.key === 'Enter') onSaveName(name.trim() || currentName); }}
    />
    <button
      class="savename"
      onclick={() => onSaveName(name.trim() || currentName)}
      title="Save nickname"
    >Save</button>
  </div>
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
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
    color: #c9bfe2;
  }
  .x {
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 12px;
  }
  .whoami {
    margin: -2px 0 0;
    font-size: 11px;
    color: #c9bfe2;
    text-align: center;
  }
  .ctype {
    color: #8d82ab;
  }
  .searchrow {
    display: flex;
    gap: 6px;
  }
  .chips {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: thin;
  }
  .chips::-webkit-scrollbar {
    height: 4px;
  }
  .chips::-webkit-scrollbar-thumb {
    background: rgba(120, 108, 160, 0.4);
    border-radius: 2px;
  }
  .tchip {
    flex: 0 0 auto;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--tc);
    background: transparent;
    color: var(--tc);
    font-size: 9.5px;
    cursor: pointer;
    text-transform: capitalize;
  }
  .tchip.on {
    background: var(--tc);
    color: #1d1830;
    font-weight: 700;
  }
  .gchip {
    flex: 0 0 auto;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid rgba(120, 108, 160, 0.45);
    background: transparent;
    color: #b6acce;
    font-size: 9.5px;
    cursor: pointer;
  }
  .gchip.on {
    background: #f0b66a;
    border-color: #f0b66a;
    color: #2b2138;
    font-weight: 700;
  }
  .search {
    flex: 1;
    padding: 7px 10px;
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(0, 0, 0, 0.25);
    color: #ece6f7;
    font-size: 12px;
    outline: none;
  }
  .search::placeholder {
    color: #7d7398;
  }
  .dice {
    width: 32px;
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(255, 255, 255, 0.05);
    cursor: pointer;
    font-size: 14px;
  }
  .dice:hover {
    border-color: #f0b66a;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    max-height: 158px;
    overflow-y: auto;
    padding-right: 3px;
  }
  .grid.empty {
    display: block;
  }
  .grid::-webkit-scrollbar {
    width: 5px;
  }
  .grid::-webkit-scrollbar-thumb {
    background: rgba(120, 108, 160, 0.4);
    border-radius: 3px;
  }
  .nores {
    margin: 12px 0;
    font-size: 11px;
    color: #9d92bd;
    text-align: center;
  }
  .starter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 6px 2px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    color: inherit;
  }
  .starter:hover:not(:disabled) {
    border-color: #f0b66a;
    background: rgba(240, 182, 106, 0.1);
  }
  .starter.current {
    opacity: 0.45;
    cursor: default;
    border-color: rgba(120, 108, 160, 0.4);
  }
  .starter img {
    width: 40px;
    height: 40px;
    object-fit: contain;
    image-rendering: pixelated;
  }
  .name {
    font-size: 10px;
    font-weight: 600;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .vibe {
    font-size: 8.5px;
    color: #9d92bd;
  }
  .autorow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #b6acce;
  }
  .autotoggle {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
  }
  .autotoggle input {
    accent-color: #f0b66a;
  }
  .modes {
    display: flex;
    gap: 6px;
  }
  .mchip {
    flex: 1;
    padding: 4px 0;
    border-radius: 8px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: transparent;
    color: #b6acce;
    font-size: 11px;
    cursor: pointer;
  }
  .mchip.on {
    background: rgba(240, 182, 106, 0.15);
    border-color: #f0b66a;
    color: #f4e8d6;
    font-weight: 600;
  }
  .mchip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .autonote {
    margin: 0;
    font-size: 9.5px;
    color: #8d82ab;
    text-align: center;
  }
  .mins {
    width: 52px;
    padding: 4px 6px;
    border-radius: 7px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(0, 0, 0, 0.25);
    color: #ece6f7;
    font-size: 11px;
    outline: none;
  }
  .mins:disabled {
    opacity: 0.4;
  }
  .unit {
    color: #8d82ab;
  }
  .namebox {
    flex: 1;
    padding: 6px 10px;
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(0, 0, 0, 0.25);
    color: #ece6f7;
    font-size: 12px;
    outline: none;
    text-align: center;
  }
  .namebox::placeholder {
    color: #7d7398;
  }
  .namerow {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .savename {
    padding: 6px 12px;
    border-radius: 9px;
    border: 1px solid #f0b66a;
    background: rgba(240, 182, 106, 0.15);
    color: #f4e8d6;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .savename:hover {
    background: rgba(240, 182, 106, 0.32);
  }
</style>
