<script lang="ts">
  // The Vault — for the worst days. One tap gathers the truest evidence we have:
  // something you survived, something someone saw in you, a win, a good day,
  // a note from past-you, where it all started. Gentle, never triumphant.
  import { onMount } from "svelte";
  import { allMemories, type Memory } from "../db";
  import { shortDate } from "../lines";

  interface Props {
    petName: string;
    onClose: () => void;
  }
  let { petName, onClose }: Props = $props();

  interface Card {
    label: string;
    icon: string;
    text: string;
    date: string;
  }

  let cards = $state<Card[]>([]);
  let loaded = $state(false);
  let revealed = $state(0);

  const rand = <T,>(a: T[]): T | null => (a.length ? a[Math.floor(Math.random() * a.length)] : null);

  function card(label: string, icon: string, m: Memory | null, fallbackText?: string): Card | null {
    if (!m && !fallbackText) return null;
    return {
      label,
      icon,
      text: m?.text ?? fallbackText ?? "",
      date: m ? shortDate(m.created_at) : ""
    };
  }

  onMount(async () => {
    const all = await allMemories(500);
    const of = (k: Memory["kind"]) => all.filter((m) => m.kind === k);
    const goodDays = all.filter((m) => m.kind === "mood" && m.mood === "good");

    const built: (Card | null)[] = [
      card("You've survived harder", "⛰", rand(of("survived"))),
      card("Someone saw this in you", "💬", rand(of("praise"))),
      card("You did this", "✦", rand(of("win"))),
      card("A good day — they're real", "💛", rand(goodDays), "There was a day that felt good."),
      card("Past you left this", "✉️", rand(of("letter"))),
      card("Where it all started", "🌱", rand(of("seed")))
    ];
    cards = built.filter((c): c is Card => c !== null && c.text.trim() !== "");
    loaded = true;

    // reveal gently, one at a time
    for (let i = 1; i <= cards.length; i++) setTimeout(() => (revealed = i), 250 + i * 260);
  });
</script>

<div class="panel" role="dialog" aria-label="The Vault">
  <div class="head">
    <span>🫂 When it feels like too much</span>
    <button class="x" onclick={onClose}>✕</button>
  </div>

  {#if !loaded}
    <p class="intro">…gathering what's true…</p>
  {:else if !cards.length}
    <p class="intro">
      The Vault fills as we go — wins, kind words, hard things survived.<br />
      For now: you're here, and that counted today.
    </p>
  {:else}
    <p class="intro">Breathe. None of this has to be fixed tonight. But all of it is true:</p>
    <div class="cards">
      {#each cards as c, i (c.label)}
        <div class="card" class:visible={revealed > i}>
          <span class="card-icon">{c.icon}</span>
          <div class="card-body">
            <span class="card-label">{c.label}</span>
            <p class="card-text">{c.text}</p>
            {#if c.date}<span class="card-date">{c.date}</span>{/if}
          </div>
        </div>
      {/each}
    </div>
    <p class="foot">{petName} is right here. We'll get through tonight.</p>
  {/if}
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    max-height: 300px;
    padding: 12px 14px 10px;
    border-radius: 18px;
    background: rgba(30, 24, 42, 0.98);
    border: 1px solid rgba(240, 180, 130, 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
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
    font-weight: 600;
    color: #f0b682;
  }
  .x {
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 12px;
    padding: 0;
  }
  .x:hover {
    color: #f0b682;
  }
  .intro {
    font-size: 11.5px;
    color: #c9bfe2;
    margin: 0;
    line-height: 1.55;
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 7px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .cards::-webkit-scrollbar {
    width: 5px;
  }
  .cards::-webkit-scrollbar-thumb {
    background: rgba(120, 108, 160, 0.4);
    border-radius: 3px;
  }
  .card {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(54, 42, 60, 0.6);
    border: 1px solid rgba(240, 180, 130, 0.18);
    opacity: 0;
    transform: translateY(10px) scale(0.98);
    transition:
      opacity 0.4s cubic-bezier(0.34, 1.2, 0.64, 1),
      transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1);
  }
  .card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  .card-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .card-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .card-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #f0b682;
    opacity: 0.85;
  }
  .card-text {
    font-size: 12px;
    line-height: 1.45;
    color: #e4dcf0;
    margin: 0;
    word-break: break-word;
  }
  .card-date {
    font-size: 9.5px;
    color: #7a7098;
    margin-top: 1px;
  }
  .foot {
    font-size: 10.5px;
    color: #8a7fa6;
    text-align: center;
    margin: 0;
  }
</style>
