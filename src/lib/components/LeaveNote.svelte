<script lang="ts">
  import { onMount } from "svelte";
  import { addMemory, getMeta, setMeta, unreadLetter, type Memory } from "../db";

  interface Props {
    petName: string;
    onClose: () => void;
  }
  let { petName, onClose }: Props = $props();

  let noteText = $state("");
  let pendingLetter = $state<Memory | null>(null);
  let loaded = $state(false);
  let saved = $state(false);
  let phase = $state<"read" | "write">("write");

  const MAX = 280;
  const remaining = $derived(MAX - noteText.length);

  onMount(async () => {
    // ID-based tracking: never show the same letter twice, even if multiple exist
    const lastReadId = Number((await getMeta("letter_last_read_id")) ?? 0);
    const letter = await unreadLetter(lastReadId);
    if (letter) {
      pendingLetter = letter;
      phase = "read";
    }
    loaded = true;
  });

  async function markRead() {
    if (!pendingLetter) return;
    await setMeta("letter_last_read_id", String(pendingLetter.id));
    pendingLetter = null;
    phase = "write";
  }

  async function saveNote() {
    const t = noteText.trim();
    if (!t) return;
    await addMemory("letter", { text: t });
    saved = true;
    setTimeout(onClose, 1600);
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr.replace(" ", "T"));
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }
</script>

<div class="panel" role="dialog" aria-label="Leave a note">
  <div class="head">
    <span>
      {#if phase === "read"}
        📬 A note from past you
      {:else}
        ✉️ Leave a note
      {/if}
    </span>
    <button class="x" onclick={onClose}>✕</button>
  </div>

  {#if !loaded}
    <p class="hint">…</p>

  {:else if phase === "read" && pendingLetter}
    <div class="letter-card">
      <p class="letter-from">You wrote this on {formatDate(pendingLetter.created_at)}:</p>
      <blockquote class="letter-body">"{pendingLetter.text}"</blockquote>
      <p class="letter-pet">— {petName} kept it safe.</p>
    </div>
    <button class="btn primary" onclick={markRead}>I've read it →</button>

  {:else}
    <p class="sub">{petName} will hold it until tomorrow.</p>
    <textarea
      class="note-area"
      bind:value={noteText}
      maxlength={MAX}
      placeholder="Write something for tomorrow-you…"
      rows={4}
      spellcheck="false"
    ></textarea>
    <div class="row">
      <span class="count" class:warn={remaining < 30}>{remaining}</span>
      {#if saved}
        <span class="saved-tag">✓ sealed</span>
      {:else}
        <button class="btn primary" disabled={!noteText.trim()} onclick={saveNote}>
          Seal & leave 🫙
        </button>
      {/if}
    </div>
    <p class="tip">Next time you open this, {petName} will read it back before you can write a new one.</p>
  {/if}
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    padding: 12px 14px 10px;
    border-radius: 18px;
    background: rgba(30, 24, 46, 0.97);
    border: 1px solid rgba(180, 160, 240, 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
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
    font-weight: 600;
    color: #c4b5f0;
  }
  .x {
    background: none; border: none; color: #8d82ab; cursor: pointer; font-size: 12px; padding: 0;
  }
  .x:hover { color: #c4b5f0; }
  .hint, .sub { font-size: 11.5px; color: #9d92bd; margin: 0; line-height: 1.5; }

  .letter-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(80, 60, 120, 0.3);
    border: 1px solid rgba(180, 160, 240, 0.25);
    animation: letteropen 0.4s cubic-bezier(0.34, 1.3, 0.64, 1);
  }
  @keyframes letteropen {
    from { opacity: 0; transform: translateY(8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .letter-from { font-size: 10px; color: #8d82ab; margin: 0; font-style: italic; }
  .letter-body {
    font-size: 13px; color: #e8e0f8; line-height: 1.6; margin: 4px 0;
    padding-left: 10px; border-left: 2px solid rgba(180,160,240,0.4); font-style: italic;
  }
  .letter-pet { font-size: 10.5px; color: #7a7098; margin: 0; text-align: right; }

  .note-area {
    width: 100%; box-sizing: border-box; resize: none;
    background: rgba(50, 42, 72, 0.6);
    border: 1px solid rgba(120, 108, 160, 0.35);
    border-radius: 10px; color: #e8e0f8; font-size: 12.5px;
    line-height: 1.55; padding: 9px 11px; font-family: inherit; outline: none;
    transition: border-color 0.2s;
  }
  .note-area:focus { border-color: rgba(180, 160, 240, 0.5); }
  .note-area::placeholder { color: #5d5580; }

  .row { display: flex; justify-content: space-between; align-items: center; }
  .count { font-size: 10px; color: #5d5580; }
  .count.warn { color: #e3884a; }
  .saved-tag { font-size: 12px; color: #7ac97a; font-weight: 600; }

  .btn {
    background: none; border: 1px solid rgba(120, 108, 160, 0.4); border-radius: 20px;
    color: #c4b5f0; font-size: 11.5px; cursor: pointer; padding: 5px 14px;
    font-family: inherit; transition: background 0.18s, border-color 0.18s;
  }
  .btn:hover:not(:disabled) { background: rgba(80, 60, 120, 0.4); border-color: rgba(180,160,240,0.5); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.primary {
    border-color: rgba(180, 160, 240, 0.5); color: #e8e0f8;
    background: rgba(80, 60, 120, 0.3);
  }
  .btn.primary:hover:not(:disabled) { background: rgba(100, 80, 150, 0.5); }

  .tip { font-size: 10px; color: #4d4570; margin: 0; line-height: 1.5; }
</style>
