<script lang="ts">
  // ╔══════════════════════════════════════════════════════╗
  // ║  Hearthmon Radial Menu                               ║
  // ║  One ✦ trigger → 5 categories bloom → sub-fan       ║
  // ║  Nintendo-style: minimal at idle, rich when needed   ║
  // ╚══════════════════════════════════════════════════════╝
  import type { WeatherKind } from "./WeatherFx.svelte";
  import type { CompanionMode } from "$lib/lines";
  import { solveRadial, sideFor, dirHintFor, type Layout, type Rect } from "$lib/radialLayout";

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
    onQuit:             () => void; // tuck to tray (the companion stays)
    onShutdown:         () => void; // REAL exit — kills the process, no tray ghost
    onPushCard:         () => void;
    // ambient micro-clock (quick tray): a record-disc face in the pet's ground colours
    clockOn:            boolean;
    onToggleClock:      () => void;
    clockBg:            string;  // groundDiscFor(...) gradient — the clock face IS the ground
    clockTc:            string;  // type accent for the digits
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
    onNudgeScale, onToggleSoundPanel, onQuit, onShutdown, onPushCard,
    clockOn, onToggleClock, clockBg, clockTc,
    audioVoteOn, onToggleAudioVote,
    onMenuOpen, onDirHint,
  }: Props = $props();

  // ─── ambient clock (panel below the quick tray) ──────────
  // big HH:MM in the type accent, small seconds + am/pm, date line — plus the
  // record-disc face. 1s tick only runs while the clock is enabled.
  let now = $state(new Date());
  $effect(() => {
    if (!clockOn) return;
    now = new Date();
    const iv = setInterval(() => (now = new Date()), 1000);
    return () => clearInterval(iv);
  });
  const h12 = $derived(((now.getHours() + 11) % 12) + 1);
  const ampm = $derived(now.getHours() < 12 ? "am" : "pm");
  const mm = $derived(String(now.getMinutes()).padStart(2, "0"));
  const ss = $derived(String(now.getSeconds()).padStart(2, "0"));
  const dateStr = $derived(
    `${now.toLocaleDateString(undefined, { weekday: "long" })}, ${now.getDate()} ${now.toLocaleDateString(undefined, { month: "long" })}`
  );
  const minDeg = $derived(now.getMinutes() * 6);
  const hourDeg = $derived(((now.getHours() % 12) + now.getMinutes() / 60) * 30);

  // ─── geometry — solved, not assumed ──────────────────────
  // The solver (radialLayout.ts) owns ALL positions: it caps radii by the
  // window (not just the pet), derives per-radius angular steps from chord
  // math, carves fans around reserved chrome, and degrades LOCALLY per the
  // ladder Arc → DualRing → Popover (whole menu: Ring → Sheet).
  let W = $state(0); // widget rect, measured by the invisible probe div below
  let H = $state(0);

  let layout = $state<Layout | null>(null);
  let lastSolve = { w: 0, h: 0, pet: 0 };
  $effect(() => {
    if (!W || !H) return;
    // hysteresis: re-solve only when the space MEANINGFULLY changed (±16px) —
    // sticky angles + a stable ring beat a perfectly-optimal jittery one
    const moved =
      Math.abs(W - lastSolve.w) > 16 || Math.abs(H - lastSolve.h) > 16 || petSize !== lastSolve.pet;
    if (layout && !moved) return;
    const prev = layout?.mode === "ring" ? new Map(layout.cats.map((c) => [c.id, c.angle])) : null;
    // reserved chrome: only what stays interactive while the menu is open.
    // (quickbar / clock / mute duck out of the way — see .ducked below.)
    const chrome: Rect[] = [
      { x: 6, y: H / 2 - 14, w: 28, h: 28 }, // ✦ trigger (doubles as the close button)
      { x: W / 2 - 80, y: H - 33, w: 160, h: 26 }, // opacity bar, bottom-centre
    ];
    lastSolve = { w: W, h: H, pet: petSize };
    layout = solveRadial({
      W, H, petSize, chrome,
      cats: CATS.map((c) => ({ id: c.id, n: c.items.length, baseAngle: c.baseAngle, prevAngle: prev?.get(c.id) })),
    });
  });

  const ringCats = $derived.by(() => {
    const l = layout;
    if (!l || l.mode !== "ring") return [];
    return CATS.map((cat, i) => ({ cat, i, lay: l.cats.find((c) => c.id === cat.id)! }));
  });

  /** Popover panel position: horizontally centred, anchored BELOW the centred
   *  Back button (above it if the bottom lacks room) — never underneath it.
   *  (v0.2.0 centred both: the Back button sat on top of the panel and hid a pill.) */
  function popStyle(n: number): string {
    const pw = Math.min(W - 16, 192);
    const ph = Math.ceil(n / 3) * 48 + 12; // estimate for clamping only — height is auto
    const left = (W - pw) / 2;
    const below = H / 2 + 34; // clear of the 40px Back button at centre
    const top = below + ph <= H - 8 ? below : Math.max(8, H / 2 - 34 - ph);
    return `left:${left}px; top:${top}px; width:${pw}px;`;
  }

  /** One step back up the drill: level 2 → level 1 (never straight to closed). */
  function backToCats() {
    activeCatId = null;
    miniCaption = "";
    onDirHint(0);
  }

  // icon-only orbits have no room for labels — the hovered one captions the centre
  let miniCaption = $state("");

  // ─── category / sub-item data ────────────────────────────
  // baseAngle is the canonical HOME (0° = right, y down ⇒ 270° = top) — the
  // solver keeps a category there when it fits and slides it to the nearest
  // clear angle when it doesn't. Label side + pet look-direction derive from
  // the SOLVED angle, so they stay correct when a category moves.
  //
  //   🧠 Memory  270°  (top)
  //   ❤️ Care   330°  (upper-right)
  //   ⚔️ Play    30°  (lower-right)
  //   ⚙️ System 150°  (lower-left)
  //   🌙 Atmos  210°  (upper-left)

  type CatId = "memory" | "care" | "play" | "system" | "atmos";
  interface SubDef { id: string; icon: string; label: string }
  interface CatDef {
    id: CatId; icon: string; name: string; tagline: string; baseAngle: number;
    items: SubDef[];
  }

  const CATS: CatDef[] = [
    {
      id: "memory", icon: "🧠", name: "Memory",
      tagline: "Mood · Today · Jar · Journey · Recap · Movie · Future · Note",
      baseAngle: 270,
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
      baseAngle: 330,
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
      baseAngle: 30,
      items: [
        { id: "battle", icon: "⚔️",  label: "Battle" },
        { id: "switch", icon: "🎯",  label: "Switch" },
        { id: "random", icon: "🎲",  label: "Random" },
      ],
    },
    {
      id: "system", icon: "⚙️", name: "System",
      tagline: "Sound · Mode · Code · Roam · Size · Quit",
      baseAngle: 150,
      items: [
        { id: "sound",   icon: "🔊", label: "Sound" },
        { id: "mode",    icon: "🔔", label: "Mode" },
        { id: "code",    icon: "🧑‍💻", label: "Code" },
        { id: "roam",    icon: "🚶", label: "Roam" },
        { id: "bigger",  icon: "＋", label: "Bigger" },
        { id: "smaller", icon: "－", label: "Smaller" },
        { id: "quit",     icon: "✕", label: "Tuck away" },
        { id: "shutdown", icon: "⏻", label: "Quit fully" },
      ],
    },
    {
      id: "atmos", icon: "🌙", name: "Atmosphere",
      tagline: "Weather · Night · Backdrop · Habitat · Focus · Clock",
      baseAngle: 210,
      items: [
        { id: "weather",  icon: "🌦️", label: "Weather" },
        { id: "night",    icon: "🌙", label: "Night" },
        { id: "backdrop", icon: "🌿", label: "Backdrop" },
        { id: "room",     icon: "🏞️", label: "Habitat" },
        { id: "focus",    icon: "🎯", label: "Focus" },
        { id: "clock",    icon: "🕐", label: "Clock" },
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
    const lay = cat && layout?.mode === "ring" ? layout.cats.find((c) => c.id === cat.id) : null;
    onDirHint(lay ? dirHintFor(lay.angle) : 0);
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
    if (catId === "atmos"  && itemId === "clock")    return clockOn;
    return false;
  }

  // ─── action dispatch ─────────────────────────────────────
  function doSub(catId: CatId, itemId: string) {
    const closeAfter = new Set([
      "memory:mood", "memory:today", "memory:jar", "memory:journey", "memory:recap", "memory:movie", "memory:future", "memory:note",
      "care:feed", "care:pet", "care:evolve", "care:reminders", "care:vault",
      "play:battle", "play:switch", "play:random",
      "system:code", "system:quit", "system:shutdown",
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
      case "system:quit":     onQuit();                break;
      case "system:shutdown": onShutdown();            break;
      // Atmosphere
      case "atmos:weather":  onCycleWeather();         break;
      case "atmos:night":    onToggleNight();          break;
      case "atmos:backdrop": onCycleBg();              break;
      case "atmos:room":     onCycleRoom();            break;
      case "atmos:focus":    onToggleFocus();          break;
      case "atmos:clock":    onToggleClock();          break;
    }

    if (closeAfter.has(key)) closeMenu();
  }

  // Escape backs up one level: drill → categories → closed
  function onKeydown(e: KeyboardEvent) {
    if (e.key !== "Escape" || !menuOpen) return;
    if (activeCatId !== null) backToCats();
    else closeMenu();
  }

  const activeCat = $derived(CATS.find(c => c.id === activeCatId) ?? null);
</script>

<svelte:window onkeydown={onKeydown} />

<!-- invisible probe: measures the widget rect for the layout solver -->
<div class="measure" bind:clientWidth={W} bind:clientHeight={H} aria-hidden="true"></div>

<!-- ======================================================= -->
<!-- Click-away backdrop: at drill level a miss-click goes BACK to the five
     categories (never accidentally closes everything); at level 1 it closes -->
{#if menuOpen}
  <div
    class="menu-backdrop"
    onclick={() => (activeCatId !== null ? backToCats() : closeMenu())}
    aria-hidden="true"
  ></div>
{/if}

<!-- ─── Quick tray — common one-tap actions, left of the speaker ─── -->
<!-- hover-revealed; the full set still lives in the radial menu.
     Ducks while the menu is open: transient UI outranks passive chrome. -->
<div class="quickbar" class:ducked={menuOpen} aria-label="Quick actions">
  <button class="quick-pill" class:off={!clockOn} title={clockOn ? "Hide clock" : "Show clock"} aria-label="Toggle clock" onclick={onToggleClock}>🕐</button>
  <button class="quick-pill" title="Push README card" aria-label="Push card" onclick={onPushCard}>🚀</button>
  <button class="quick-pill" title="Feed" aria-label="Feed" onclick={onFeed}>🍙</button>
  <button class="quick-pill" title="Bigger" aria-label="Bigger" onclick={() => onNudgeScale(0.15)}>+</button>
  <button class="quick-pill" title="Smaller" aria-label="Smaller" onclick={() => onNudgeScale(-0.15)}>－</button>
  <button class="quick-pill" title="Random companion" aria-label="Random companion" onclick={onSwitchRandom}>🎲</button>
  {#if onToggleAudioVote}
    <button
      class="quick-pill"
      class:off={!audioVoteOn}
      title={audioVoteOn ? "Hide music/speech score" : "Show music/speech score"}
      aria-label="Toggle audio vote readout"
      onclick={onToggleAudioVote}
    >🎶</button>
  {/if}
</div>

{#if clockOn}
  <!-- ambient clock panel — always visible while on (a clock you must hover for is no
       clock). Record-disc face + big time in the type accent + date, like a bedside clock. -->
  <div class="clockpanel" class:ducked={menuOpen} style="--tc: {clockTc}" aria-label="Clock">
    <span class="clockface" style="background: {clockBg}">
      <span class="hand h" style="transform: rotate({hourDeg}deg)"></span>
      <span class="hand m" style="transform: rotate({minDeg}deg)"></span>
      <span class="pin"></span>
    </span>
    <div class="cp-main">
      <div class="cp-time">{h12}:{mm}<span class="cp-sec">:{ss} {ampm}</span></div>
      <div class="cp-date">{dateStr}</div>
    </div>
  </div>
{/if}

<!-- ─── Mute safety pill — always visible ─────────────────── -->
<button
  class="mute-pill"
  class:ducked={menuOpen}
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

<!-- ─── Category ring + sub-fans (positions come from the solver) ── -->
{#if layout?.mode === "ring"}
  {#each ringCats as { cat, i, lay } (cat.id)}
    {@const isAct = activeCatId === cat.id}
    {@const isHov = hoveredCatId === cat.id}

    <!-- Category button. Drill-down: tapping it hands the category the WHOLE
         space — the other four collapse away, this one flies to the centre and
         becomes the Back button while its items orbit it in a full circle. -->
    {#if menuOpen}
      <button
        class="cat-btn"
        class:active={isAct}
        class:centered={isAct}
        class:away={activeCatId !== null && !isAct}
        class:hovered={isHov}
        class:revealed={i < revealed}
        class:closing={closing}
        style="--tx:{lay.x}px; --ty:{lay.y}px; --i:{i}"
        onclick={() => tapCat(cat.id)}
        onpointerenter={() => hoverCat(cat)}
        onpointerleave={() => hoverCat(null)}
        aria-label={isAct ? `${cat.name} — back` : cat.name}
      >
        <span class="cat-icon">{cat.icon}</span>
        {#if isAct}<span class="back-label">back</span>{/if}

        <!-- Hover whisper: a PREVIEW before opening (level 1 only). -->
        {#if isHov && !isAct && activeCatId === null}
          <span class="whisper whisper-{sideFor(lay.angle)}">
            <strong>{cat.name}</strong>
            <em>{cat.tagline}</em>
          </span>
        {/if}
      </button>
    {/if}

    <!-- Level 2: items orbit the centred category in a full circle;
         popover panel only when even a full circle can't hold them -->
    {#if menuOpen && isAct}
      {#if lay.mode === "orbit"}
        {#each cat.items as sub, j (sub.id)}
          {@const sp = lay.items[j]}
          <button
            class="sub-btn"
            class:mini={lay.mini}
            class:sub-active={subActive(cat.id, sub.id)}
            class:closing={closing}
            style="--tx:{sp.x}px; --ty:{sp.y}px; --j:{j}"
            onclick={() => doSub(cat.id, sub.id)}
            onpointerenter={() => lay.mini && (miniCaption = sub.label)}
            onpointerleave={() => lay.mini && (miniCaption = "")}
            title={sub.label}
            aria-label={sub.label}
          >
            <span class="sub-icon">{subIcon(cat.id, sub.id)}</span>
            <span class="sub-label">{sub.label}</span>
          </button>
        {/each}
        <!-- icon-only orbit: the hovered item's name appears under the Back button -->
        {#if lay.mini && miniCaption}
          <div class="orbit-caption">{miniCaption}</div>
        {/if}
      {:else}
        <div class="popover" class:closing={closing} style={popStyle(cat.items.length)}>
          {#each cat.items as sub (sub.id)}
            <button
              class="flow-btn"
              class:sub-active={subActive(cat.id, sub.id)}
              onclick={() => doSub(cat.id, sub.id)}
              title={sub.label}
              aria-label={sub.label}
            >
              <span class="sub-icon">{subIcon(cat.id, sub.id)}</span>
              <span class="sub-label">{sub.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  {/each}
{:else if layout?.mode === "sheet" && menuOpen}
  <!-- Whole-menu fallback: the window is too small for any honest ring.
       Same actions, same dispatch — only the presentation degrades. -->
  <div class="sheet" class:closing={closing} aria-label="Menu">
    {#each CATS as cat (cat.id)}
      <div class="sheet-cat">
        <div class="sheet-head"><span>{cat.icon}</span>{cat.name}</div>
        <div class="sheet-items">
          {#each cat.items as sub (sub.id)}
            <button
              class="flow-btn"
              class:sub-active={subActive(cat.id, sub.id)}
              onclick={() => doSub(cat.id, sub.id)}
              title={sub.label}
              aria-label={sub.label}
            >
              <span class="sub-icon">{subIcon(cat.id, sub.id)}</span>
              <span class="sub-label">{sub.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

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

  /* ambient clock panel — sits below the quick tray, top-right; passive, always
     visible while enabled. Digits ride the type accent (--tc, the ground colour). */
  .clockpanel {
    position: absolute;
    top: 40px;
    right: 8px;
    z-index: 11;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 11px 6px 9px;
    border-radius: 12px;
    background: rgba(18, 14, 30, 0.8);
    border: 1px solid color-mix(in srgb, var(--tc) 40%, transparent);
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.35);
    pointer-events: none; /* pure display — clicks pass through to the widget */
  }
  .cp-main { display: flex; flex-direction: column; line-height: 1.15; }
  .cp-time {
    font-size: 21px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: var(--tc);
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
  }
  .cp-sec {
    font-size: 10px;
    font-weight: 600;
    opacity: 0.75;
    letter-spacing: 0.05em;
  }
  .cp-date {
    font-size: 9.5px;
    font-weight: 600;
    color: #a99cc9;
    letter-spacing: 0.04em;
  }
  .clockface {
    position: relative;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    overflow: hidden;
    flex: none;
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.55), inset 0 1px 2px rgba(255, 255, 255, 0.18);
  }
  .hand {
    position: absolute;
    left: 50%;
    bottom: 50%;
    transform-origin: 50% 100%;
    border-radius: 1px;
    background: #fff;
    box-shadow: 0 0 1.5px rgba(0, 0, 0, 0.7); /* readable on any band colour */
  }
  .hand.h { width: 2px;   height: 4.5px; margin-left: -1px; }
  .hand.m { width: 1.3px; height: 6.5px; margin-left: -0.65px; opacity: 0.9; }
  .pin {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 3px;
    height: 3px;
    margin: -1.5px 0 0 -1.5px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.7);
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

  /* ── drill-down states (AFTER .active/.closing so they win the cascade) ── */
  /* active category flies to the CENTRE and becomes the Back button */
  .cat-btn.centered {
    animation: none;
    transform: translate(-50%, -50%);
    scale: 1.12;
    transition:
      transform 0.3s cubic-bezier(0.34, 1.3, 0.64, 1),
      scale 0.3s cubic-bezier(0.34, 1.3, 0.64, 1),
      border-color 0.2s, background 0.2s, box-shadow 0.2s;
    z-index: 13;
    flex-direction: column;
    gap: 0;
  }
  /* the other four collapse toward the centre and get out of the way */
  .cat-btn.away {
    animation: none;
    transform: translate(-50%, -50%) scale(0.3);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.24s cubic-bezier(0.4, 0, 0.7, 0.4), opacity 0.2s;
  }
  /* closing the whole menu from drill level: the centred button just fades
     (catCollapse would first teleport it back to its ring spot) */
  .cat-btn.centered.closing,
  .cat-btn.away.closing {
    animation: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .back-label {
    font-size: 7px;
    font-weight: 700;
    color: #f0b66a;
    letter-spacing: 0.05em;
    line-height: 1;
    pointer-events: none;
  }

  .cat-icon { font-size: 16px; line-height: 1; pointer-events: none; color: #f2edff; }

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
    /* text glyphs (＋ － ✕ ⏻) inherit the UA's near-black button colour and
       vanish on the dark pills — emoji ignore colour, these don't */
    color: #f2edff;
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

  /* icon-only orbit pill (tight windows): a 36px circle, label via hover caption */
  .sub-btn.mini {
    min-width: 36px;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 50%;
    justify-content: center;
  }
  .sub-btn.mini .sub-label { display: none; }
  .orbit-caption {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, 32px);
    z-index: 13;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: #f0b66a;
    background: rgba(22, 17, 36, 0.92);
    border: 1px solid rgba(120, 100, 180, 0.35);
    border-radius: 7px;
    padding: 2px 8px;
    pointer-events: none;
    white-space: nowrap;
  }

  /* sub-items collapse back toward the category on close */
  .sub-btn.closing {
    pointer-events: none;
    animation: subCollapse 0.16s cubic-bezier(0.4, 0, 0.7, 0.4) both;
  }
  @keyframes subCollapse {
    from { opacity: 1; transform: translate(calc(-50% + var(--tx)),       calc(-50% + var(--ty)))       scale(1); }
    to   { opacity: 0; transform: translate(calc(-50% + var(--tx) * 0.3), calc(-50% + var(--ty) * 0.3)) scale(0.5); }
  }

  /* ── layout-solver support ─────────────────────────────── */
  /* invisible probe that reports the widget rect to the solver */
  .measure {
    position: absolute;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
    z-index: -1;
  }

  /* passive chrome PARTICIPATES while the menu is open: slides up, shrinks,
     and gets out of the fans' way — then comes back. (Not a mere fade.) */
  .clockpanel { transition: opacity 0.28s ease, transform 0.28s ease; }
  :global(.widget:hover) .quickbar.ducked,
  .quickbar.ducked,
  :global(.widget:hover) .mute-pill.ducked,
  .mute-pill.ducked,
  .clockpanel.ducked {
    opacity: 0.12;
    transform: translateY(-8px) scale(0.92);
    pointer-events: none;
  }
  .quickbar { transition: opacity 0.22s, transform 0.28s ease; }
  .mute-pill { transition: opacity 0.22s, transform 0.28s ease, border-color 0.18s, background 0.18s; }

  /* popover — a category's fan when no spatial fan honestly fits */
  .popover {
    position: absolute;
    z-index: 12;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px;
    border-radius: 14px;
    border: 1px solid rgba(120, 100, 180, 0.4);
    background: rgba(24, 19, 38, 0.96);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.5);
    animation: flowIn 0.2s cubic-bezier(0.34, 1.25, 0.64, 1) both;
  }

  /* whole-menu sheet — only when even a category ring can't exist */
  .sheet {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 13;
    max-height: 60%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(120, 100, 180, 0.4);
    background: rgba(22, 17, 36, 0.97);
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.55);
    animation: sheetIn 0.22s cubic-bezier(0.34, 1.2, 0.64, 1) both;
  }
  .sheet-head {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10.5px;
    font-weight: 700;
    color: #f0b66a;
    letter-spacing: 0.03em;
    margin-bottom: 5px;
  }
  .sheet-items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* flow pill — the sub-btn look, but in normal flow (popover + sheet) */
  .flow-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px 5px 5px;
    border-radius: 12px;
    border: 1px solid rgba(120, 100, 180, 0.35);
    background: rgba(30, 24, 46, 0.94);
    cursor: pointer;
    min-width: 50px;
    transition: border-color 0.18s, background 0.18s, transform 0.12s;
  }
  .flow-btn:hover {
    border-color: rgba(240, 182, 106, 0.55);
    background: rgba(50, 40, 72, 0.97);
    transform: translateY(-1px);
  }
  .flow-btn:active { transform: translateY(0) scale(0.95); }
  .flow-btn.sub-active {
    border-color: rgba(240, 182, 106, 0.5);
    background: rgba(55, 44, 76, 0.95);
  }
  .flow-btn:hover .sub-label,
  .flow-btn.sub-active .sub-label { color: #f0b66a; }

  @keyframes flowIn {
    from { opacity: 0; transform: scale(0.86); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes sheetIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .popover.closing,
  .sheet.closing {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s ease;
  }

  /* respect reduced-motion: appear/disappear instantly, no bloom/collapse */
  @media (prefers-reduced-motion: reduce) {
    .cat-btn.revealed,
    .cat-btn.closing,
    .cat-btn.centered,
    .cat-btn.away,
    .sub-btn,
    .sub-btn.closing,
    .whisper,
    .popover,
    .sheet,
    .clockpanel,
    .quickbar,
    .mute-pill,
    .trigger { animation: none !important; transition: none !important; }
  }
</style>
