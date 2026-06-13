<script lang="ts">
  import { spriteUrl, fallbackUrl } from "../sprites";
  import type { PetState } from "../presence";

  interface Props {
    dexId: number;
    name: string;
    state?: PetState;
    flip?: boolean;
    size?: number;
    shiny?: boolean;
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
    onTap,
    onPet
  }: Props = $props();

  let failedId = $state(0);
  const src = $derived(
    petState === "sleeping" || failedId === dexId
      ? fallbackUrl(dexId, shiny)
      : spriteUrl(dexId, shiny)
  );

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
  <img
    {src}
    alt={name}
    style="width: {size}px; height: {size}px"
    draggable="false"
    onerror={() => (failedId = dexId)}
  />
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
