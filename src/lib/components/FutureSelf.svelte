<script lang="ts">
  // Future-Self mode — a grounded message from the version of you that already
  // got through this, built only from real logged resilience + wins. Plus an
  // Emotional Time Machine: an old worry you've since outlived. Never fortune-
  // telling, never toxic positivity — just evidence you're more durable than now feels.
  import { onMount } from "svelte";
  import {
    memoriesOfKind,
    forgottenWins,
    hardDaysSurvived,
    getMeta,
    type Memory
  } from "../db";
  import { daysTogether } from "../bond";
  import { shortDate } from "../lines";

  interface Props {
    petName: string;
    onClose: () => void;
  }
  let { petName, onClose }: Props = $props();

  let message = $state("");
  let past = $state<Memory | null>(null);
  let loaded = $state(false);
  let empty = $state(false);

  const moodWord: Record<string, string> = {
    low: "low", stressed: "stressed", frustrated: "frustrated"
  };

  function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

  onMount(async () => {
    const days = daysTogether(await getMeta("first_met"));
    const survived = await memoriesOfKind("survived", 12);
    let wins = await forgottenWins(8);
    if (!wins.length) wins = await memoriesOfKind("win", 8);
    const hard = await hardDaysSurvived(8);

    // grounded composition — counts + one concrete callback, no promises
    const parts: string[] = ["Future you, looking back at right now:"];
    if (survived.length)
      parts.push(`you got through ${survived.length} hard thing${survived.length === 1 ? "" : "s"} you bothered to write down.`);
    if (wins.length)
      parts.push(`you stacked ${wins.length} win${wins.length === 1 ? "" : "s"}, even the small ones.`);
    if (survived.length) {
      const s = pick(survived);
      if (s.text) parts.push(`You'll still remember getting past "${s.text}".`);
    } else if (wins.length) {
      const w = pick(wins);
      if (w.text) parts.push(`"${w.text}" — that one mattered more than it felt like.`);
    }
    parts.push(
      days >= 30
        ? "You kept showing up this long. You'll be glad you didn't stop."
        : "You're just starting — and you already showed up. That's the hard part."
    );
    message = parts.join(" ");

    // time machine — an old worry you've since outlived
    past = hard.length ? pick(hard) : null;

    loaded = true;
    empty = !survived.length && !wins.length && !hard.length;
  });
</script>

<div class="panel">
  <div class="head">
    <span>🔮 Future you</span>
    <button class="x" onclick={onClose} aria-label="Close">✕</button>
  </div>

  <div class="scroll">
    {#if loaded && empty}
      <p class="empty">
        Once you've logged a few wins and hard days,<br />
        future-you will have something to say back.
      </p>
    {:else if loaded}
      <div class="future">{message}</div>

      {#if past}
        <h3>Looking back</h3>
        <div class="machine">
          <span class="date">{shortDate(past.created_at)}</span>
          You felt {moodWord[past.mood ?? ""] ?? past.mood}{past.text ? ` — “${past.text}”` : ""}.
          <em>And here you are.</em>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .panel {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    max-height: 300px;
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
    color: #f0b66a;
  }
  .x {
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 12px;
  }
  .scroll {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-right: 4px;
  }
  .scroll::-webkit-scrollbar { width: 5px; }
  .scroll::-webkit-scrollbar-thumb { background: rgba(120, 108, 160, 0.4); border-radius: 3px; }
  .future {
    font-size: 12.5px;
    line-height: 1.6;
    color: #ece6f7;
    background: linear-gradient(155deg, rgba(150, 130, 210, 0.16), rgba(240, 182, 106, 0.08));
    border: 1px solid rgba(150, 130, 210, 0.32);
    border-radius: 12px;
    padding: 11px 12px;
  }
  h3 {
    margin: 8px 0 2px;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #9d92bd;
  }
  .machine {
    font-size: 12px;
    line-height: 1.5;
    color: #ddd5ee;
    border-left: 2px solid rgba(150, 130, 210, 0.5);
    padding: 2px 0 2px 10px;
  }
  .machine em {
    color: #f0b66a;
    font-style: normal;
  }
  .date {
    display: inline-block;
    margin-right: 6px;
    font-size: 10px;
    color: #8d82ab;
  }
  .empty {
    font-size: 12px;
    line-height: 1.6;
    color: #b6acce;
    text-align: center;
    margin: 16px 4px;
  }
</style>
