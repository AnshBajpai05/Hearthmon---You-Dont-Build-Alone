<script lang="ts">
  // "Wrapped" for your coding year — a tap-through, shareable recap. Works at
  // any point (titled by how long you've been together). Hard numbers are framed
  // gently — resilience, never shame.
  import { onMount } from "svelte";
  import { kindCounts, moodCounts, getMeta, memoriesOfKind } from "../db";
  import { bondStage, daysTogether } from "../bond";
  import { spriteUrl, fallbackUrl, spriteSrc, displayName, dexEntry } from "../sprites";

  interface Props {
    petName: string;
    dexId: number;
    shiny?: boolean;
    onClose: () => void;
  }
  let { petName, dexId, shiny = false, onClose }: Props = $props();

  interface Slide {
    tone: "intro" | "stat" | "partner" | "seed" | "close";
    title: string;
    sub?: string;
    big?: number;
    accent?: string;
  }

  let slides = $state<Slide[]>([]);
  let i = $state(0);
  let copied = $state(false);
  let shareText = $state("");
  let speciesName = $state("");
  let loaded = $state(false);

  onMount(async () => {
    const firstMet = await getMeta("first_met");
    const days = daysTogether(firstMet);
    const interactions = Number((await getMeta("interactions")) ?? 0);
    const commits = Number((await getMeta("commits")) ?? 0);
    const k = await kindCounts();
    const m = await moodCounts();
    const bond = bondStage(days, interactions).label;
    speciesName = displayName(dexEntry(dexId)?.name ?? petName);

    const wins = k["win"] ?? 0;
    const learned = k["learned"] ?? 0;
    const survived = k["survived"] ?? 0;
    const praise = k["praise"] ?? 0;
    const goodDays = m["good"] ?? 0;
    const hardDays = (m["low"] ?? 0) + (m["stressed"] ?? 0) + (m["frustrated"] ?? 0);

    const seeds = await memoriesOfKind("seed", 1);
    const seed = seeds.length ? seeds[0].text : null;

    const period = days >= 365 ? "year" : days >= 30 ? "season" : "story";
    const list: Slide[] = [
      {
        tone: "intro",
        title: period === "story" ? `Our story so far` : `Our ${period}, together`,
        sub: `${days} day${days === 1 ? "" : "s"} with ${petName} · ${bond}`
      }
    ];
    if (commits > 0)
      list.push({ tone: "stat", big: commits, title: "commits", sub: "small steps, again and again.", accent: "#8fd6a0" });
    if (wins + learned > 0)
      list.push({ tone: "stat", big: wins + learned, title: wins && learned ? "wins & lessons" : wins ? "wins kept" : "things learned", sub: "all of it counts.", accent: "#f0b66a" });
    if (hardDays > 0)
      list.push({ tone: "stat", big: hardDays, title: "hard days", sub: "and you showed up anyway.", accent: "#c4b5f0" });
    if (survived > 0)
      list.push({ tone: "stat", big: survived, title: "things you survived", sub: "recorded, so you never forget you did.", accent: "#c4b5f0" });
    if (goodDays > 0)
      list.push({ tone: "stat", big: goodDays, title: "good days", sub: "they happened. proof's right here.", accent: "#8fd6a0" });
    if (praise > 0)
      list.push({ tone: "stat", big: praise, title: "kind words, kept", sub: "things people saw in you.", accent: "#f0a8d8" });
    list.push({
      tone: "partner",
      title: `${petName}`,
      sub: `your ${speciesName} · ${bond}`
    });
    if (seed)
      list.push({ tone: "seed", title: "where we started", sub: `“${seed}”` });
    list.push({ tone: "close", title: "still here.", sub: "see you tomorrow." });

    slides = list;
    shareText =
      `My ${period} with ${petName} 🐾\n` +
      `${days} days together · ${bond}\n` +
      `${commits} commits · ${wins} wins · ${learned} learned\n` +
      `${hardDays} hard days survived · ${goodDays} good days\n` +
      `partner: ${petName} the ${speciesName}\n— Hearthmon`;
    loaded = true;
  });

  let fallbackId = $state(-1);
  const src = $derived(fallbackId === dexId ? fallbackUrl(dexId, shiny) : spriteUrl(dexId, shiny));

  // count-up for the headline number of the current slide
  let shown = $state(0);
  $effect(() => {
    const s = slides[i];
    if (!s || typeof s.big !== "number") return;
    const target = s.big;
    const start = performance.now();
    const dur = 650;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      shown = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    shown = 0;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  const atEnd = $derived(i >= slides.length - 1);
  function next() {
    if (!atEnd) i += 1;
  }
  function go(n: number) {
    i = Math.max(0, Math.min(slides.length - 1, n));
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      /* clipboard blocked — ignore */
    }
  }
</script>

<div class="wrap" role="dialog" aria-label="Year in review">
  <button class="x" onclick={onClose} aria-label="Close">✕</button>

  {#if loaded && slides.length}
    {@const s = slides[i]}
    <div
      class="stage tone-{s.tone}"
      role="button"
      tabindex="0"
      onclick={next}
      onkeydown={(e) => (e.key === "Enter" || e.key === " ") && next()}
      aria-label="Next"
    >
      {#if s.tone === "stat"}
        <div class="big" style="color: {s.accent ?? '#f0b66a'}">{shown}</div>
        <div class="title">{s.title}</div>
        {#if s.sub}<div class="sub">{s.sub}</div>{/if}
      {:else if s.tone === "partner"}
        <img class="sprite" use:spriteSrc={src} alt={petName} onerror={() => (fallbackId = dexId)} />
        <div class="title big-name">{s.title}</div>
        {#if s.sub}<div class="sub">{s.sub}</div>{/if}
      {:else}
        <div class="title lead">{s.title}</div>
        {#if s.sub}<div class="sub big-sub">{s.sub}</div>{/if}
      {/if}

      {#if atEnd}
        <div class="actions">
          <button class="share" onclick={(e) => { e.stopPropagation(); copy(); }}>
            {copied ? "✓ copied" : "📋 copy to share"}
          </button>
        </div>
      {:else}
        <div class="tapcue">tap →</div>
      {/if}
    </div>

    <div class="dots">
      {#each slides as _, d (d)}
        <button
          class="dot"
          class:on={d === i}
          onclick={() => go(d)}
          aria-label={`Slide ${d + 1}`}
        ></button>
      {/each}
    </div>
  {:else}
    <div class="stage"><div class="sub">gathering your story…</div></div>
  {/if}
</div>

<style>
  .wrap {
    position: absolute;
    inset: 0;
    z-index: 30;
    border-radius: 18px;
    overflow: hidden;
    background:
      radial-gradient(120% 90% at 30% 0%, rgba(80, 60, 130, 0.55), transparent 60%),
      radial-gradient(120% 90% at 80% 100%, rgba(150, 90, 120, 0.4), transparent 55%),
      rgba(20, 16, 32, 0.99);
    display: flex;
    flex-direction: column;
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
  .stage {
    flex: 1;
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 16px;
    text-align: center;
    color: #ece6f7;
    font-family: inherit;
    animation: slidein 0.3s ease;
  }
  @keyframes slidein {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .big {
    font-size: 60px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
    text-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  }
  .title {
    font-size: 15px;
    font-weight: 600;
    color: #f3eefc;
  }
  .lead {
    font-size: 22px;
    font-weight: 700;
  }
  .big-name {
    font-size: 20px;
    color: #f0b66a;
  }
  .sub {
    font-size: 12px;
    color: #b6acce;
    line-height: 1.5;
    max-width: 240px;
  }
  .big-sub {
    font-size: 13px;
    font-style: italic;
    color: #d9cff2;
  }
  .sprite {
    width: 96px;
    height: 96px;
    object-fit: contain;
    image-rendering: pixelated;
    filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.5));
    animation: rise 0.5s cubic-bezier(0.34, 1.4, 0.6, 1);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(14px) scale(0.85); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .tapcue {
    margin-top: 8px;
    font-size: 10px;
    color: #7d7299;
    letter-spacing: 0.08em;
  }
  .actions {
    margin-top: 12px;
  }
  .share {
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid rgba(240, 182, 106, 0.5);
    background: rgba(240, 182, 106, 0.16);
    color: #f6e3c4;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.16s, border-color 0.16s;
  }
  .share:hover {
    background: rgba(240, 182, 106, 0.28);
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 10px 0 12px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: none;
    background: rgba(180, 170, 210, 0.3);
    cursor: pointer;
    padding: 0;
  }
  .dot.on {
    background: #f0b66a;
  }
  @media (prefers-reduced-motion: reduce) {
    .stage, .sprite { animation: none; }
  }
</style>
