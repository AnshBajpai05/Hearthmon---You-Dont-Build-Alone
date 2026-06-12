<script lang="ts">
  import type { MemoryKind } from "../db";

  interface Props {
    onSave: (kind: MemoryKind, text: string) => void;
    onClose: () => void;
  }
  let { onSave, onClose }: Props = $props();

  const KINDS: { kind: MemoryKind; icon: string; label: string }[] = [
    { kind: "win", icon: "✦", label: "a win" },
    { kind: "learned", icon: "📘", label: "learned" },
    { kind: "survived", icon: "⛰", label: "survived" }
  ];

  let kind = $state<MemoryKind>("win");
  let text = $state("");
</script>

<div class="panel">
  <div class="head">
    <span>For the record…</span>
    <button class="x" onclick={onClose}>✕</button>
  </div>
  <div class="chips">
    {#each KINDS as k (k.kind)}
      <button class="chip" class:selected={kind === k.kind} onclick={() => (kind = k.kind)}>
        {k.icon} {k.label}
      </button>
    {/each}
  </div>
  <input
    type="text"
    placeholder={kind === "win"
      ? "what happened?"
      : kind === "learned"
        ? "what did you learn?"
        : "what did you get through?"}
    bind:value={text}
    maxlength="200"
    onkeydown={(e) => e.key === "Enter" && text.trim() && onSave(kind, text.trim())}
  />
  <button class="save" disabled={!text.trim()} onclick={() => onSave(kind, text.trim())}>
    remember this
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
  .chips {
    display: flex;
    gap: 6px;
  }
  .chip {
    flex: 1;
    padding: 7px 4px;
    border-radius: 9px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: #b6acce;
    cursor: pointer;
    font-size: 11px;
  }
  .chip:hover {
    background: rgba(255, 255, 255, 0.09);
  }
  .chip.selected {
    border-color: #f0b66a;
    background: rgba(240, 182, 106, 0.12);
    color: #f4e8d6;
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
