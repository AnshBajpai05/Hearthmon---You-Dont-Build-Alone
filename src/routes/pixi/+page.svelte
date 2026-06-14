<script lang="ts">
  // V2 Phase 0 sandbox — view at http://localhost:1420/pixi (works in a plain
  // browser too; it is all pointer events + WebGL). Flip species to prove the
  // motion/interaction holds across very different sprites.
  import PixiPet from "$lib/components/PixiPet.svelte";

  const mons = [
    { id: 131, name: "Lapras" },
    { id: 25, name: "Pikachu" },
    { id: 448, name: "Lucario" },
    { id: 1, name: "Bulbasaur" },
    { id: 197, name: "Umbreon" },
    { id: 143, name: "Snorlax" }
  ];
  let i = $state(0);
  let shiny = $state(false);
  const cur = $derived(mons[i]);
</script>

<div class="sandbox">
  {#key `${cur.id}-${shiny}`}
    <PixiPet dexId={cur.id} {shiny} size={230} />
  {/key}

  <div class="hud">
    <span class="tag">V2 · Pixi parity — {cur.name}</span>
    <div class="row">
      <button onclick={() => (i = (i + mons.length - 1) % mons.length)} aria-label="Previous">‹</button>
      <button onclick={() => (i = (i + 1) % mons.length)} aria-label="Next">›</button>
      <button class:on={shiny} onclick={() => (shiny = !shiny)}>shiny</button>
    </div>
    <p class="hint">drag the pet · stroke to pet it · tap to hop · move the cursor to lean</p>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
  }
  .sandbox {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: radial-gradient(120% 100% at 50% 0%, #2a2446, #12101f 70%);
    font-family: system-ui, sans-serif;
  }
  .hud {
    position: fixed;
    left: 14px;
    bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #cfc6e8;
  }
  .tag {
    font-size: 13px;
    color: #f0b66a;
  }
  .row {
    display: flex;
    gap: 6px;
  }
  button {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(150, 130, 210, 0.4);
    background: rgba(40, 32, 58, 0.9);
    color: #ece6f7;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
  button.on {
    border-color: #f0b66a;
    color: #f0d9a6;
  }
  .hint {
    margin: 0;
    font-size: 11px;
    color: #8d82ab;
  }
</style>
