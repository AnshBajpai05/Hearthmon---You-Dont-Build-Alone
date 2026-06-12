<script lang="ts">
  import { onMount } from "svelte";
  import { memoriesOfKind, addMemory, getMeta, setMeta, type Memory } from "../db";

  interface Props {
    petName: string;
    onClose: () => void;
  }
  let { petName, onClose }: Props = $props();

  let noteText = $state("");
  let pendingLetter = $state<Memory | null>(null);
  let loaded = $state(false);
  let saved = $state(false);
  let phase = $state<"check" | "read" | "write">("check");

  const MAX = 280;
  const remaining = $derived(MAX - noteText.length);

  onMount(async () => {
    // Check if there's a letter waiting to be read today
    const lastRead = await getMeta("letter_last_read");
    const today = new Date().toDateString();

    // Fetch the most recent unread letter (kind: letter, written before today)
    const letters = await memoriesOfKind("letter" as any, 5);
    const unread = letters.find((m) => {
      const written = new Date(m.created_at.replace(" ", "T")).toDateString();
      return written !== today && written !== lastRead;
    });

    if (unread && lastRead !== new Date(unread.created_at.replace(" ", "T")).toDateString()) {
      pendingLetter = unread;
      phase = "read";
    } else {
      phase = "write";
    }
    loaded = true;
  });

  async function markRead() {
    if (!pendingLetter) return;
    const written = new Date(pendingLetter.created_at.replace(" ", "T")).toDateString();
    await setMeta("letter_last_read", written);
    pendingLetter = null;
    phase = "write";
  }

  async function saveNote() {
    const t = noteText.trim();
    if (!t) return;
    await addMemory("letter" as any, { text: t });
    saved = true;
    setTimeout(onClose, 1800);
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
    <!-- Reading the old letter -->
    <div class="letter-card">
      <p class="letter-from">You wrote this on {formatDate(pendingLetter.created_at)}:</p>
      <blockquote class="letter-body">"{pendingLetter.text}"</blockquote>
      <p class="letter-pet">— {petName} kept it safe.</p>
    </div>
    <button class="btn primary" onclick={markRead}>Okay, I've read it →</button>

  {:else if phase === "write"}
    <!-- Writing a new letter -->
    <p class="sub">{petName} will read it back to you tomorrow.</p>
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
        <button
          class="btn primary"
          disabled={!noteText.trim()}
          onclick={saveNote}
        >Seal & leave 🫙</button>
      {/if}
    </div>
    <p class="tip">
      Tomorrow, open this panel — {petName} will read it back before you can write a new one.
    </p>
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
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 12px;
    padding: 0;
  }
  .x:hover { color: #c4b5f0; }

  .hint, .sub {
    font-size: 11.5px;
    color: #9d92bd;
    margin: 0;
    line-height: 1.5;
  }

  /* ---- Reading a past letter ---- */
  .letter-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(80, 60, 120, 0.3);
    border: 1px solid rgba(180, 160, 240, 0.25);
  }
  .letter-from {
    font-size: 10px;
    color: #8d82ab;
    margin: 0;
    font-style: italic;
  }
  .letter-body {
    font-size: 13px;
    color: #e8e0f8;
    line-height: 1.55;
    margin: 4px 0;
    padding-left: 10px;
    border-left: 2px solid rgba(180, 160, 240, 0.4);
    font-style: italic;
  }
  .letter-pet {
    font-size: 10.5px;
    color: #7a7098;
    margin: 0;
    text-align: right;
  }

  /* ---- Writing ---- */
  .note-area {
    width: 100%;
    box-sizing: border-box;
    resize: none;
    background: rgba(50, 42, 72, 0.6);
    border: 1px solid rgba(120, 108, 160, 0.35);
    border-radius: 10px;
    color: #e8e0f8;
    font-size: 12.5px;
    line-height: 1.55;
    padding: 9px 11px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }
  .note-area:focus {
    border-color: rgba(180, 160, 240, 0.5);
  }
  .note-area::placeholder {
    color: #5d5580;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .count {
    font-size: 10px;
    color: #5d5580;
  }
  .count.warn {
    color: #e3884a;
  }
  .saved-tag {
    font-size: 12px;
    color: #7ac97a;
    font-weight: 600;
  }

  .btn {
    background: none;
    border: 1px solid rgba(120, 108, 160, 0.4);
    border-radius: 20px;
    color: #c4b5f0;
    font-size: 11.5px;
    cursor: pointer;
    padding: 5px 14px;
    font-family: inherit;
    transition: background 0.18s, border-color 0.18s;
  }
  .btn:hover:not(:disabled) {
    background: rgba(80, 60, 120, 0.4);
    border-color: rgba(180, 160, 240, 0.5);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn.primary {
    border-color: rgba(180, 160, 240, 0.5);
    color: #e8e0f8;
    background: rgba(80, 60, 120, 0.3);
  }
  .btn.primary:hover:not(:disabled) {
    background: rgba(100, 80, 150, 0.5);
  }

  .tip {
    font-size: 10px;
    color: #4d4570;
    margin: 0;
    line-height: 1.5;
  }
</style>
