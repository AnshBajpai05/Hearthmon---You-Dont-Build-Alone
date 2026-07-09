<script lang="ts">
  // GitHub Showcase — a clean, screenshot-friendly "card" of your coding journey
  // alongside your companion. Built to share with recruiters / peers. All local
  // data; the handle (if any) comes from the watched GitHub source.
  import { onMount } from "svelte";
  import { kindCounts, moodCounts, getMeta } from "../db";
  import { bondStage, daysTogether } from "../bond";
  import { derivePersona, type Persona } from "../personality";
  import { spriteUrl, fallbackUrl, spriteSrc, displayName, dexEntry } from "../sprites";

  interface Props {
    petName: string;
    dexId: number;
    shiny?: boolean;
    handle: string; // github username, or "" if none configured
    onClose: () => void;
  }
  let { petName, dexId, shiny = false, handle, onClose }: Props = $props();

  let days = $state(0);
  let bond = $state("Stranger");
  let persona = $state<Persona | null>(null);
  let commits = $state(0);
  let wins = $state(0);
  let learned = $state(0);
  let survived = $state(0);
  let species = $state("");
  let project = $state<string | null>(null);
  let copied = $state(false);
  let loaded = $state(false);

  let fallbackId = $state(-1);
  const src = $derived(fallbackId === dexId ? fallbackUrl(dexId, shiny) : spriteUrl(dexId, shiny));

  onMount(async () => {
    species = displayName(dexEntry(dexId)?.name ?? petName);
    days = daysTogether(await getMeta("first_met"));
    const interactions = Number((await getMeta("interactions")) ?? 0);
    bond = bondStage(days, interactions).label;
    const k = await kindCounts();
    const m = await moodCounts();
    commits = Number((await getMeta("commits")) ?? 0);
    wins = k["win"] ?? 0;
    learned = k["learned"] ?? 0;
    survived = k["survived"] ?? 0;
    const good = m["good"] ?? 0;
    const moods = Object.values(m).reduce((a, b) => a + b, 0);
    persona = derivePersona({
      nightSessions: Number((await getMeta("sess_night")) ?? 0),
      daySessions: Number((await getMeta("sess_day")) ?? 0),
      commits,
      learned,
      wins,
      goodRatio: moods ? good / moods : 0,
      days
    });
    const seed = await (await import("../db")).memoriesOfKind("seed", 1);
    project = seed.length ? seed[0].text : null;
    loaded = true;
  });

  const stats = $derived([
    { n: commits, label: "commits" },
    { n: wins, label: "wins" },
    { n: learned, label: "learned" },
    { n: survived, label: "survived" },
    { n: days, label: "days together" }
  ]);

  function shareText(): string {
    return (
      `${petName} the ${species} — my coding companion 🐾\n` +
      (handle ? `github.com/${handle}\n` : "") +
      `${days} days together · ${bond}${persona ? ` · ${persona.icon} ${persona.label}` : ""}\n` +
      `${commits} commits · ${wins} wins · ${learned} learned · ${survived} survived\n` +
      (project ? `currently building: ${project}\n` : "") +
      `— built with Hearthmon`
    );
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText());
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }
  async function openProfile() {
    if (!handle) return;
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(`https://github.com/${handle}`);
    } catch {
      /* opener unavailable */
    }
  }
</script>

<div class="wrap" role="dialog" aria-label="Showcase">
  <button class="x" onclick={onClose} aria-label="Close">✕</button>

  <div class="card">
    <div class="title">
      <span class="brand">Hearthmon</span>
      {#if handle}<span class="handle">@{handle}</span>{/if}
    </div>

    <div class="hero">
      <img class="sprite" use:spriteSrc={src} alt={petName} onerror={() => (fallbackId = dexId)} />
      <div class="who">
        <div class="name">{petName}</div>
        <div class="meta">the {species}</div>
        <div class="tags">
          <span class="tag">{bond}</span>
          {#if persona}<span class="tag persona" title={persona.blurb}>{persona.icon} {persona.label}</span>{/if}
        </div>
      </div>
    </div>

    {#if loaded}
      <div class="grid">
        {#each stats as s (s.label)}
          <div class="stat">
            <div class="num">{s.n}</div>
            <div class="lbl">{s.label}</div>
          </div>
        {/each}
      </div>

      {#if project}
        <div class="building"><span>currently building</span>“{project}”</div>
      {/if}
    {/if}

    <div class="actions">
      <button class="btn" onclick={copy}>{copied ? "✓ copied" : "📋 copy card"}</button>
      {#if handle}
        <button class="btn ghost" onclick={openProfile}>↗ github.com/{handle}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .wrap {
    position: absolute;
    inset: 0;
    z-index: 30;
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px;
    box-sizing: border-box;
    background:
      radial-gradient(120% 80% at 20% 0%, rgba(70, 90, 150, 0.5), transparent 60%),
      radial-gradient(120% 80% at 90% 100%, rgba(120, 80, 150, 0.45), transparent 55%),
      rgba(18, 15, 30, 0.99);
  }
  .x {
    position: absolute;
    top: 8px;
    right: 10px;
    z-index: 3;
    background: none;
    border: none;
    color: #b6acce;
    font-size: 13px;
    cursor: pointer;
  }
  .card {
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: #ece6f7;
  }
  .title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .brand {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #f0b66a;
  }
  .handle {
    font-size: 11px;
    color: #9d92bd;
  }
  .hero {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sprite {
    width: 78px;
    height: 78px;
    object-fit: contain;
    image-rendering: pixelated;
    filter: drop-shadow(0 5px 14px rgba(0, 0, 0, 0.5));
  }
  .who {
    min-width: 0;
  }
  .name {
    font-size: 18px;
    font-weight: 800;
  }
  .meta {
    font-size: 11px;
    color: #9d92bd;
    margin-bottom: 5px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .tag {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(120, 100, 180, 0.2);
    border: 1px solid rgba(150, 130, 210, 0.35);
    color: #d3c8f3;
  }
  .tag.persona {
    color: #f0d9a6;
    border-color: rgba(240, 182, 106, 0.4);
    background: rgba(240, 182, 106, 0.12);
    cursor: default;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .stat {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(120, 108, 160, 0.28);
    border-radius: 10px;
    padding: 8px 4px;
    text-align: center;
  }
  .num {
    font-size: 22px;
    font-weight: 800;
    color: #f6f1ff;
    line-height: 1;
  }
  .lbl {
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9d92bd;
    margin-top: 3px;
  }
  .building {
    font-size: 11.5px;
    line-height: 1.45;
    color: #ddd5ee;
    font-style: italic;
    background: rgba(120, 100, 180, 0.12);
    border-radius: 10px;
    padding: 7px 10px;
  }
  .building span {
    display: block;
    font-style: normal;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #8d82ab;
    margin-bottom: 2px;
  }
  .actions {
    display: flex;
    gap: 7px;
  }
  .btn {
    flex: 1;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(240, 182, 106, 0.5);
    background: rgba(240, 182, 106, 0.16);
    color: #f6e3c4;
    font-size: 11px;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.16s;
  }
  .btn:hover {
    background: rgba(240, 182, 106, 0.28);
  }
  .btn.ghost {
    border-color: rgba(120, 108, 160, 0.45);
    background: rgba(255, 255, 255, 0.04);
    color: #c4b5f0;
  }
  .btn.ghost:hover {
    background: rgba(255, 255, 255, 0.09);
  }
</style>
