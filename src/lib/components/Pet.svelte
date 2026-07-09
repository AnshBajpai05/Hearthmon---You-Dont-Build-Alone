<script lang="ts">
  import { spriteUrl, fallbackUrl, localSrc } from "../sprites";
  import type { PetState } from "../presence";

  interface Props {
    dexId: number;
    name: string;
    state?: PetState;
    flip?: boolean;
    size?: number;
    shiny?: boolean;
    type?: string; // primary type → drives the idle behaviour
    lookX?: number; // head-tracking offset px
    lookY?: number;
    lookTilt?: number; // head-tracking tilt deg
    bob?: number; // music reactivity: audio energy → gentle vertical bob (px), parity with Alive
    pulse?: number; // music reactivity: a beat → a brief soft scale pump (0..1)
    srcOverride?: string; // mega/special form: a full sprite URL that replaces the dex sprite
    fallbackOverride?: string; // if srcOverride fails, drop to THIS (the form's own static) — not the base
    onTap?: () => void;
    onPet?: () => void;
  }
  let {
    dexId,
    name,
    state: petState = "idle",
    flip = false,
    size = 110,
    shiny = false,
    type = "normal",
    lookX = 0,
    lookY = 0,
    lookTilt = 0,
    bob = 0,
    pulse = 0,
    srcOverride = undefined,
    fallbackOverride = undefined,
    onTap,
    onPet
  }: Props = $props();

  let failedId = $state(0);
  let failedSrc = $state(""); // a srcOverride that 404'd → fall back to the base sprite
  const src = $derived(
    srcOverride && failedSrc !== srcOverride
      ? srcOverride
      : srcOverride && fallbackOverride
        ? fallbackOverride // the override failed → its own static form, never the base sprite
        : petState === "sleeping" || failedId === dexId
          ? fallbackUrl(dexId, shiny)
          : spriteUrl(dexId, shiny)
  );

  // Route the (remote) src through the local disk cache → a data: URL. Falls back to the
  // remote URL until resolved (and if the cache+fetch both fail). 429-proof once cached.
  let resolvedSrc = $state("");
  $effect(() => {
    const want = src;
    let cancelled = false;
    localSrc(want).then((r) => { if (!cancelled && src === want) resolvedSrc = r; });
    return () => { cancelled = true; };
  });

  // type-specific idle behaviour (leaf-sway, mane-flicker, neck-sway, …)
  const fx = $derived.by(() => {
    switch (type) {
      case "grass":
      case "bug":
        return "grass"; // leaf sway
      case "fire":
        return "fire"; // mane flicker
      case "water":
        return "water"; // neck sway
      case "ice":
        return "ice"; // shiver
      case "electric":
      case "steel":
        return "electric"; // twitch
      case "psychic":
      case "fairy":
        return "psychic"; // levitate
      case "ghost":
      case "dark":
        return "ghost"; // waver
      case "dragon":
      case "flying":
        return "dragon"; // hover
      default:
        return ""; // steadfast — just breathing
    }
  });

  // Content-fit scale: tiny Pokémon barely fill the sprite frame, so they look
  // small. Measure the opaque bounding box off-screen and enlarge so every mon
  // is framed intentionally. Best-effort — the visible sprite is never affected.
  let contentScale = $state(1);
  $effect(() => {
    const url = src; // track
    let cancelled = false;
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => {
      if (cancelled) return;
      try {
        const n = 96;
        const c = document.createElement("canvas");
        c.width = c.height = n;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (!g) return;
        g.imageSmoothingEnabled = false;
        g.drawImage(probe, 0, 0, n, n);
        const d = g.getImageData(0, 0, n, n).data;
        let minX = n, minY = n, maxX = 0, maxY = 0, any = false;
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            if (d[(y * n + x) * 4 + 3] > 12) {
              any = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (!any) {
          contentScale = 1;
          return;
        }
        const frac = Math.max(maxX - minX + 1, maxY - minY + 1) / n;
        contentScale = Math.min(1.55, Math.max(1, 0.8 / frac));
      } catch {
        contentScale = 1; // cross-origin tainted — leave as-is
      }
    };
    probe.onerror = () => {
      if (!cancelled) contentScale = 1;
    };
    probe.src = url;
    return () => {
      cancelled = true;
    };
  });
  const drawSize = $derived(Math.round(size * contentScale));

  // ---- touch & petting (Talking-Tom style) ----
  // A still click = a tap (bounce). Stroking across the pet = petting (hearts + wiggle).
  // Window dragging lives on the background, NOT here, so grabbing the pet never throws
  // it to the boundary.
  let downAt: { x: number; y: number } | null = null;
  let lastPt: { x: number; y: number } | null = null;
  let petDist = 0;
  let petting = $state(false);
  let hearts = $state<{ id: number; x: number }[]>([]);
  let petClear: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    downAt = { x: e.screenX, y: e.screenY };
    lastPt = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: PointerEvent) {
    // petting works whether or not the button is held — it's a stroke over the sprite
    if (!lastPt) lastPt = { x: e.clientX, y: e.clientY };
    const dx = e.clientX - lastPt.x;
    const dy = e.clientY - lastPt.y;
    lastPt = { x: e.clientX, y: e.clientY };
    petDist += Math.hypot(dx, dy);
    if (petDist > 52) {
      petDist = 0;
      petting = true;
      hearts = [...hearts.slice(-5), { id: ++seq, x: 20 + Math.random() * 60 }];
      onPet?.();
      clearTimeout(petClear);
      petClear = setTimeout(() => (petting = false), 750);
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (downAt) {
      const moved = Math.hypot(e.screenX - downAt.x, e.screenY - downAt.y);
      if (moved < 5) onTap?.(); // a still click is a tap
    }
    downAt = null;
  }

  function onPointerLeave() {
    lastPt = null;
    petDist = 0;
    petting = false;
  }

  function dropHeart(id: number) {
    hearts = hearts.filter((h) => h.id !== id);
  }
</script>

<div
  class="pet {petState}"
  class:petting
  style="transform: scaleX({flip ? -1 : 1})"
  role="button"
  tabindex="0"
  aria-label="Pet {name}"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointerleave={onPointerLeave}
>
  {#if petState === "sleeping"}
    <div class="zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></div>
  {/if}
  {#each hearts as h (h.id)}
    <span class="heart" style="left: {h.x}%" onanimationend={() => dropHeart(h.id)}>♥</span>
  {/each}
  <div class="petlook" style="transform: rotate({lookTilt}deg) translate({lookX}px, {lookY - bob}px) scale({1 + pulse * 0.05})">
    <div class="petfx" class:fx-grass={fx === "grass"} class:fx-fire={fx === "fire"} class:fx-water={fx === "water"} class:fx-ice={fx === "ice"} class:fx-electric={fx === "electric"} class:fx-psychic={fx === "psychic"} class:fx-ghost={fx === "ghost"} class:fx-dragon={fx === "dragon"}>
      <img
        src={resolvedSrc || src}
        alt={name}
        style="width: {drawSize}px; height: {drawSize}px"
        draggable="false"
        onerror={() => { if (srcOverride && src === srcOverride) failedSrc = srcOverride; else failedId = dexId; }}
      />
    </div>
  </div>
  <div class="shadow" style="width: {Math.round(size * 0.62)}px" aria-hidden="true"></div>
</div>

<style>
  .pet {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    outline: none;
    pointer-events: auto;
  }
  img {
    object-fit: contain;
    image-rendering: pixelated;
    transition: filter 0.8s ease;
    pointer-events: none;
  }
  /* gentle happy wiggle while being petted */
  .petting img {
    animation: wiggle 0.5s ease-in-out infinite;
  }
  @keyframes wiggle {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }
  .shadow {
    height: 12px;
    margin-top: -8px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(0, 0, 0, 0.35) 0%, transparent 70%);
  }
  .heart {
    position: absolute;
    top: 18%;
    font-size: 14px;
    color: #ff8fb0;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    animation: heartrise 1s ease-out forwards;
  }
  @keyframes heartrise {
    0% { transform: translateY(0) scale(0.5); opacity: 0; }
    25% { opacity: 1; }
    100% { transform: translateY(-34px) scale(1.1); opacity: 0; }
  }
  .sleeping img {
    filter: brightness(0.62) saturate(0.7);
    animation: breathe 3.4s ease-in-out infinite;
    transform-origin: 50% 100%;
  }
  @keyframes breathe {
    0%, 100% { transform: scale(1, 0.96); }
    50% { transform: scale(1.015, 1); }
  }
  /* Aliveness: a gentle breath while awake & idle (not while petting). */
  .pet.idle:not(.petting) img {
    animation: idlebreath 5.4s ease-in-out infinite;
    transform-origin: 50% 100%;
  }
  @keyframes idlebreath {
    0%, 100% { transform: scale(1, 1); }
    50% { transform: scale(1.008, 1.011); }
  }
  /* head-tracking: lean toward the cursor; smooth lerp via transition */
  .petlook {
    display: block;
    transform-origin: 50% 90%;
    transition: transform 0.22s ease-out;
    will-change: transform;
  }
  /* ---- type-specific idle behaviours (composed over the breath on the img) ---- */
  .petfx {
    display: block;
    transform-origin: 50% 92%;
  }
  .pet.idle:not(.petting) .fx-grass { animation: leafsway 4.2s ease-in-out infinite; }
  .pet.idle:not(.petting) .fx-fire { animation: maneflick 2.6s ease-in-out infinite; }
  .pet.idle:not(.petting) .fx-water { animation: necksway 5s ease-in-out infinite; }
  .pet.idle:not(.petting) .fx-ice { animation: shiver 0.4s ease-in-out infinite; }
  .pet.idle:not(.petting) .fx-electric { animation: twitch 3.4s ease-in-out infinite; }
  .pet.idle:not(.petting) .fx-psychic { animation: levitate 4.6s ease-in-out infinite; }
  .pet.idle:not(.petting) .fx-ghost { animation: waver 5.2s ease-in-out infinite; }
  .pet.idle:not(.petting) .fx-dragon { animation: hover 5.4s ease-in-out infinite; }
  @keyframes leafsway {
    0%, 100% { transform: rotate(-2deg); }
    50% { transform: rotate(2deg); }
  }
  @keyframes maneflick {
    0%, 100% { filter: brightness(1); transform: translateY(0); }
    50% { filter: brightness(1.13); transform: translateY(-1px); }
  }
  @keyframes necksway {
    0%, 100% { transform: rotate(-1.6deg) translateX(-1px); }
    50% { transform: rotate(1.6deg) translateX(1px); }
  }
  @keyframes shiver {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-0.8px); }
    75% { transform: translateX(0.8px); }
  }
  @keyframes twitch {
    0%, 86%, 100% { transform: translateX(0); }
    88% { transform: translateX(-2px); }
    91% { transform: translateX(2px); }
    94% { transform: translateX(-1px); }
  }
  @keyframes levitate {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes waver {
    0%, 100% { transform: translateX(-3px); opacity: 0.85; }
    50% { transform: translateX(3px); opacity: 1; }
  }
  @keyframes hover {
    0%, 100% { transform: translateY(-1px) rotate(-0.6deg); }
    50% { transform: translateY(-3.5px) rotate(0.6deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pet.idle:not(.petting) img,
    .pet.idle:not(.petting) .petfx { animation: none; }
  }
  .happy img {
    animation: bounce 0.45s ease 2;
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-14px); }
  }
  .zzz {
    position: absolute;
    top: -10px;
    right: 12px;
    font-size: 15px;
    color: #cfc6e8;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  }
  .zzz span {
    display: inline-block;
    animation: float 2.6s ease-in-out infinite;
    opacity: 0;
  }
  .zzz span:nth-child(2) { animation-delay: 0.8s; font-size: 12px; }
  .zzz span:nth-child(3) { animation-delay: 1.6s; font-size: 10px; }
  @keyframes float {
    0% { transform: translateY(0); opacity: 0; }
    30% { opacity: 0.9; }
    100% { transform: translateY(-18px); opacity: 0; }
  }
</style>
