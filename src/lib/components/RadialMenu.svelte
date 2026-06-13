<script lang="ts">
  // ╔══════════════════════════════════════════════════════╗
  // ║  Hearthmon Radial Menu                               ║
  // ║  One ✦ trigger → 5 categories bloom → sub-fan       ║
  // ║  Nintendo-style: minimal at idle, rich when needed   ║
  // ╚══════════════════════════════════════════════════════╝
  import type { WeatherKind } from "./WeatherFx.svelte";

  type Panel = "none" | "mood" | "log" | "remind" | "switch" | "journey" | "jar" | "note" | "vault";

  interface Props {
    // reactive state (drives dynamic labels/icons)
    muted:       boolean;
    focusMode:   boolean;
    nightForced: boolean;
    bgStyle:     "orb" | "ground" | "off";
    weatherKind: WeatherKind;
    soundPanelOpen: boolean;
    // action callbacks — all owned by +page.svelte
    onTogglePanel:      (p: Panel) => void;
    onFeed:             () => void;
    onPet:              () => void;
    onOpenBattle:       () => void;
    onSwitchRandom:     () => void;
    onToggleMute:       () => void;
    onToggleNight:      () => void;
    onToggleFocus:      () => void;
    onCycleBg:          () => void;
    onCycleWeather:     () => void;
    onNudgeScale:       (d: number) => void;
    onToggleSoundPanel: () => void;
    onQuit:             () => void;
    // pet reaction hooks
    onMenuOpen:       () => void;     // called when menu blooms
    onDirHint:        (d: 1|-1|0) => void; // pet turns toward hovered cat
  }

  let {
    muted, focusMode, nightForced, bgStyle, weatherKind, soundPanelOpen,
    onTogglePanel, onFeed, onPet, onOpenBattle, onSwitchRandom,
    onToggleMute, onToggleNight, onToggleFocus, onCycleBg, onCycleWeather,
    onNudgeScale, onToggleSoundPanel, onQuit,
    onMenuOpen, onDirHint,
  }: Props = $props();

  // ─── geometry ────────────────────────────────────────────
  const R_CAT = 86;   // category ring (px from widget center)
  const R_SUB = 134;  // sub-item ring (px from widget center)

  function pos(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: Math.round(r * Math.cos(rad)), y: Math.round(r * Math.sin(rad)) };
  }

  // ─── category / sub-item data ────────────────────────────
  // Angles measured from positive x-axis (right = 0°, counter-clockwise with y↑).
  // In CSS, y increases downward, so sin(angle) → y means angle 270° = top.
  //
  //   🧠 Memory  270°  (top)
  //   ❤️ Care   330°  (upper-right)
  //   ⚔️ Play    30°  (lower-right)
  //   ⚙️ System 150°  (lower-left)
  //   🌙 Atmos  210°  (upper-left)

  type CatId = "memory" | "care" | "play" | "system" | "atmos";
  interface SubDef { id: string; icon: string; label: string; subAngle: number }
  interface CatDef {
    id: CatId; icon: string; name: string; tagline: string; angle: number;
    labelSide: "top" | "right" | "left" | "bottom";
    dirHint: 1 | -1 | 0;
    items: SubDef[];
  }

  const CATS: CatDef[] = [
    {
      id: "memory", icon: "🧠", name: "Memory",
      tagline: "Mood · Jar · Journey · Note",
      angle: 270, labelSide: "bottom", dirHint: 0,
      items: [
        { id: "mood",    icon: "🙂", label: "Mood",       subAngle: 242 },
        { id: "jar",     icon: "🫙", label: "Good Jar",   subAngle: 260 },
        { id: "journey", icon: "📖", label: "Journey",    subAngle: 278 },
        { id: "note",    icon: "✉️",  label: "Leave Note", subAngle: 297 },
      ],
    },
    {
      id: "care", icon: "❤️", name: "Care",
      tagline: "Feed · Pet · Evolve · Vault",
      angle: 330, labelSide: "right", dirHint: 1,
      items: [
        { id: "feed",   icon: "🍙", label: "Feed",   subAngle: 303 },
        { id: "pet",    icon: "🫳", label: "Pet",    subAngle: 325 },
        { id: "evolve", icon: "✨", label: "Evolve", subAngle: 347 },
        { id: "vault",  icon: "🫂", label: "Vault",  subAngle: 8   },
      ],
    },
    {
      id: "play", icon: "⚔️", name: "Play",
      tagline: "Battle · Switch · Random",
      angle: 30, labelSide: "right", dirHint: 1,
      items: [
        { id: "battle", icon: "⚔️",  label: "Battle",  subAngle: 5  },
        { id: "switch", icon: "🎯",  label: "Switch",  subAngle: 28 },
        { id: "random", icon: "🎲",  label: "Random",  subAngle: 52 },
      ],
    },
    {
      id: "system", icon: "⚙️", name: "System",
      tagline: "Sound · Bigger · Smaller · Quit",
      angle: 150, labelSide: "left", dirHint: -1,
      items: [
        { id: "sound",   icon: "🔊", label: "Sound",   subAngle: 120 },
        { id: "bigger",  icon: "＋", label: "Bigger",  subAngle: 142 },
        { id: "smaller", icon: "－", label: "Smaller", subAngle: 160 },
        { id: "quit",    icon: "✕",  label: "Quit",    subAngle: 180 },
      ],
    },
    {
      id: "atmos", icon: "🌙", name: "Atmosphere",
      tagline: "Weather · Night · Backdrop · Focus",
      angle: 210, labelSide: "left", dirHint: -1,
      items: [
        { id: "weather",  icon: "🌦️", label: "Weather",  subAngle: 183 },
        { id: "night",    icon: "🌙", label: "Night",    subAngle: 205 },
        { id: "backdrop", icon: "🌿", label: "Backdrop", subAngle: 226 },
        { id: "focus",    icon: "🎯", label: "Focus",    subAngle: 248 },
      ],
    },
  ];

  // ─── state ───────────────────────────────────────────────
  let menuOpen     = $state(false);
  let activeCatId  = $state<CatId | null>(null);
  let hoveredCatId = $state<CatId | null>(null);
  let revealed     = $state(0);
  let timers: ReturnType<typeof setTimeout>[] = [];

  function openMenu() {
    menuOpen    = true;
    activeCatId = null;
    revealed    = 0;
    onMenuOpen();
    // stagger bloom
    CATS.forEach((_, i) => {
      timers.push(setTimeout(() => (revealed = i + 1), i * 60));
    });
  }

  function closeMenu() {
    menuOpen     = false;
    activeCatId  = null;
    hoveredCatId = null;
    revealed     = 0;
    timers.forEach(clearTimeout);
    timers = [];
    onDirHint(0);
  }

  function toggleMenu() {
    if (menuOpen) closeMenu();
    else openMenu();
  }

  function tapCat(id: CatId) {
    activeCatId = activeCatId === id ? null : id;
  }

  function hoverCat(cat: CatDef | null) {
    hoveredCatId = cat?.id ?? null;
    onDirHint(cat?.dirHint ?? 0);
  }

  // ─── dynamic icons/labels (reflect current state) ────────
  function subIcon(catId: CatId, itemId: string): string {
    if (catId === "system" && itemId === "sound")    return muted ? "🔇" : "🔊";
    if (catId === "atmos"  && itemId === "night")    return nightForced ? "🌟" : "🌙";
    if (catId === "atmos"  && itemId === "backdrop") return bgStyle === "off" ? "⬜" : "🌿";
    if (catId === "atmos"  && itemId === "focus")    return focusMode ? "✦" : "🎯";
    if (catId === "atmos"  && itemId === "weather")  return weatherKind !== "none" ? "⛅" : "🌦️";
    const found = CATS.find(c => c.id === catId)?.items.find(i => i.id === itemId);
    return found?.icon ?? "·";
  }

  function subActive(catId: CatId, itemId: string): boolean {
    if (catId === "system" && itemId === "sound")    return soundPanelOpen;
    if (catId === "atmos"  && itemId === "night")    return nightForced;
    if (catId === "atmos"  && itemId === "backdrop") return bgStyle !== "off";
    if (catId === "atmos"  && itemId === "focus")    return focusMode;
    if (catId === "atmos"  && itemId === "weather")  return weatherKind !== "none";
    if (catId === "system" && itemId === "sound")    return !muted;
    return false;
  }

  // ─── action dispatch ─────────────────────────────────────
  function doSub(catId: CatId, itemId: string) {
    const closeAfter = new Set([
      "memory:mood", "memory:jar", "memory:journey", "memory:note",
      "care:feed", "care:pet", "care:evolve", "care:vault",
      "play:battle", "play:switch", "play:random",
      "system:quit",
    ]);

    const key = `${catId}:${itemId}`;

    switch (key) {
      // Memory
      case "memory:mood":    onTogglePanel("mood");    break;
      case "memory:jar":     onTogglePanel("jar");     break;
      case "memory:journey": onTogglePanel("journey"); break;
      case "memory:note":    onTogglePanel("note");    break;
      // Care
      case "care:feed":      onFeed();                 break;
      case "care:pet":       onPet();                  break;
      case "care:evolve":    onTogglePanel("log");     break; // log = capture the growing moment
      case "care:vault":     onTogglePanel("vault");   break;
      // Play
      case "play:battle":    onOpenBattle();           break;
      case "play:switch":    onTogglePanel("switch");  break;
      case "play:random":    onSwitchRandom();         break;
      // System
      case "system:sound":   onToggleSoundPanel();     break;
      case "system:bigger":  onNudgeScale(0.15);       break;
      case "system:smaller": onNudgeScale(-0.15);      break;
      case "system:quit":    onQuit();                 break;
      // Atmosphere
      case "atmos:weather":  onCycleWeather();         break;
      case "atmos:night":    onToggleNight();          break;
      case "atmos:backdrop": onCycleBg();              break;
      case "atmos:focus":    onToggleFocus();          break;
    }

    if (closeAfter.has(key)) closeMenu();
  }

  // Escape to close
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && menuOpen) closeMenu();
  }

  const activeCat = $derived(CATS.find(c => c.id === activeCatId) ?? null);
