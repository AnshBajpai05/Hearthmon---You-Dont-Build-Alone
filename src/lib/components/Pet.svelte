<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
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
  }
  let {
    dexId,
    name,
    state: petState = "idle",
    flip = false,
    size = 110,
    shiny = false,
    onTap
  }: Props = $props();

  // remember which dex id failed so switching to a new one retries the animated sprite
  let failedId = $state(0);
  // asleep → still sprite (no battle-bounce gif); awake → animated
  const src = $derived(
    petState === "sleeping" || failedId === dexId
      ? fallbackUrl(dexId, shiny)
      : spriteUrl(dexId, shiny)
  );

  // Drag the whole window by the pet; a still click is a tap.
  let downAt: { x: number; y: number } | null = null;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    downAt = { x: e.screenX, y: e.screenY };
  }
  async function onPointerMove(e: PointerEvent) {
    if (!downAt) return;
    const dx = e.screenX - downAt.x;
    const dy = e.screenY - downAt.y;
    if (dx * dx + dy * dy > 36) {
      downAt = null;
      await getCurrentWindow().startDragging();
    }
  }
  function onPointerUp() {
    if (downAt) {
      downAt = null;
      onTap?.();
    }
  }
</script>

<div
  class="pet {petState}"
  style="transform: scaleX({flip ? -1 : 1})"
  role="button"
  tabindex="0"
  aria-label={name}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
>
  {#if petState === "sleeping"}
    <div class="zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></div>
  {/if}
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
    cursor: grab;
    outline: none;
  }
  .pet:active {
    cursor: grabbing;
  }
  img {
    object-fit: contain;
    image-rendering: pixelated;
    transition: filter 0.8s ease;
    pointer-events: none;
  }
  .shadow {
    height: 12px;
    margin-top: -8px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(0, 0, 0, 0.35) 0%, transparent 70%);
  }
  .sleeping img {
    filter: brightness(0.62) saturate(0.7);
    animation: breathe 3.4s ease-in-out infinite;
    transform-origin: 50% 100%;
  }
  @keyframes breathe {
    0%,
    100% {
      transform: scale(1, 0.96);
    }
    50% {
      transform: scale(1.015, 1);
    }
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
