<script lang="ts">
  import { onMount } from "svelte";
  import { addMemory, unreadLetter, markLetterRead, pendingCapsules, type Memory } from "../db";

  interface Props {
    petName: string;
    onClose: () => void;
  }
  let { petName, onClose }: Props = $props();

  let noteText = $state("");
  let pendingLetter = $state<Memory | null>(null);
  let waiting = $state<Memory[]>([]);
  let loaded = $state(false);
  let saved = $state(false);
  let phase = $state<"read" | "write">("write");

  // when should future-you get this back?
  const WHENS: { id: string; label: string; days: number }[] = [
    { id: "tomorrow", label: "tomorrow", days: 1 },
    { id: "week", label: "in a week", days: 7 },
    { id: "month", label: "in a month", days: 30 },
    { id: "3mo", label: "in 3 months", days: 90 },
    { id: "6mo", label: "in 6 months", days: 182 },
    { id: "year", label: "in a year", days: 365 }
  ];
  let whenId = $state("tomorrow");

  const MAX = 280;
  const remaining = $derived(MAX - noteText.length);

  function fmt(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  onMount(async () => {
    pendingLetter = await unreadLetter();
    if (pendingLetter) phase = "read";
    waiting = await pendingCapsules();
    loaded = true;
  });

  async function markRead() {
    if (!pendingLetter) return;
    await markLetterRead(pendingLetter.id);
    pendingLetter = await unreadLetter(); // another one due? keep reading
    if (!pendingLetter) {
      waiting = await pendingCapsules();
      phase = "write";
    }
  }

  async function saveNote() {
    const t = noteText.trim();
    if (!t) return;
    const days = WHENS.find((w) => w.id === whenId)?.days ?? 1;
    const open = new Date(Date.now() + days * 86_400_000);
    await addMemory("letter", { text: t, openAt: fmt(open) });
    saved = true;
    setTimeout(onClose, 1600);
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr.replace(" ", "T"));
    return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }

  function ago(dateStr: string): string {
    const days = Math.floor((Date.now() - new Date(dateStr.replace(" ", "T")).getTime()) / 86_400_000);
    if (days <= 0) return "earlier today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    const months = Math.round(days / 30);
    if (months < 12) return months === 1 ? "a month ago" : `${months} months ago`;
    const years = Math.round(months / 12);
    return years === 1 ? "a year ago" : `${years} years ago`;
  }

  function untilLabel(openAt: string): string {
    const days = Math.ceil((new Date(openAt.replace(" ", "T")).getTime() - Date.now()) / 86_400_000);
    if (days <= 1) return "opens tomorrow";
    if (days < 30) return `opens in ${days} days`;
    const months = Math.round(days / 30);
    return months <= 1 ? "opens in a month" : `opens in ${months} months`;
  }

  // a long-sealed note that just came due is a true capsule, not a next-day note
  const isCapsule = $derived(
    !!pendingLetter &&
      Date.now() - new Date((pendingLetter.created_at ?? "").replace(" ", "T")).getTime() >
        20 * 86_400_000
  );
</script>

<div class="panel" role="dialog" aria-label="Leave a note">
  <div class="head">
    <span>
      {#if phase === "read"}
        {isCapsule ? "📦 A capsule from past you" : "📬 A note from past you"}
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
      <p class="letter-from">
        You sealed this {ago(pendingLetter.created_at)} — {formatDate(pendingLetter.created_at)}:
      </p>
      <blockquote class="letter-body">"{pendingLetter.text}"</blockquote>
      <p class="letter-pet">— {petName} kept it safe.</p>
    </div>
    <button class="btn primary" onclick={markRead}>I've read it →</button>

  {:else}
    <p class="sub">Write to future-you. {petName} holds it until it's time.</p>
    <textarea
      class="note-area"
      bind:value={noteText}
      maxlength={MAX}
      placeholder="Write something for a future you…"
      rows={3}
      spellcheck="false"
    ></textarea>

    <div class="when">
      <span class="when-label">open</span>
      <div class="chips">
        {#each WHENS as w (w.id)}
          <button class="chip" class:on={whenId === w.id} onclick={() => (whenId = w.id)}>
            {w.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="row">
      <span class="count" class:warn={remaining < 30}>{remaining}</span>
      {#if saved}
        <span class="saved-tag">✓ sealed</span>
      {:else}
        <button class="btn primary" disabled={!noteText.trim()} onclick={saveNote}>
          Seal it 🫙
        </button>
      {/if}
    </div>

    {#if waiting.length}
      <p class="tip">
        🔒 {waiting.length}
        {waiting.length === 1 ? "capsule" : "capsules"} still sealed · next {untilLabel(
          waiting[0].open_at ?? ""
        )}
      </p>
    {:else}
      <p class="tip">A capsule stays hidden until its day — then {petName} brings it to you.</p>
    {/if}
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

  .when { display: flex; align-items: center; gap: 8px; }
  .when-label { font-size: 10px; color: #8d82ab; text-transform: uppercase; letter-spacing: 0.06em; }
  .chips { display: flex; gap: 4px; overflow-x: auto; flex: 1; padding-bottom: 2px; }
  .chips::-webkit-scrollbar { height: 4px; }
  .chips::-webkit-scrollbar-thumb { background: rgba(120,108,160,0.4); border-radius: 2px; }
  .chip {
    flex: 0 0 auto;
    padding: 3px 9px; border-radius: 999px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: transparent; color: #b6acce; font-size: 10px; cursor: pointer;
    white-space: nowrap;
  }
  .chip.on {
    background: rgba(180, 160, 240, 0.9); border-color: rgba(180,160,240,0.9);
    color: #221a36; font-weight: 700;
  }

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

  .tip { font-size: 10px; color: #6d6590; margin: 0; line-height: 1.5; }
</style>