</script>

<svelte:window onkeydown={onKeydown} />

<!-- ======================================================= -->
<!-- Click-away backdrop when menu is open                   -->
{#if menuOpen}
  <div class="menu-backdrop" onclick={closeMenu} aria-hidden="true"></div>
{/if}

<!-- ─── Mute safety pill — always visible ─────────────────── -->
<button
  class="mute-pill"
  class:active={!muted}
  title={muted ? "Unmute" : "Mute"}
  onclick={onToggleMute}
  aria-label={muted ? "Unmute" : "Mute"}
>
  {muted ? "🔇" : "🔊"}
</button>

<!-- ─── ✦ Radial trigger ───────────────────────────────────── -->
<button
  class="trigger"
  class:open={menuOpen}
  onclick={toggleMenu}
  aria-label="Open menu"
  title="Menu"
>
  ✦
</button>

<!-- ─── Category ring + sub-fans ──────────────────────────── -->
{#each CATS as cat, i (cat.id)}
  {@const p     = pos(cat.angle, R_CAT)}
  {@const isAct = activeCatId === cat.id}
  {@const isDim = activeCatId !== null && !isAct}
  {@const isHov = hoveredCatId === cat.id}

  <!-- Category button -->
  {#if menuOpen}
    <button
      class="cat-btn"
      class:active={isAct}
      class:dimmed={isDim}
      class:hovered={isHov}
      class:revealed={i < revealed}
      style="--tx:{p.x}px; --ty:{p.y}px; --i:{i}"
      onclick={() => tapCat(cat.id)}
      onpointerenter={() => hoverCat(cat)}
      onpointerleave={() => hoverCat(null)}
      aria-label={cat.name}
    >
      <span class="cat-icon">{cat.icon}</span>

      <!-- Hover whisper label -->
      {#if isHov || isAct}
        <span class="whisper whisper-{cat.labelSide}">
          <strong>{cat.name}</strong>
          <em>{cat.tagline}</em>
        </span>
      {/if}
    </button>
  {/if}

  <!-- Sub-item fan (only when this category is active) -->
  {#if menuOpen && isAct}
    {#each cat.items as sub, j (sub.id)}
      {@const sp = pos(sub.subAngle, R_SUB)}
      <button
        class="sub-btn"
        class:sub-active={subActive(cat.id, sub.id)}
        style="--tx:{sp.x}px; --ty:{sp.y}px; --j:{j}"
        onclick={() => doSub(cat.id, sub.id)}
        title={sub.label}
        aria-label={sub.label}
      >
        <span class="sub-icon">{subIcon(cat.id, sub.id)}</span>
        <span class="sub-label">{sub.label}</span>
      </button>
    {/each}
  {/if}
{/each}

<style>
  /* ── Shared: all radial elements are absolutely centered ── */
  .menu-backdrop {
    position: absolute;
    inset: 0;
    z-index: 8;
    cursor: default;
  }

  /* Mute pill — always shown (safety action) */
  .mute-pill {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 12;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(28, 22, 42, 0.88);
    color: #c4b5f0;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    pointer-events: all;
    transition: opacity 0.22s, border-color 0.18s, background 0.18s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  :global(.widget:hover) .mute-pill,
  .mute-pill.active {
    opacity: 1;
    pointer-events: all;
  }
  .mute-pill:hover {
    border-color: #f0b66a;
    background: rgba(50, 40, 72, 0.96);
  }

  /* ── ✦ Trigger ─────────────────────────────────────────── */
  .trigger {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 10;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1.5px solid rgba(180, 160, 240, 0.35);
    background: rgba(28, 22, 42, 0.82);
    color: rgba(200, 185, 240, 0.5);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
    transition:
      color 0.25s,
      border-color 0.25s,
      background 0.25s,
      box-shadow 0.25s,
      transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1);
    /* barely visible at idle */
    opacity: 0;
    pointer-events: none;
  }
  /* show on widget hover — :global required since .widget is in a parent component */
  :global(.widget:hover) .trigger {
    opacity: 1;
    pointer-events: all;
    color: rgba(220, 205, 255, 0.85);
  }
  .trigger:hover,
  .trigger.open {
    color: #f0b66a;
    border-color: rgba(240, 182, 106, 0.6);
    background: rgba(50, 38, 68, 0.95);
    box-shadow: 0 0 18px rgba(240, 182, 106, 0.3), 0 2px 12px rgba(0,0,0,0.4);
  }
  .trigger.open {
    transform: translate(-50%, -50%) rotate(45deg) scale(0.9);
  }

  /* ── Category buttons ──────────────────────────────────── */
  .cat-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 11;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1.5px solid rgba(140, 120, 200, 0.4);
    background: rgba(35, 28, 52, 0.92);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 14px rgba(0,0,0,0.4);
    pointer-events: none;

    /* pre-bloom: at center, invisible, small */
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.35);
    transition:
      border-color 0.2s,
      background   0.2s,
      box-shadow   0.2s;
  }
  /* bloom outward when revealed */
  .cat-btn.revealed {
    pointer-events: all;
    animation: catBloom 0.42s calc(var(--i) * 55ms) cubic-bezier(0.34, 1.35, 0.64, 1) both;
  }
  @keyframes catBloom {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.35);
    }
    to {
      opacity: 1;
      transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1);
    }
  }
  /* after animation completes, keep final position */
  .cat-btn.revealed {
    opacity: 1;
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1);
  }
  .cat-btn.dimmed {
    opacity: 0.28;
    filter: saturate(0.3);
  }
  .cat-btn.active {
    border-color: #f0b66a;
    background: rgba(55, 42, 78, 0.97);
    box-shadow:
      0 0 20px rgba(240,182,106,0.35),
      0 3px 14px rgba(0,0,0,0.45);
    scale: 1.08;
    transition: scale 0.18s cubic-bezier(0.34, 1.3, 0.64, 1), border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }
  .cat-btn.hovered:not(.active) {
    border-color: rgba(200, 180, 255, 0.7);
    background: rgba(48, 38, 68, 0.96);
    box-shadow: 0 0 14px rgba(180,160,240,0.25), 0 2px 10px rgba(0,0,0,0.4);
    scale: 1.04;
    transition: scale 0.16s cubic-bezier(0.34, 1.3, 0.64, 1), border-color 0.18s, background 0.18s;
  }

  .cat-icon { font-size: 16px; line-height: 1; pointer-events: none; }

  /* ── Whisper hover label ───────────────────────────────── */
  .whisper {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: max-content;
    max-width: 92px;
    pointer-events: none;
    animation: whisperIn 0.2s ease both;
    background: rgba(22, 17, 36, 0.92);
    border: 1px solid rgba(120, 100, 180, 0.35);
    border-radius: 8px;
    padding: 5px 8px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.45);
  }
  @keyframes whisperIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .whisper strong {
    font-size: 10.5px;
    font-weight: 700;
    color: #f0b66a;
    letter-spacing: 0.02em;
    display: block;
  }
  .whisper em {
    font-size: 9px;
    font-style: normal;
    color: #8d82ab;
    line-height: 1.45;
    display: block;
  }
  /* Label positioning by side */
  .whisper-top    { bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); }
  .whisper-bottom { top:    calc(100% + 8px); left: 50%; transform: translateX(-50%); }
  .whisper-right  { left: calc(100% + 9px);  top:  50%; transform: translateY(-50%); }
  .whisper-left   { right: calc(100% + 9px); top:  50%; transform: translateY(-50%); }

  /* ── Sub-item buttons ──────────────────────────────────── */
  .sub-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 12;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 5px 5px;
    border-radius: 12px;
    border: 1px solid rgba(120, 100, 180, 0.35);
    background: rgba(30, 24, 46, 0.94);
    cursor: pointer;
    min-width: 44px;
    box-shadow: 0 3px 12px rgba(0,0,0,0.4);
    transition: border-color 0.18s, background 0.18s, transform 0.18s;
    animation: subFan 0.32s calc(var(--j) * 45ms) cubic-bezier(0.34, 1.25, 0.64, 1) both;
  }
  @keyframes subFan {
    from {
      opacity: 0;
      transform: translate(calc(-50% + var(--tx) * 0.3), calc(-50% + var(--ty) * 0.3)) scale(0.5);
    }
    to {
      opacity: 1;
      transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1);
    }
  }
  .sub-btn {
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty)));
  }
  .sub-btn:hover {
    border-color: rgba(240,182,106,0.55);
    background: rgba(50, 40, 72, 0.97);
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1.08);
  }
  .sub-btn.sub-active {
    border-color: rgba(240,182,106,0.5);
    background: rgba(55, 44, 76, 0.95);
  }
  .sub-icon {
    font-size: 14px;
    line-height: 1;
    pointer-events: none;
  }
  .sub-label {
    font-size: 8.5px;
    color: #9d92bd;
    font-family: inherit;
    white-space: nowrap;
    pointer-events: none;
    line-height: 1;
  }
  .sub-btn:hover .sub-label { color: #f0b66a; }
  .sub-btn.sub-active .sub-label { color: #f0b66a; }
</style>
