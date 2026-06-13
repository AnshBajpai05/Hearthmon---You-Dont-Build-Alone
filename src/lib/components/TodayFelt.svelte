<script lang="ts">
  // "Today felt like…" — a one-tap nightly emotion word, lighter than the 6-emoji
  // mood check-in. One word, no note, no friction. Feeds the same mood timeline.
  interface Props {
    onPick: (word: string) => void;
    onClose: () => void;
  }
  let { onPick, onClose }: Props = $props();

  const words = ["good", "hopeful", "peaceful", "messy", "strange", "heavy", "hard"];
</script>

<div class="panel">
  <div class="head">
    <span>Today felt like…</span>
    <button class="x" onclick={onClose} aria-label="Close">✕</button>
  </div>
  <p class="blurb">One word. No need to explain.</p>
  <div class="chips">
    {#each words as w (w)}
      <button class="chip" onclick={() => onPick(w)}>{w}</button>
    {/each}
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
    gap: 9px;
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
  .blurb {
    margin: 0;
    font-size: 11.5px;
    color: #b6acce;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .chip {
    padding: 7px 13px;
    border-radius: 999px;
    border: 1px solid rgba(150, 130, 210, 0.4);
    background: rgba(120, 100, 180, 0.14);
    color: #e7dffb;
    font-size: 12.5px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.16s, border-color 0.16s, transform 0.12s;
  }
  .chip:hover {
    background: rgba(150, 130, 210, 0.28);
    border-color: #f0b66a;
    transform: translateY(-1px);
  }
  .chip:active {
    transform: scale(0.95);
  }
</style>
