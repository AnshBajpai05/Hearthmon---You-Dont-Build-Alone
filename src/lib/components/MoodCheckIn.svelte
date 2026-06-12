<script lang="ts">
  import type { Mood } from "../db";

  interface Props {
    onSave: (mood: Mood, note: string) => void;
    onClose: () => void;
  }
  let { onSave, onClose }: Props = $props();

  // The doc's six — 30 seconds max, optional text, zero friction.
  const MOODS: { mood: Mood; emoji: string; label: string }[] = [
    { mood: "good", emoji: "🙂", label: "good" },
    { mood: "stressed", emoji: "😓", label: "stressed" },
    { mood: "tired", emoji: "😴", label: "tired" },
    { mood: "low", emoji: "😞", label: "low" },
    { mood: "frustrated", emoji: "😤", label: "frustrated" },
    { mood: "uncertain", emoji: "🤔", label: "uncertain" }
  ];

  let selected = $state<Mood | null>(null);
  let note = $state("");
</script>

<div class="panel">
  <div class="head">
    <span>How are we doing?</span>
    <button class="x" onclick={onClose}>✕</button>
  </div>
  <div class="grid">
    {#each MOODS as m (m.mood)}
      <button
        class="mood"
        class:selected={selected === m.mood}
        onclick={() => (selected = m.mood)}
      >
        <span class="emoji">{m.emoji}</span>
        <span class="label">{m.label}</span>
      </button>
    {/each}
  </div>
  <input type="text" placeholder="anything else? (optional)" bind:value={note} maxlength="200" />
  <button class="save" disabled={!selected} onclick={() => selected && onSave(selected, note)}>
    that's how it is
  </button>
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
    gap: 10px;
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
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .mood {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: #b6acce;
    cursor: pointer;
    font-size: 11px;
  }
  .mood:hover {
    background: rgba(255, 255, 255, 0.09);
  }
  .mood.selected {
    border-color: #f0b66a;
    background: rgba(240, 182, 106, 0.12);
    color: #f4e8d6;
  }
  .emoji {
    font-size: 19px;
  }
  input {
    padding: 7px 10px;
    border-radius: 9px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(0, 0, 0, 0.25);
    color: #ece6f7;
    font-size: 12px;
    outline: none;
  }
  input::placeholder {
    color: #7d7398;
  }
  .save {
    padding: 8px;
    border-radius: 10px;
    border: none;
    background: #f0b66a;
    color: #2b2138;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
  }
  .save:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
