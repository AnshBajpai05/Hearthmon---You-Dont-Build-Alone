<script lang="ts">
  // ╔══════════════════════════════════════════════════════╗
  // ║  Hearthmon Radial Menu                               ║
  // ║  One ✦ trigger → 5 categories bloom → sub-fan       ║
  // ║  Nintendo-style: minimal at idle, rich when needed   ║
  // ╚══════════════════════════════════════════════════════╝
  import type { WeatherKind } from "./WeatherFx.svelte";
  import type { CompanionMode } from "$lib/lines";

  type Panel = "none" | "mood" | "log" | "remind" | "nudge" | "switch" | "journey" | "jar" | "note" | "vault" | "code" | "wrapped" | "future" | "today" | "movie";

  interface Props {
    // reactive state (drives dynamic labels/icons)
    petSize:      number;   // pet sprite px — the ring sits just outside it
    muted:        boolean;
    focusMode:    boolean;
    roaming:      boolean;
    companionMode: CompanionMode;
    nightForced:  boolean;
    bgStyle:      "orb" | "square" | "ground" | "off";
    weatherKind:  WeatherKind;
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
    onToggleRoam:       () => void;
    onCycleMode:        () => void;
    onCycleBg:          () => void;
    onCycleRoom:        () => void;
    onCycleWeather:     () => void;
    onNudgeScale:       (d: number) => void;
    onToggleSoundPanel: () => void;
    onQuit:             () => void;
    onPushCard:         () => void;
    // dev: show/hide the 🧠 audio-class (mus/spch) readout — button only renders in dev builds
    audioVoteOn?:       boolean;
    onToggleAudioVote?: () => void;
    // pet reaction hooks
    onMenuOpen:       () => void;     // called when menu blooms
    onDirHint:        (d: 1|-1|0) => void; // pet turns toward hovered cat
  }

  let {
    petSize, muted, focusMode, roaming, companionMode, nightForced, bgStyle, weatherKind, soundPanelOpen,
    onTogglePanel, onFeed, onPet, onOpenBattle, onSwitchRandom,
    onToggleMute, onToggleNight, onToggleFocus, onToggleRoam, onCycleMode, onCycleBg, onCycleRoom, onCycleWeather,
    onNudgeScale, onToggleSoundPanel, onQuit, onPushCard,
    audioVoteOn, onToggleAudioVote,
    onMenuOpen, onDirHint,
  }: Props = $props();

  const DEV = import.meta.env.DEV; // gate the dev-only audio-vote toggle button

  // ─── geometry ────────────────────────────────────────────
  // Rings scale with the pet so the category buttons always bloom just OUTSIDE
  // the sprite, never on top of it — works for a tiny Pichu or a huge Gyarados.
  const R_CAT = $derived(Math.max(86, Math.round(petSize / 2 + 18))); // category ring
  const R_SUB = $derived(R_CAT + 46);                                  // sub-item ring
  const SUB_STEP_DEG = 22; // angular gap between adjacent sub-items
  // 22° at this radius → comfortably clear of the 44px buttons, so a ring
  // stays un-crowded no matter how many items it holds.

  function pos(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: Math.round(r * Math.cos(rad)), y: Math.round(r * Math.sin(rad)) };
  }

  /** Sub-items fan out evenly, centred on their category's angle. */
  function subAnglesFor(cat: CatDef): number[] {
    const n = cat.items.length;
    const spread = (n - 1) * SUB_STEP_DEG;
    return cat.items.map((_, i) => cat.angle - spread / 2 + i * SUB_STEP_DEG);
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
  interface SubDef { id: string; icon: string; label: string }
  interface CatDef {
    id: CatId; icon: string; name: string; tagline: string; angle: number;
    labelSide: "top" | "right" | "left" | "bottom";
    dirHint: 1 | -1 | 0;
    items: SubDef[];
  }

  const CATS: CatDef[] = [
    {
      id: "memory", icon: "🧠", name: "Memory",
      tagline: "Mood · Today · Jar · Journey · Recap · Movie · Future · Note",
      angle: 270, labelSide: "bottom", dirHint: 0,
      items: [
        { id: "mood",    icon: "🙂", label: "Mood" },
        { id: "today",   icon: "☁️", label: "Today" },
        { id: "jar",     icon: "🫙", label: "Good Jar" },
        { id: "journey", icon: "📖", label: "Journey" },
        { id: "recap",   icon: "🎞️", label: "Recap" },
        { id: "movie",   icon: "🎬", label: "Movie" },
        { id: "future",  icon: "🔮", label: "Future" },
        { id: "note",    icon: "✉️",  label: "Leave Note" },
      ],
    },
    {
      id: "care", icon: "❤️", name: "Care",
      tagline: "Feed · Pet · Evolve · Reminders · Vault",
      angle: 330, labelSide: "right", dirHint: 1,
      items: [
        { id: "feed",      icon: "🍙", label: "Feed" },
        { id: "pet",       icon: "🫳", label: "Pet" },
        { id: "evolve",    icon: "✨", label: "Evolve" },
        { id: "reminders", icon: "⏰", label: "Reminders" },
        { id: "vault",     icon: "🫂", label: "Vault" },
      ],
    },
    {
      id: "play", icon: "⚔️", name: "Play",
      tagline: "Battle · Switch · Random",
      angle: 30, labelSide: "right", dirHint: 1,
      items: [
        { id: "battle", icon: "⚔️",  label: "Battle" },
        { id: "switch", icon: "🎯",  label: "Switch" },
        { id: "random", icon: "🎲",  label: "Random" },
      ],
    },
    {
      id: "system", icon: "⚙️", name: "System",
      tagline: "Sound · Mode · Code · Roam · Size · Quit",
      angle: 150, labelSide: "left", dirHint: -1,
      items: [
        { id: "sound",   icon: "🔊", label: "Sound" },
        { id: "mode",    icon: "🔔", label: "Mode" },
        { id: "code",    icon: "🧑‍💻", label: "Code" },
        { id: "roam",    icon: "🚶", label: "Roam" },
        { id: "bigger",  icon: "＋", label: "Bigger" },
        { id: "smaller", icon: "－", label: "Smaller" },
        { id: "quit",    icon: "✕",  label: "Quit" },
      ],
    },
    {
      id: "atmos", icon: "🌙", name: "Atmosphere",
      tagline: "Weather · Night · Backdrop · Habitat · Focus",
      angle: 210, labelSide: "left", dirHint: -1,
      items: [
        { id: "weather",  icon: "🌦️", label: "Weather" },
        { id: "night",    icon: "🌙", label: "Night" },
        { id: "backdrop", icon: "🌿", label: "Backdrop" },
        { id: "room",     icon: "🏞️", label: "Habitat" },
        { id: "focus",    icon: "🎯", label: "Focus" },
      ],
    },
  ];

  // ─── state ───────────────────────────────────────────────
  const CLOSE_MS = 240; // reverse-collapse duration before the menu unmounts
  let menuOpen     = $state(false);
  let closing      = $state(false); // playing the collapse-back animation
  let activeCatId  = $state<CatId | null>(null);
  let hoveredCatId = $state<CatId | null>(null);
  let revealed     = $state(0);
  let timers: ReturnType<typeof setTimeout>[] = [];
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function openMenu() {
    clearTimeout(closeTimer);
    closing     = false;
    menuOpen    = true;
    activeCatId = null;
    revealed    = 0;
    onMenuOpen();
    // stagger bloom
    CATS.forEach((_, i) => {
      timers.push(setTimeout(() => (revealed = i + 1), i * 60));
    });
  }

  // Reverse the bloom: keep everything mounted, play the collapse-back
  // animation, then unmount once it's done. (Premium > snap-away.)
  function closeMenu() {
    if (!menuOpen || closing) return;
    timers.forEach(clearTimeout);
    timers = [];
    onDirHint(0);
    hoveredCatId = null;
    closing = true;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      menuOpen    = false;
      closing     = false;
      activeCatId = null;
      revealed    = 0;
    }, CLOSE_MS);
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
    if (catId === "system" && itemId === "mode")
      return companionMode === "fun" ? "🎉" : companionMode === "just_there" ? "🤫" : "🔔";
    if (catId === "system" && itemId === "roam") return roaming ? "🧭" : "🚶";
    if (catId === "atmos"  && itemId === "night")    return nightForced ? "🌟" : "🌙";
    if (catId === "atmos"  && itemId === "backdrop") return bgStyle === "off" ? "⬜" : "🌿";
    if (catId === "atmos"  && itemId === "focus")    return focusMode ? "✦" : "🎯";
    if (catId === "atmos"  && itemId === "weather")  return weatherKind !== "none" ? "⛅" : "🌦️";
    const found = CATS.find(c => c.id === catId)?.items.find(i => i.id === itemId);
    return found?.icon ?? "·";
  }

  function subActive(catId: CatId, itemId: string): boolean {
    if (catId === "system" && itemId === "sound")    return soundPanelOpen;
    if (catId === "system" && itemId === "mode")     return companionMode !== "default";
    if (catId === "system" && itemId === "roam")     return roaming;
    if (catId === "atmos"  && itemId === "night")    return nightForced;
    if (catId === "atmos"  && itemId === "backdrop") return bgStyle !== "off";
    if (catId === "atmos"  && itemId === "focus")    return focusMode;
    if (catId === "atmos"  && itemId === "weather")  return weatherKind !== "none";
    return false;
  }

  // ─── action dispatch ─────────────────────────────────────
  function doSub(catId: CatId, itemId: string) {
    const closeAfter = new Set([
      "memory:mood", "memory:today", "memory:jar", "memory:journey", "memory:recap", "memory:movie", "memory:future", "memory:note",
      "care:feed", "care:pet", "care:evolve", "care:reminders", "care:vault",
      "play:battle", "play:switch", "play:random",
      "system:code", "system:quit",
    ]);

    const key = `${catId}:${itemId}`;

    switch (key) {
      // Memory
      case "memory:mood":    onTogglePanel("mood");    break;
      case "memory:today":   onTogglePanel("today");   break;
      case "memory:jar":     onTogglePanel("jar");     break;
      case "memory:journey": onTogglePanel("journey"); break;
      case "memory:recap":   onTogglePanel("wrapped");  break;
      case "memory:movie":   onTogglePanel("movie");   break;
      case "memory:future":  onTogglePanel("future");  break;
      case "memory:note":    onTogglePanel("note");    break;
      // Care
      case "care:feed":      onFeed();                 break;
      case "care:pet":       onPet();                  break;
      case "care:evolve":    onTogglePanel("log");     break; // log = capture the growing moment
      case "care:reminders": onTogglePanel("nudge");   break;
      case "care:vault":     onTogglePanel("vault");   break;
      // Play
      case "play:battle":    onOpenBattle();           break;
      case "play:switch":    onTogglePanel("switch");  break;
      case "play:random":    onSwitchRandom();         break;
      // System
      case "system:sound":   onToggleSoundPanel();     break;
      case "system:mode":    onCycleMode();            break;
      case "system:code":    onTogglePanel("code");    break;
      case "system:roam":    onToggleRoam();           break;
      case "system:bigger":  onNudgeScale(0.15);       break;
      case "system:smaller": onNudgeScale(-0.15);      break;
      case "system:quit":    onQuit();                 break;
      // Atmosphere
      case "atmos:weather":  onCycleWeather();         break;
      case "atmos:night":    onToggleNight();          break;
      case "atmos:backdrop": onCycleBg();              break;
      case "atmos:room":     onCycleRoom();            break;
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

<!-- ─── Quick tray — common one-tap actions, left of the speaker ─── -->
<!-- hover-revealed; the full set still lives in the radial menu -->
<div class="quickbar" aria-label="Quick actions">
  <button class="quick-pill" title="Push README card" aria-label="Push card" onclick={onPushCard}>🚀</button>
  <button class="quick-pill" title="Feed" aria-label="Feed" onclick={onFeed}>🍙</button>
  <button class="quick-pill" title="Bigger" aria-label="Bigger" onclick={() => onNudgeScale(0.15)}>+</button>
  <button class="quick-pill" title="Smaller" aria-label="Smaller" onclick={() => onNudgeScale(-0.15)}>－</button>
  <button class="quick-pill" title="Random companion" aria-label="Random companion" onclick={onSwitchRandom}>🎲</button>
  {#if DEV && onToggleAudioVote}
    <button
      class="quick-pill"
      class:off={!audioVoteOn}
      title={audioVoteOn ? "Hide audio vote (mus/spch)" : "Show audio vote (mus/spch)"}
      aria-label="Toggle audio vote readout"
      onclick={onToggleAudioVote}
    >🎶</button>
  {/if}
</div>

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
      class:closing={closing}
      style="--tx:{p.x}px; --ty:{p.y}px; --i:{i}"
      onclick={() => tapCat(cat.id)}
      onpointerenter={() => hoverCat(cat)}
      onpointerleave={() => hoverCat(null)}
      aria-label={cat.name}
    >
      <span class="cat-icon">{cat.icon}</span>

      <!-- Hover whisper: a PREVIEW before opening. Hidden once active, because the sub-item fan
           blooms on the same side and the labeled pills already say everything (no overlap). -->
      {#if isHov && !isAct}
        <span class="whisper whisper-{cat.labelSide}">
          <strong>{cat.name}</strong>
          <em>{cat.tagline}</em>
        </span>
      {/if}
    </button>
  {/if}

  <!-- Sub-item fan (only when this category is active) -->
  {#if menuOpen && isAct}
    {@const angs = subAnglesFor(cat)}
    {#each cat.items as sub, j (sub.id)}
      {@const sp = pos(angs[j], R_SUB)}
      <button
        class="sub-btn"
        class:sub-active={subActive(cat.id, sub.id)}
        class:closing={closing}
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

  /* Quick tray — common actions, just left of the mute pill (hover-revealed) */
  .quickbar {
    position: absolute;
    top: 8px;
    right: 40px;          /* clears the 26px mute pill at right:8px */
    z-index: 12;
    display: flex;
    gap: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.22s;
  }
  :global(.widget:hover) .quickbar {
    opacity: 1;
    pointer-events: all;
  }
  .quick-pill {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(28, 22, 42, 0.88);
    color: #c4b5f0;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: border-color 0.18s, background 0.18s, transform 0.12s;
  }
  .quick-pill:hover {
    border-color: #f0b66a;
    background: rgba(50, 40, 72, 0.96);
    transform: translateY(-1px);
  }
  .quick-pill:active { transform: translateY(0) scale(0.92); }
  .quick-pill.off { opacity: 0.4; filter: grayscale(1); } /* audio-vote toggle: dim when hidden */

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
    opacity: 0;
    pointer-events: none;
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
  /* Tucked to the left edge, vertically centred — clear of the pet's body, the
     top-right mute pill, and the centre-bottom opacity slider. The category
     ring still blooms around the pet from centre when opened. */
  .trigger {
    position: absolute;
    left: 6px;
    top: 50%;
    right: auto;
    bottom: auto;
    z-index: 10;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid rgba(180, 160, 240, 0.35);
    background: rgba(28, 22, 42, 0.82);
    color: rgba(200, 185, 240, 0.5);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateY(-50%);
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
    transform: translateY(-50%) rotate(45deg) scale(0.9);
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

  /* reverse-collapse on close — later items leave first, shrinking to centre */
  .cat-btn.closing {
    pointer-events: none;
    animation: catCollapse 0.2s calc((4 - var(--i)) * 26ms) cubic-bezier(0.4, 0, 0.7, 0.4) both;
  }
  @keyframes catCollapse {
    from { opacity: 1; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1); }
    to   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
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

  /* sub-items collapse back toward the category on close */
  .sub-btn.closing {
    pointer-events: none;
    animation: subCollapse 0.16s cubic-bezier(0.4, 0, 0.7, 0.4) both;
  }
  @keyframes subCollapse {
    from { opacity: 1; transform: translate(calc(-50% + var(--tx)),       calc(-50% + var(--ty)))       scale(1); }
    to   { opacity: 0; transform: translate(calc(-50% + var(--tx) * 0.3), calc(-50% + var(--ty) * 0.3)) scale(0.5); }
  }

  /* respect reduced-motion: appear/disappear instantly, no bloom/collapse */
  @media (prefers-reduced-motion: reduce) {
    .cat-btn.revealed,
    .cat-btn.closing,
    .sub-btn,
    .sub-btn.closing,
    .whisper,
    .trigger { animation: none !important; transition: none !important; }
  }
</style>
