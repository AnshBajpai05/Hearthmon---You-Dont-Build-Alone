<script lang="ts">
  import { onMount } from "svelte";
  import {
    getCurrentWindow,
    currentMonitor,
    PhysicalPosition,
    PhysicalSize
  } from "@tauri-apps/api/window";
  import { listen } from "@tauri-apps/api/event";
  import { invoke } from "@tauri-apps/api/core";
  import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
  import Pet from "$lib/components/Pet.svelte";
  import Bubble from "$lib/components/Bubble.svelte";
  import MoodCheckIn from "$lib/components/MoodCheckIn.svelte";
  import LogMemory from "$lib/components/LogMemory.svelte";
  import RemindMe from "$lib/components/RemindMe.svelte";
  import FirstMeeting from "$lib/components/FirstMeeting.svelte";
  import SwitchCompanion from "$lib/components/SwitchCompanion.svelte";
  import BattleScene from "$lib/components/BattleScene.svelte";
  import JourneyPanel from "$lib/components/JourneyPanel.svelte";
  import GoodThingsJar from "$lib/components/GoodThingsJar.svelte";
  import LeaveNote from "$lib/components/LeaveNote.svelte";
  import VaultPanel from "$lib/components/VaultPanel.svelte";
  import CodePanel from "$lib/components/CodePanel.svelte";
  import CommandBar from "$lib/components/CommandBar.svelte";
  import YearInReview from "$lib/components/YearInReview.svelte";
  import JourneyMovie from "$lib/components/JourneyMovie.svelte";
  import PixiStage from "$lib/components/PixiStage.svelte";
  import Showcase from "$lib/components/Showcase.svelte";
  import FutureSelf from "$lib/components/FutureSelf.svelte";
  import TodayFelt from "$lib/components/TodayFelt.svelte";
  import WeatherFx from "$lib/components/WeatherFx.svelte";
  import type { WeatherKind } from "$lib/components/WeatherFx.svelte";
  import RadialMenu from "$lib/components/RadialMenu.svelte";
  import {
    playCry,
    voiceCry,
    announceGo,
    playVoiceClip,
    commitChime,
    fixFanfare,
    shipFanfare,
    newRepoChime,
    milestoneFanfare,
    announce,
    previewSfx,
    previewSpeak,
    setSoundEnabled,
    setVolume,
    getVolumes,
    type Channel
  } from "$lib/sound";
  import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
  import {
    getMeta,
    setMeta,
    addMemory,
    findFamiliar,
    hardMoodCount,
    moodCounts,
    kindCounts,
    bumpCounter,
    unreadLetter,
    allMemories,
    oldArc,
    type Memory
  } from "$lib/db";
  import type { Mood, MemoryKind } from "$lib/db";
  import { resolveSacred } from "$lib/sacred";
  import { initPresence, poke, setFocus, setMode, setBondTier, setPersona } from "$lib/presence";
  import type { PetState } from "$lib/presence";
  import { derivePersona, type Persona } from "$lib/personality";
  import { quirkLine } from "$lib/quirks";
  import { deriveTemperament, driftLine, type Temperament } from "$lib/drift";
  import { buildCard } from "$lib/card";
  import { biomeForType } from "$lib/biomes";
  import { daysTogether, bondStageIndex, BOND_STAGES } from "$lib/bond";
  import {
    pick,
    moodResponses,
    familiarLine,
    monthOf,
    winSaved,
    learnedSaved,
    survivedSaved,
    praiseSaved,
    firstMeetingClose,
    switchLines,
    burnoutLines,
    comfortOffer,
    evolveOfferLines,
    evolveDoneLines,
    evolveDeclineLines,
    anniversaryLine,
    pokeReactions,
    treatLines,
    pettingLines,
    musicCalmLines,
    musicChillLines,
    musicHypeLines,
    jarLines,
    letterReadyLines,
    endOfNightLines,
    modeLines,
    softFailLines,
    bondUpLine,
    chapterCloseLine,
    streakLine,
    commitQuips,
    fixQuips,
    prQuips,
    releaseQuips,
    newRepoQuips,
    milestoneQuip,
    trainStartLines,
    trainHeavyLines,
    trainDoneLines,
    trainProgressLines,
    trainCrashLines,
    ambientLines,
    personaAmbient,
    ALONGSIDE_STAGES,
    alongsideLine,
    projectStayedLine,
    projectRevisitLine,
    flowLines,
    frictionStuckLines,
    frictionBounceLines,
    breakthroughLines,
    chapterMomentLines,
    arcCallbackLine
  } from "$lib/lines";
  import type { CompanionMode } from "$lib/lines";
  import {
    dexEntry,
    randomEntry,
    displayName,
    spriteUrl,
    fallbackUrl,
    nextEvolution,
    hasEvolution,
    evolutionStepsAhead,
    TRAINER_URL,
    type Creature,
    type DexEntry
  } from "$lib/sprites";
  import {
    makeParticles,
    randomMove,
    signatureMove,
    TYPE_FX,
    type Move,
    type Particle
  } from "$lib/attackfx";
  import { animKind, type AnimKind } from "$lib/fx";
  import { backgroundFor } from "$lib/backgrounds";

  type Panel =
    | "none"
    | "mood"
    | "log"
    | "remind"
    | "switch"
    | "journey"
    | "jar"
    | "note"
    | "vault"
    | "code"
    | "wrapped"
    | "showcase"
    | "future"
    | "today"
    | "movie";
  // the full Ash sequence: recall beam → ball returns → "Name, go!" → thrown ball arcs in → release
  type SwitchFx = "none" | "recall" | "ballout" | "gap" | "throw" | "release";

  let phase = $state<"loading" | "meeting" | "home">("loading");
  let dexId = $state(0);
  let petName = $state("");
  let petState = $state<PetState>("idle");
  // one brain, two renderers: Classic (CSS) · Alive (Pixi). Same systems, different skin.
  let renderMode = $state<"classic" | "alive">("classic");
  let bubble = $state("");
  let panel = $state<Panel>("none");
  let switchFx = $state<SwitchFx>("none");
  let battleOpen = $state(false);
  let isShiny = $state(false);
  // ---- evolution ceremony ----
  let evoOffer = $state(false); // the gentle "ready to grow?" prompt
  let evoActive = $state(false); // the white-silhouette ceremony is playing
  let evoShowNew = $state(false); // which silhouette shows mid-flicker
  let evoFlash = $state(false); // the bright reveal flash
  let evoTarget = $state<DexEntry | null>(null);
  let evoCount = $state(0); // evolutions for the current companion lineage
  let muted = $state(false);
  let focusMode = $state(false);
  let nightAuto = $state(false); // true 00–05h
  let nightForced = $state(false); // manual moon toggle, persisted
  let isWinter = $state(false); // Dec–Feb seasonal snow
  // backdrop style: glossy "orb" sphere · "ground" curved platform · "off"
  let bgStyle = $state<"orb" | "square" | "ground" | "off">("orb");
  const curType = $derived(dexEntry(dexId)?.type ?? "normal");
  async function cycleBg() {
    bgStyle = bgStyle === "orb" ? "square" : bgStyle === "square" ? "ground" : bgStyle === "ground" ? "off" : "orb";
    await setMeta("bg_style", bgStyle);
  }

  // overall widget transparency (pet + orb), user-adjustable
  let widgetOpacity = $state(1);
  let opacityTimer: ReturnType<typeof setTimeout> | undefined;
  function setWidgetOpacity(v: number) {
    widgetOpacity = Math.min(1, Math.max(0.2, v));
    clearTimeout(opacityTimer);
    opacityTimer = setTimeout(() => setMeta("widget_opacity", String(widgetOpacity)), 300);
  }

  // when truly idle (not hovering, nothing open), clip the view to just the orb —
  // the widget reads as a clean self-contained sphere on the desktop
  let hovering = $state(false);
  const idleNow = $derived(
    phase === "home" &&
      !hovering &&
      panel === "none" &&
      !battleOpen &&
      switchFx === "none" &&
      !evoActive &&
      !evoOffer
  );

  // bgStyle is already declared above with cycleBg()
  const isNight = $derived(nightAuto || nightForced);
  let comfortMode = $state(false);

  function refreshComfort() {
    // comfort lingers a little, then lifts on its own (or instantly on a good day)
    void getMeta("comfort_until").then((v) => {
      comfortMode = Number(v ?? 0) > Date.now();
    });
  }
  let moodGlow = $state(""); // emotional weather: tint after a check-in

  async function toggleNight() {
    nightForced = !nightForced;
    await setMeta("night_forced", nightForced ? "1" : "0");
  }
  let delight = $state<"none" | "star" | "rain" | "fireworks">("none");
  let delightTimer: ReturnType<typeof setTimeout> | undefined;

  // ---- daily opening ritual: stretch animation ----
  let ritualStretch = $state(false);
  function triggerRitual() {
    ritualStretch = true;
    setTimeout(() => (ritualStretch = false), 1200);
  }

  // ---- return-without-shame: a little dust-off shimmy when you come back ----
  function triggerDustOff() {
    if (focusMode) return;
    oneShot = "dust";
    setTimeout(() => (oneShot = "none"), 900);
  }

  // ---- natural weather effects ----
  const WEATHER_KINDS: WeatherKind[] = ["wind", "rain", "snow", "thunder"];
  let weatherKind = $state<WeatherKind>("none");
  let weatherEnabled = $state(true);   // user can toggle off entirely
  let weatherTimer: ReturnType<typeof setTimeout> | undefined;
  let weatherAutoTimer: ReturnType<typeof setTimeout> | undefined;

  function playWeather(kind: WeatherKind, durationMs = 24000) {
    if (!weatherEnabled || weatherKind !== "none") return;
    weatherKind = kind;
    clearTimeout(weatherTimer);
    weatherTimer = setTimeout(() => (weatherKind = "none"), durationMs);
  }

  function cycleWeatherManual() {
    // Manual tap: stop current → start next kind, or toggle off if cycling through all
    clearTimeout(weatherTimer);
    if (weatherKind !== "none") {
      weatherKind = "none";
      return;
    }
    // pick a random kind
    playWeather(WEATHER_KINDS[Math.floor(Math.random() * WEATHER_KINDS.length)], 25000);
  }

  function scheduleWeatherAuto() {
    clearTimeout(weatherAutoTimer);
    // Fire a weather event every 8–18 minutes if enabled
    const delayMs = (8 + Math.random() * 10) * 60_000;
    weatherAutoTimer = setTimeout(() => {
      if (weatherEnabled && weatherKind === "none" && phase === "home") {
        const kind = WEATHER_KINDS[Math.floor(Math.random() * WEATHER_KINDS.length)];
        const dur = (20 + Math.random() * 10) * 1000; // 20–30 sec
        playWeather(kind, dur);
        // chain the next event after this one clears
        setTimeout(scheduleWeatherAuto, dur + 2000);
      } else {
        scheduleWeatherAuto(); // retry
      }
    }, delayMs);
  }

  async function toggleFocus() {
    focusMode = !focusMode;
    setFocus(focusMode);
    await setMeta("focus_mode", focusMode ? "1" : "0");
    if (!focusMode) say("I'm here if you need me.", 5000);
  }

  // ---- companionship mode: user-controlled presence level ----
  let companionMode = $state<CompanionMode>("default");
  const MODE_CYCLE: CompanionMode[] = ["default", "just_there", "fun"];
  async function cycleMode() {
    const next = MODE_CYCLE[(MODE_CYCLE.indexOf(companionMode) + 1) % MODE_CYCLE.length];
    companionMode = next;
    setMode(next);
    await setMeta("companion_mode", next);
    poke();
    // a single quiet line confirming the switch (skips Just-There — it should stay silent)
    if (next !== "just_there") say(modeLines[next], 4500);
  }

  function runDelight(kind: "star" | "rain" | "fireworks", ms: number) {
    if (delight !== "none") return;
    delight = kind;
    clearTimeout(delightTimer);
    delightTimer = setTimeout(() => (delight = "none"), ms);
  }

  // For BIG celebrations: fires repeated bursts of `kind` every 2.5s for `totalMs`.
  // Each burst is a fresh animation so it never gets stuck on the guard.
  let _burstInterval = $state<ReturnType<typeof setInterval> | undefined>(undefined);
  let _burstEndTimer: ReturnType<typeof setTimeout> | undefined;
  function runDelightBurst(kind: "star" | "fireworks", totalMs: number, burstMs = 2500) {
    clearInterval(_burstInterval);
    clearTimeout(_burstEndTimer);
    // fire immediately
    delight = kind;
    clearTimeout(delightTimer);
    delightTimer = setTimeout(() => (delight = "none"), burstMs - 200);
    // keep firing for totalMs
    _burstInterval = setInterval(() => {
      delight = "none";
      requestAnimationFrame(() => {
        delight = kind;
        clearTimeout(delightTimer);
        delightTimer = setTimeout(() => (delight = "none"), burstMs - 200);
      });
    }, burstMs);
    _burstEndTimer = setTimeout(() => {
      clearInterval(_burstInterval);
      _burstInterval = undefined;
      delight = "none";
    }, totalMs);
  }

  // Manual celebrate: 60s fireworks + the pet parties alongside you.
  async function celebrate() {
    if (phase !== "home") return;
    poke();
    runDelightBurst("fireworks", 60_000);
    if (!focusMode) shipFanfare();
    // pet goes happy
    petState = "happy";
    setTimeout(() => (petState = "idle"), 1200);
    // say something genuinely excited
    say(pick(musicHypeLines), 8000);
    // pet does zoomies + spin + jump to match the energy
    await new Promise((r) => setTimeout(r, 400));
    for (let i = 0; i < 3; i++) {
      if (phase !== "home") break;
      startMove("run");
      await new Promise((r) => setTimeout(r, moveDur * 1000 + 160));
    }
    doOneShot("spin");
    await new Promise((r) => setTimeout(r, 800));
    doOneShot("jump");
  }

  const MOOD_COLORS: Record<Mood, string> = {
    good: "#6fcf5f",
    stressed: "#d56723",
    tired: "#9fe8f0",
    low: "#7a86c9",
    frustrated: "#e3554d",
    uncertain: "#a890f0"
  };
  let soundPanel = $state(false);
  let vols = $state(getVolumes());
  let volTimer: ReturnType<typeof setTimeout> | undefined;
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;

  async function toggleMute() {
    muted = !muted;
    setSoundEnabled(!muted);
    await setMeta("muted", muted ? "1" : "0");
  }

  function setVol(ch: Channel, v: number) {
    vols = { ...vols, [ch]: v };
    setVolume(ch, v);
    clearTimeout(volTimer);
    volTimer = setTimeout(() => {
      setMeta(`vol_${ch}`, String(v));
    }, 350);
  }

  // ---- pet direction hint from radial menu hover ----
  function onRadialDirHint(d: 1 | -1 | 0) {
    if (d !== 0) dir = d;
  }

  // ---- wild visitor: a random Pokémon wanders through, then leaves ----
  let visitor = $state<{
    entry: DexEntry;
    x: number;
    flip: boolean;
    shiny: boolean;
  } | null>(null);

  function spawnVisitor() {
    if (visitor || busy()) return;
    const entry = randomEntry(dexId);
    const side = Math.random() < 0.5 ? -1 : 1; // which edge it enters from
    const startX = side * (winW / 2 + 90);
    const stopX = side * Math.max(70, Math.round(imgSize * 0.8));
    const shinyVisit = Math.random() < 1 / 128;
    visitor = { entry, x: startX, flip: side === -1, shiny: shinyVisit };
    setTimeout(() => {
      if (visitor) visitor = { ...visitor, x: stopX }; // walks in
    }, 60);
    dir = side as 1 | -1; // the pet turns to look
    setTimeout(() => visitor && playCry(visitor.entry.id, 0.45), 1700);
    if (Math.random() < 0.5 || shinyVisit) {
      setTimeout(
        () =>
          say(
            `${shinyVisit ? "✨ A shiny" : "A wild"} ${displayName(entry.name)} wandered by…`,
            6000
          ),
        1500
      );
    }
    setTimeout(() => {
      if (visitor) visitor = { ...visitor, x: startX, flip: side === 1 }; // wanders off
    }, 7000);
    setTimeout(() => (visitor = null), 9000);
  }

  // ---- wander state ----
  let petX = $state(0);
  let dir = $state<1 | -1>(-1); // -1 = facing left (sprite default), 1 = facing right
  let moving = $state(false);
  let running = $state(false);
  let hopping = $state(false);
  let moveDur = $state(0.5);
  let moveEndTimer: ReturnType<typeof setTimeout> | undefined;
  let oneShot = $state<"none" | "jump" | "spin" | "dust" | "blink" | "tilt" | "perk">("none");
  let butterfly = $state<{ from: number; to: number; dur: number } | null>(null);

  // ---- attack state ----
  let attacking = $state(false);
  let attackMove = $state<Move | null>(null);
  let atkKind = $state<AnimKind | null>(null);
  let particles = $state<Particle[]>([]);

  // ---- head-tracking: the pet leans toward the cursor ("it's watching you") ----
  let lookX = $state(0);
  let lookY = $state(0);
  let lookTilt = $state(0);
  let lookTimer: ReturnType<typeof setTimeout> | undefined;
  function trackLook(e: PointerEvent) {
    if (petState === "sleeping" || attacking) return;
    const cx = window.innerWidth / 2 + petX;
    const cy = window.innerHeight * 0.52;
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2 || 1)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2 || 1)));
    lookX = +(nx * 6).toFixed(1);
    lookTilt = +(nx * 5).toFixed(1);
    lookY = +Math.max(-2, Math.min(4, ny * 4)).toFixed(1);
    clearTimeout(lookTimer);
    lookTimer = setTimeout(resetLook, 2400); // settle back if the cursor goes still
  }
  function resetLook() {
    lookX = 0;
    lookY = 0;
    lookTilt = 0;
  }

  // ---- auto-switch ----
  let autoMinutes = $state(0);
  let autoMode = $state<"random" | "evolve">("random");

  // ---- pet size / window fit ----
  let scale = $state(1.5);
  let winW = $state(360);
  const imgSize = $derived(Math.round(110 * scale));
  let scaleTimer: ReturnType<typeof setTimeout> | undefined;
  let winSf = 1; // device pixel ratio, cached
  let lastSetW = 360; // last logical width WE set — to ignore our own resizes
  let resizeUnlisten: (() => void) | undefined;

  function targetDims() {
    const img = Math.round(110 * scale);
    // hug the pet vertically; the floor only keeps panels (which scroll) usable
    return { w: Math.max(320, img + 200), h: Math.max(340, img + 150) };
  }

  /** Inverse of targetDims width → pet scale (drag-resize maps window back to pet). */
  function scaleFromW(w: number): number {
    return Math.min(3, Math.max(0.5, Math.round(((w - 200) / 110) * 100) / 100));
  }

  /** Grab the corner grip → native edge resize; the pet scales to follow (see onResized). */
  async function beginResize(e: PointerEvent) {
    if (e.button !== 0 || phase !== "home" || battleOpen) return;
    e.preventDefault();
    try {
      await getCurrentWindow().startResizeDragging("SouthEast");
    } catch {
      // resize-dragging unavailable (e.g. web preview) — buttons/scroll still work
    }
  }

  /** Resize the window to fit the pet; keep it visually anchored. */
  async function fitWindow(anchorBottomRight = false) {
    try {
      const win = getCurrentWindow();
      const sf = await win.scaleFactor();
      const { w, h } = targetDims();
      const pw = Math.round(w * sf);
      const ph = Math.round(h * sf);
      const oldPos = await win.outerPosition();
      const oldSize = await win.outerSize();
      await win.setSize(new PhysicalSize(pw, ph));
      if (anchorBottomRight) {
        const mon = await currentMonitor();
        if (mon) {
          await win.setPosition(
            new PhysicalPosition(
              mon.position.x + mon.size.width - pw - 24,
              mon.position.y + mon.size.height - ph - 88
            )
          );
        }
      } else {
        // hold the bottom-center steady so resizing feels in-place
        await win.setPosition(
          new PhysicalPosition(
            oldPos.x + Math.round((oldSize.width - pw) / 2),
            oldPos.y + (oldSize.height - ph)
          )
        );
      }
      winW = w;
      lastSetW = w;
    } catch {
      // sizing is cosmetic; never break the app over it
    }
  }

  function nudgeScale(delta: number) {
    scale = Math.min(3, Math.max(0.5, Math.round((scale + delta) * 100) / 100));
    clearTimeout(scaleTimer);
    scaleTimer = setTimeout(async () => {
      await setMeta("pet_scale", String(scale));
      await fitWindow(false);
    }, 250);
  }

  // Aliveness: while idle, the pet's facing follows the mouse cursor — a cheap,
  // strong "it's watching me" cue. Throttled; ignored when busy/onboarding.
  let lastLook = 0;
  function onMouseLook(e: MouseEvent) {
    if (!idleNow) return;
    const now = Date.now();
    if (now - lastLook < 130) return;
    lastLook = now;
    const petScreenX = winW / 2 + petX;        // pet centre in window coords
    const want: 1 | -1 = e.clientX < petScreenX ? -1 : 1;
    if (want !== dir) dir = want;
  }

  function onWheel(e: WheelEvent) {
    if (phase !== "home" || panel !== "none" || battleOpen) return;
    e.preventDefault();
    nudgeScale(e.deltaY < 0 ? 0.1 : -0.1);
  }

  /** Grab the empty area (the "box" around the pet) to move the window. */
  // shared by Classic (draglayer) and Alive (Pixi background) — drag the window
  async function beginWindowDrag() {
    poke();
    try {
      const win = getCurrentWindow();
      await win.startDragging();
      const savePos = async () => {
        try {
          const pos = await win.outerPosition();
          await setMeta("win_x", String(pos.x));
          await setMeta("win_y", String(pos.y));
        } catch { /* ignore */ }
        window.removeEventListener("pointerup", savePos);
      };
      window.addEventListener("pointerup", savePos, { once: true });
    } catch {
      // dragging unavailable in web preview
    }
  }
  function startWinDrag(e: PointerEvent) {
    if (e.button !== 0) return;
    void beginWindowDrag();
  }

  // ---- one-tap pet from radial menu ----
  function petOnce() {
    onPetStroke(); // reuse the same affection logic
  }

  // ---- petting reaction (called from Pet while you stroke it) ----
  let petAffection = 0;
  let lastPetCry = 0;
  function onPetStroke() {
    poke();
    petAffection += 1;
    if (petAffection % 6 === 0) {
      bumpCounter("interactions");
      void bumpCounter("t_aff"); // drift: affectionate temperament
    }
    // a soft happy cry / line now and then while petting — never spammy
    if (Date.now() - lastPetCry > 6000) {
      lastPetCry = Date.now();
      if (Math.random() < 0.5) voiceCry(dexId, displayName(dexEntry(dexId)?.name ?? petName), 0.18);
      else if (Math.random() < 0.5) say(pick(pettingLines), 3500);
    }
  }

  // ---- feeding: Poké food is tossed in and arcs toward the pet, who eats it ----
  // Poffins / berries / curry-bowl — the snacks Pokémon actually eat in the games.
  const POKE_FOOD = ["🍙", "🫐", "🍡", "🥣", "🧁", "🍃"];
  let treat = $state<{ from: number; to: number; food: string } | null>(null);
  let eating = $state(false);
  function feed() {
    if (treat || switchFx !== "none" || evoActive || evoOffer || battleOpen || moving) return;
    poke();
    if (petState === "sleeping") petState = "idle";
    const side = Math.random() < 0.5 ? -1 : 1; // food comes from one edge…
    dir = side as 1 | -1; // …and the pet turns to watch it
    treat = { from: side * (winW / 2 + 70), to: petX, food: pick(POKE_FOOD) };
    setTimeout(() => {
      treat = null;
      eating = true; // chomp animation
      setTimeout(() => (eating = false), 900);
      bumpCounter("interactions");
      void bumpCounter("t_aff"); // drift: affectionate temperament
      if (Math.random() < 0.6) voiceCry(dexId, displayName(dexEntry(dexId)?.name ?? petName), 0.2);
      say(pick(treatLines), 5000);
    }, 760);
  }

  // ---- battle mode: widen the window for the arena, restore after ----
  async function openBattle() {
    panel = "none";
    battleOpen = true;
    poke();
    try {
      const win = getCurrentWindow();
      const sf = await win.scaleFactor();
      const pw = Math.round(620 * sf);
      const ph = Math.round(400 * sf);
      const oldPos = await win.outerPosition();
      const oldSize = await win.outerSize();
      await win.setSize(new PhysicalSize(pw, ph));
      await win.setPosition(
        new PhysicalPosition(
          oldPos.x + Math.round((oldSize.width - pw) / 2),
          oldPos.y + (oldSize.height - ph)
        )
      );
    } catch {
      // arena still works in a small window
    }
  }

  async function closeBattle() {
    battleOpen = false;
    await fitWindow(false);
  }

  function say(line: string, ms = 8000) {
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubble = line;
    bubbleTimer = setTimeout(() => (bubble = ""), ms);
  }

  // ---- soft failure recovery ----
  // When something genuinely breaks (db hiccup, weather glitch, unexpected throw),
  // the pet notices warmly instead of breaking silently or flashing a raw error.
  // Hard rate-limit so a flurry of errors never turns into nagging.
  const SOFT_FAIL_COOLDOWN = 5 * 60_000;
  let lastSoftFail = 0;
  function softFail(err?: unknown) {
    console.warn("[hearthmon] soft fail:", err);
    if (Date.now() - lastSoftFail < SOFT_FAIL_COOLDOWN) return;
    lastSoftFail = Date.now();
    if (phase === "home") say(pick(softFailLines), 6000);
  }

  // bond-tier ceremony banner (set when the bond deepens between launches)
  let bondCeremony = $state<string | null>(null);
  let birthday = $state(false); // party hat for the day-we-met anniversary
  let breakthroughActive = $state(false);

  // bridge every pet-attached FX into the Alive (Pixi) renderer — one brain, two skins
  const aliveFx = $derived({
    switchFx,
    attacking,
    atkKind,
    atkColor: attackMove?.color ?? "#ffffff",
    atkEmoji: attackMove?.emoji ?? "✨",
    atkName: attackMove?.name ?? "",
    atkCls: (attackMove?.cls ?? 2) as 1 | 2 | 3,
    dir,
    evoActive,
    evoShowNew,
    evoFlash,
    evoTarget,
    visitorId: visitor?.entry.id ?? null,
    visitorShiny: visitor?.shiny ?? false,
    visitorX: visitor?.x ?? 0,
    visitorFlip: visitor?.flip ?? false,
    eating,
    birthday,
    breakthrough: breakthroughActive
  });

  // ---- command palette (global Alt+Space): Raycast-for-emotions ----
  let cmdOpen = $state(false);
  const CMD_KINDS: Record<string, MemoryKind> = {
    w: "win", win: "win",
    l: "learned", learned: "learned",
    s: "survived", survived: "survived",
    p: "praise", praise: "praise"
  };
  const CMD_MOODS = ["good", "stressed", "tired", "low", "frustrated", "uncertain"];

  async function openCommand() {
    if (phase !== "home") return;
    try {
      const w = getCurrentWindow();
      await w.show();
      await w.unminimize();
      await w.setFocus();
    } catch {
      /* window ops are best-effort */
    }
    cmdOpen = true;
  }

  // Parse a quick line and route it to the same log/mood handlers the panels use.
  async function runCommand(raw: string) {
    cmdOpen = false;
    const text = raw.trim();
    if (!text) return;
    const sp = text.indexOf(" ");
    const verb = (sp === -1 ? text : text.slice(0, sp)).toLowerCase();
    const rest = sp === -1 ? "" : text.slice(sp + 1).trim();

    // "fix …" → log a win + the bug-fix flourish
    if ((verb === "f" || verb === "fix") && rest) {
      await addMemory("win", { text: rest });
      await bumpCounter("interactions");
      reactGit("fix");
      return;
    }
    // "mood low …" → a mood check-in
    if (verb === "m" || verb === "mood") {
      const mood = CMD_MOODS.find((x) => rest.toLowerCase().startsWith(x)) as Mood | undefined;
      if (mood) {
        await onMoodSave(mood, rest.slice(mood.length).trim());
        return;
      }
    }
    // "win/learned/survived/praise …"
    if (CMD_KINDS[verb] && rest) {
      await onLogSave(CMD_KINDS[verb], rest);
      return;
    }
    // no recognized verb → treat the whole thing as a win
    await onLogSave("win", text);
  }

  // ---- Dream system: while the pet sleeps, soft dream bubbles drift up ----
  // The symbol reflects your real recent life (a struggle survived = 🏔️, a win = 🌅).
  let dreaming = $state<string | null>(null);
  let dreamPool: string[] = ["✨", "🌙", "💫"];
  function dreamSymbol(m: Memory): string {
    if (m.kind === "survived") return "🏔️";
    if (m.kind === "win") return "🌅";
    if (m.kind === "learned") return "📘";
    if (m.kind === "praise") return "💗";
    if (m.kind === "seed") return "🌱";
    if (m.kind === "mood") return m.mood === "good" ? "☀️" : m.mood === "low" ? "🌧️" : "💭";
    return "✨";
  }
  function dreamTick() {
    if (petState !== "sleeping" || dreaming || focusMode) return;
    if (Math.random() < 0.45) {
      dreaming = dreamPool[Math.floor(Math.random() * dreamPool.length)] ?? "✨";
      setTimeout(() => (dreaming = null), 5200);
    }
  }

  // ---- Toddler Mode: the pet roams your actual monitor ----
  // Moves the OS window in stepped "walks", always clamped to the monitor work
  // area so it can never fly off-screen. Alt+W (or the Roam toggle) brings it home.
  let toddler = $state(false);
  let toddlerTimer: ReturnType<typeof setInterval> | undefined;
  const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  async function walkWindowTo(x1: number, y1: number) {
    const win = getCurrentWindow();
    const p0 = await win.outerPosition();
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      if (!toddler) return;
      const t = i / steps;
      const e = t * t * (3 - 2 * t); // smoothstep
      await win.setPosition(
        new PhysicalPosition(Math.round(p0.x + (x1 - p0.x) * e), Math.round(p0.y + (y1 - p0.y) * e))
      );
      await new Promise((r) => setTimeout(r, 28));
    }
  }

  async function toddlerHop() {
    if (!toddler || !idleNow) return; // never fight the user mid-interaction
    try {
      const win = getCurrentWindow();
      const mon = await currentMonitor();
      if (!mon) return;
      const size = await win.outerSize();
      const pos = await win.outerPosition();
      const minX = mon.position.x;
      const minY = mon.position.y;
      const maxX = mon.position.x + mon.size.width - size.width;
      const maxY = mon.position.y + mon.size.height - size.height;
      const far = Math.random() < 0.3; // mostly small shuffles, sometimes a long walk
      const rngX = mon.size.width * (far ? 0.6 : 0.22);
      const rngY = mon.size.height * (far ? 0.3 : 0.12);
      const tx = Math.round(clampN(pos.x + (Math.random() * 2 - 1) * rngX, minX, maxX));
      const ty = Math.round(clampN(pos.y + (Math.random() * 2 - 1) * rngY, minY, maxY));
      dir = tx >= pos.x ? 1 : -1; // face the way it's heading
      await walkWindowTo(tx, ty);
    } catch {
      /* window ops best-effort */
    }
  }

  async function returnHome() {
    try {
      const win = getCurrentWindow();
      const mon = await currentMonitor();
      if (!mon) return;
      const size = await win.outerSize();
      const x = mon.position.x + Math.round((mon.size.width - size.width) / 2);
      const y = mon.position.y + Math.round((mon.size.height - size.height) / 2);
      await win.show();
      await win.setPosition(new PhysicalPosition(x, y));
      poke();
      if (!focusMode) say("Coming home!", 3000);
    } catch {
      /* ignore */
    }
  }

  async function toggleToddler() {
    toddler = !toddler;
    await setMeta("toddler", toddler ? "1" : "0");
    clearInterval(toddlerTimer);
    if (toddler) {
      toddlerTimer = setInterval(() => void toddlerHop(), 6500);
      if (!focusMode) say("Going exploring! Alt+W brings me home.", 6000);
    }
    poke();
  }

  // ---- coding awareness: react to commits ----
  // Two sources, pick one: a LOCAL folder (instant, via the Rust reflog watcher)
  // or a GitHub URL (polls the API every few min — catches pushes from anywhere).
  let watchingRepo = $state("");     // local folder path
  let watchingRemote = $state("");   // github url
  let petPersona = $state<Persona | null>(null); // emergent personality (for the card)
  let petTemperament = $state<Temperament | null>(null); // drift: shaped by how you interact
  let tempPlay = $state(false); // dominant trait → subtly biases the wander
  let tempCalm = $state(false);
  let bondTierNow = $state(0); // current bond tier (lantern warmth in the habitat)
  let room = $state("none"); // habitat: "none" | "full" | "sphere" | "square" (shape ≠ backdrop)
  const habitatOn = $derived(room !== "none");
  const habitatShape = $derived(room === "none" ? "full" : (room as "full" | "sphere" | "square"));
  // the habitat is chosen by the pet's primary type — a Tiny Living Sanctuary
  const currentBiome = $derived(biomeForType(curType));
  // the lantern (identity prop) glows warmer the deeper the bond
  const lanternGlow = $derived(Math.min(1, 0.4 + bondTierNow * 0.12));
  // ambient particle slots — fixed positions/timings so they don't re-seed on
  // every render. The KIND (firefly/ember/snow/star/…) comes from the biome.
  const PARTICLES = [
    { i: 0, x: 22, y: 34, s: 3, d: 0, dur: 11 },
    { i: 1, x: 38, y: 52, s: 2, d: 3.5, dur: 14 },
    { i: 2, x: 55, y: 40, s: 3, d: 6, dur: 12 },
    { i: 3, x: 68, y: 58, s: 2, d: 1.8, dur: 15 },
    { i: 4, x: 80, y: 36, s: 3, d: 8, dur: 13 },
    { i: 5, x: 47, y: 64, s: 2, d: 4.5, dur: 16 },
    { i: 6, x: 30, y: 70, s: 2, d: 10, dur: 13 },
    { i: 7, x: 72, y: 72, s: 2, d: 6.5, dur: 17 }
  ];

  async function cycleRoom() {
    // none → full → sphere → square → none
    room = room === "none" ? "full" : room === "full" ? "sphere" : room === "sphere" ? "square" : "none";
    await setMeta("room", room);
    poke();
    say(room === "none" ? "Back to open sky." : room === "full" ? `${currentBiome.name}.` : `${currentBiome.name} · ${room}.`, 4500);
  }
  // github handle for Showcase, derived from whatever remote is set
  const ghHandle = $derived.by(() => {
    const t = parseGitHub(watchingRemote);
    if (!t) return "";
    return t.kind === "user" ? t.id : t.id.split("/")[0];
  });
  const FIX_RE = /\b(fix(e[sd])?|bug|hotfix|patch|resolve[sd]?|close[sd]?|squash)\b/i;
  const MILESTONES = [10, 25, 50, 100, 250, 500, 1000];
  type GitKind = "commit" | "fix" | "pr" | "release" | "repo" | "milestone";
  let lastCommitReact = 0;

  // One place that turns a git activity into a reaction: a quick bob, a cue
  // sound, a matching visual, AND the pet speaks a short quip aloud (TTS).
  function reactGit(kind: GitKind, spoken = "") {
    poke();
    if (petState === "idle") {
      petState = "happy";
      setTimeout(() => (petState = "idle"), 900);
    }
    if (focusMode || companionMode === "just_there") return; // stay quiet
    // throttle so a burst (rebase / many events) can't spam
    if (Date.now() - lastCommitReact < 15_000) return;
    lastCommitReact = Date.now();

    let line = spoken;
    switch (kind) {
      case "fix":       line ||= pick(fixQuips);       runDelight("star", 2400);     fixFanfare();        break;
      case "pr":        line ||= pick(prQuips);        runDelightBurst("fireworks", 60_000); shipFanfare();       break;
      case "release":   line ||= pick(releaseQuips);   runDelightBurst("fireworks", 60_000); shipFanfare();       break;
      case "repo":      line ||= pick(newRepoQuips);   runDelight("star", 2600);     newRepoChime();      break;
      case "milestone": line ||= "Look how far we've come."; runDelightBurst("fireworks", 60_000); milestoneFanfare(); break;
      default:          line ||= pick(commitQuips);                                   commitChime();       break;
    }
    say(line, 6000);  // show in the bubble
    announce(line);   // and speak it aloud (Microsoft voice)
  }

  // ---- Build / Training awareness (System 2): watch the GPU via nvidia-smi ----
  type GpuStat = {
    available: boolean;
    util: number;
    mem_used: number;
    mem_total: number;
    temp: number;
    procs: number;
  };
  let gpu = $state<GpuStat | null>(null); // latest reading (for the readout)
  let gpuAvailable = $state(false); // an NVIDIA GPU + nvidia-smi were found
  let trainAware = $state(true); // user toggle (persisted)
  let gpuTimer: ReturnType<typeof setInterval> | undefined;
  let trainingActive = false; // a run is currently in progress
  let trainStart = 0;
  let lastHeavyCue = 0;

  async function pollGpu() {
    if (!trainAware) return;
    let s: GpuStat;
    try {
      s = await invoke<GpuStat>("gpu_stat");
    } catch {
      return; // not running under Tauri (web preview) — ignore
    }
    if (!s.available) {
      gpuAvailable = false; // no NVIDIA GPU — stop polling, never nag
      if (gpuTimer) {
        clearInterval(gpuTimer);
        gpuTimer = undefined;
      }
      return;
    }
    gpuAvailable = true;
    gpu = s;
    const heavy = s.util >= 90;
    const running = s.procs > 0 && s.util >= 40;

    if (running && !trainingActive) {
      trainingActive = true; // a run just began
      trainStart = Date.now();
      lastHeavyCue = 0;
      trainReact("start");
    } else if (trainingActive && running && heavy && Date.now() - lastHeavyCue > 10 * 60_000) {
      lastHeavyCue = Date.now(); // sustained heavy load — gentle check-in (10-min throttle)
      trainReact("heavy");
    } else if (trainingActive && s.procs === 0 && s.util < 25) {
      trainingActive = false; // the run ended
      if ((Date.now() - trainStart) / 60_000 >= 3) trainReact("done"); // only a real session
    }
  }

  type TrainKind = "start" | "heavy" | "progress" | "done" | "crash";
  function trainReact(kind: TrainKind) {
    poke();
    const celebrate = () => {
      if (petState === "idle") {
        petState = "happy";
        setTimeout(() => (petState = "idle"), 900);
      }
    };
    if (focusMode || companionMode === "just_there") {
      if (kind === "done") celebrate(); // light up but stay quiet
      return;
    }
    let line = "";
    switch (kind) {
      case "start": line = pick(trainStartLines); break;
      case "heavy": line = pick(trainHeavyLines); break;
      case "progress": line = pick(trainProgressLines); break;
      case "done":
        line = pick(trainDoneLines);
        celebrate();
        runDelightBurst("fireworks", 60_000);
        shipFanfare();
        break;
      case "crash":
        line = pick(trainCrashLines);
        runDelight("rain", 2400); // a soft, sympathetic cue — never fireworks
        break;
    }
    say(line, kind === "done" || kind === "crash" ? 9000 : 7000);
    announce(line);
  }

  async function setTrainAware(on: boolean) {
    trainAware = on;
    await setMeta("train_aware", on ? "1" : "0");
    if (on && !gpuTimer) {
      gpuTimer = setInterval(() => void pollGpu(), 5000);
      void pollGpu();
    }
  }

  // ---- log-watch: tail a training log → epoch / loss / done / crash ----
  let logPath = $state(""); // watched file or folder ("" = off)
  let trainFile = $state(""); // the concrete run file being followed
  let trainEpoch = $state(0);
  let trainLoss = $state<number | null>(null);
  let lastProgressCue = 0;
  const RE_EPOCH = /\bepoch\s*[:#]?\s*(\d+)/i;
  const RE_LOSS = /\bloss[\s:=]+([0-9]*\.?[0-9]+)/i;
  const RE_DONE = /(training complete|training finished|finished training|run complete|done training|best model saved|saved final|✓\s*done)/i;
  const RE_CRASH = /(traceback \(most recent call last\)|out of memory|cuda error|runtimeerror|\bexception\b|\berror:|process killed|\bkilled\b|loss is nan|nan loss)/i;

  const trainStatus = $derived(
    !logPath
      ? ""
      : trainingActive
        ? `running${trainFile ? ` · ${trainFile}` : ""}${trainEpoch ? ` · epoch ${trainEpoch}` : ""}${trainLoss != null ? ` · loss ${trainLoss}` : ""}`
        : "watching for a run…"
  );

  function onNewRun(name: string) {
    trainFile = name;
    trainingActive = true;
    trainStart = Date.now();
    trainEpoch = 0;
    trainLoss = null;
    lastProgressCue = Date.now();
    trainReact("start");
  }

  function onTrainLine(line: string) {
    if (!trainAware) return;
    if (RE_CRASH.test(line)) {
      if (trainingActive) {
        trainingActive = false;
        trainReact("crash");
      }
      return;
    }
    if (RE_DONE.test(line)) {
      if (trainingActive) {
        trainingActive = false;
        trainReact("done");
      }
      return;
    }
    const mE = line.match(RE_EPOCH);
    if (mE) {
      trainingActive = true; // a run is clearly underway
      trainEpoch = Number(mE[1]);
    }
    const mL = line.match(RE_LOSS);
    if (mL) trainLoss = Number(Number(mL[1]).toFixed(4));
    // occasional encouragement on an epoch tick (90s throttle)
    if (mE && Date.now() - lastProgressCue > 90_000) {
      lastProgressCue = Date.now();
      trainReact("progress");
    }
  }

  async function setLogPath(path: string) {
    const p = path.trim();
    if (!p) return;
    try {
      await invoke("log_set_path", { path: p });
      logPath = p;
      await setMeta("train_log_path", p);
      say("Watching that log. I'll follow your runs.", 4500);
    } catch (e) {
      say(typeof e === "string" ? e : "Couldn't watch that path.", 5000);
    }
  }
  async function stopLog() {
    try {
      await invoke("log_clear");
    } catch { /* not under Tauri */ }
    logPath = "";
    trainFile = "";
    trainingActive = false;
    await setMeta("train_log_path", "");
  }

  // ---- Builder CONTEXT Engine: infer CONTEXT (never emotion) from many weak,
  // privacy-safe signals, and respond with gentle PROBABILITY — never certainty.
  // The superpower isn't "it knows what I feel"; it's "it quietly notices how
  // hard I'm trying." So we only act when several weak signals ALIGN, and we
  // speak observationally ("this one seems stubborn"), never "you're frustrated".
  const FLOW_GAP = 8 * 60_000; // a quiet stretch this long ends the work burst
  const FLOW_MIN_SAVES = 4;
  const FLOW_MIN_MS = 6 * 60_000;
  const FLOW_DECAY = 4 * 60_000; // flow fades this long after the last save
  const BREAKTHROUGH_MS = 12 * 60_000; // a commit after this much churn = hard-won
  let lastSaveAt = 0;
  let workStart = 0;
  let saveCount = 0;
  let flowSaid = false;
  let lastFlowCue = 0;
  let lastFrictionCue = $state(0);
  // foreground-app rhythm (process NAMES only — never titles/keystrokes/content)
  let flowAware = $state(true);
  let curCat = ""; // editor / terminal / browser / other
  let curCatSince = 0;
  let switchTimes: number[] = []; // recent app-switch timestamps

  const activeNow = () => Date.now() - lastSaveAt < FLOW_DECAY;
  // deep focus = sustained editing OR a long editor/terminal dwell (no commits needed)
  const flowActive = () => activeNow() && saveCount >= FLOW_MIN_SAVES;
  const editorFlow = () =>
    (curCat === "editor" || curCat === "terminal") && Date.now() - curCatSince > FLOW_MIN_MS;
  const deepWork = () => flowActive() || editorFlow();
  // waiting mode (the ML moat): a run is going and you've stepped back — keep watch
  const waitingMode = () => trainingActive && Date.now() - lastSaveAt > 5 * 60_000;

  // FRICTION confidence (0..1) — fused from weak signals so a tutorial or doc-read
  // (no saves) never trips it. Only real building does.
  function frictionConfidence(): { c: number; bouncing: boolean } {
    const now = Date.now();
    if (!activeNow()) return { c: 0, bouncing: false };
    const thrash = switchTimes.filter((t) => now - t < 3 * 60_000).length;
    const burstMin = workStart ? (now - workStart) / 60_000 : 0;
    let c = 0;
    if (saveCount >= 4) c += 0.3; // you're actually EDITING (not watching)
    if (burstMin >= 20) c += 0.25; // sustained at it
    if (thrash >= 4) c += 0.3; // bouncing between apps
    if (saveCount >= 8 && burstMin >= 25) c += 0.15; // grinding
    return { c, bouncing: thrash >= 4 };
  }

  // evaluate context after any signal; act only on aligned, high-confidence friction
  function evalContext() {
    const now = Date.now();
    const { c, bouncing } = frictionConfidence();
    if (c >= 0.7 && now - lastFrictionCue > 60 * 60_000 && !focusMode && companionMode !== "just_there") {
      lastFrictionCue = now;
      fidget("perk"); // the pet just moves a little closer
      const l = pick(bouncing ? frictionBounceLines : frictionStuckLines);
      say(l, 8000);
      announce(l);
    }
  }

  // foreground app changed — update rhythm, then re-evaluate context
  function onFocusApp(cat: string) {
    if (!flowAware) return;
    const now = Date.now();
    if (cat === curCat) return;
    switchTimes.push(now);
    switchTimes = switchTimes.filter((t) => now - t < 3 * 60_000);
    curCat = cat;
    curCatSince = now;
    evalContext();
  }

  async function setFlowAware(on: boolean) {
    flowAware = on;
    await setMeta("flow_aware", on ? "1" : "0");
    try {
      await invoke("set_flow_aware", { on });
    } catch {
      /* not under Tauri */
    }
  }

  // ── Music awareness (opt-in): the companion subtly vibes with your system audio ─
  // Only ephemeral energy bands arrive from Rust (bass/mid/high/level) — never audio.
  // Companion first, visualizer second: energy nudges idle softly; beats are WEIGHTED
  // so most pass as invisible influence and only some become a tiny delight.
  let audioAware = $state(false);
  let audioEnergy = $state(0); // smoothed overall loudness 0..1
  let audioBeat = $state(0); // increments on each detected beat (PixiStage reacts)
  let audioStrength = $state(0); // 0..1 strength of the latest beat (drops ≈ 1)
  let _bassAvg = 0;
  let _lastBeatAt = 0;
  let _musicSlow = 0; // slow EMA (~3s) of loudness → calm vs hype classification
  let lastMusicLineAt = 0;
  // current vibe mode set when a music line fires — drives vibeTick animations for 30s
  let musicVibe = $state<"none" | "calm" | "chill" | "hype">("none");
  let musicVibeTimer: ReturnType<typeof setTimeout> | undefined;
  // sub-timers that sustain a single picked reaction for ~10s before choosing the next
  let vibeReactionTimer: ReturnType<typeof setInterval> | undefined;
  let vibeReactionEndTimer: ReturnType<typeof setTimeout> | undefined;
  function clearVibeReaction() {
    clearInterval(vibeReactionTimer);
    clearTimeout(vibeReactionEndTimer);
    vibeReactionTimer = undefined;
  }
  function onAudioBands(b: number, m: number, _h: number, lvl: number) {
    audioEnergy = +(audioEnergy + 0.18 * (lvl - audioEnergy)).toFixed(3);
    _musicSlow += 0.01 * (lvl - _musicSlow);
    _bassAvg += 0.08 * (b - _bassAvg); // running bass floor
    const now = performance.now();
    // onset: a bass spike above the floor, with a refractory gap (no 140bpm seizure)
    if (b > _bassAvg * 1.35 + 0.06 && now - _lastBeatAt > 180) {
      _lastBeatAt = now;
      audioStrength = Math.min(1, (b - _bassAvg) / Math.max(0.12, _bassAvg)) * (0.6 + 0.4 * m);
      audioBeat++;
    }
  }
  async function setAudioAware(on: boolean) {
    audioAware = on;
    await setMeta("audio_aware", on ? "1" : "0");
    try { await invoke("set_audio_aware", { on }); } catch { /* not under Tauri */ }
    if (!on) { audioEnergy = 0; audioStrength = 0; }
  }
  // ~30s: a short, grounded line about whatever's playing — calm vs hype by energy.
  // Also kicks off a 30s vibe mode that drives matching animations via vibeTick.
  function maybeMusicLine() {
    if (!audioAware || audioEnergy < 0.06) return;
    if (phase !== "home" || battleOpen || evoActive || evoOffer || switchFx !== "none") return;
    if (focusMode || petState === "sleeping" || panel !== "none") return;
    if (Date.now() - lastMusicLineAt < 28_000) return;
    lastMusicLineAt = Date.now();
    const kind = _musicSlow > 0.45 ? "hype" : _musicSlow < 0.22 ? "calm" : "chill";
    const bank = kind === "hype" ? musicHypeLines : kind === "calm" ? musicCalmLines : musicChillLines;
    say(pick(bank), 7000);
    // enter vibe mode for 30s; clear any running reaction so a fresh one picks immediately
    clearTimeout(musicVibeTimer);
    clearVibeReaction();
    musicVibe = kind;
    musicVibeTimer = setTimeout(() => { musicVibe = "none"; clearVibeReaction(); }, 30_000);
  }

  // Sustains a picked reaction for 10s by repeating `action` every `repeatMs`.
  // Outer vibeTick skips while vibeReactionTimer is set, so reactions don't overlap.
  function startVibeReaction(action: () => void, repeatMs: number) {
    clearVibeReaction();
    action();
    vibeReactionTimer = setInterval(() => { if (!busy()) action(); }, repeatMs);
    vibeReactionEndTimer = setTimeout(clearVibeReaction, 10_000);
  }

  // Called every 2.5s — picks a reaction and locks it in for 10s via startVibeReaction.
  // Does nothing if a reaction is already running or the pet is in a ceremony/move.
  function vibeTick() {
    if (musicVibe === "none") return;
    if (vibeReactionTimer) return; // mid-reaction, let it run
    if (busy() || petState === "sleeping" || switchFx !== "none" || evoActive || evoOffer || battleOpen) return;
    const r = Math.random();
    if (musicVibe === "calm") {
      // Dreamy, slow: chosen action repeats gently every 2s for 10s
      if (r < 0.30)      startVibeReaction(() => fidget("tilt"),    2000); // slow dreamy sway
      else if (r < 0.50) startVibeReaction(() => fidget("blink"),   2000); // half-lidded blink
      else if (r < 0.60) startVibeReaction(() => startMove("walk"), 3500); // slow dreamy drift
      else if (r < 0.65) runDelight("star", 2600);                         // shooting star
      else if (r < 0.70) runDelight("rain", 9000);                         // soft pixel rain
      // otherwise: still — peaceful silence is part of calm
    } else if (musicVibe === "chill") {
      // Relaxed groove: chosen action repeats every 1.4s for 10s
      if (r < 0.28)      startVibeReaction(() => startMove("hop"),                   1400); // bounce-bop
      else if (r < 0.48) startVibeReaction(() => fidget("perk"),                    1400); // "oh I know this song"
      else if (r < 0.60) startVibeReaction(() => fidget("blink"),                   1400); // relaxed blink
      else if (r < 0.72) startVibeReaction(() => { dir = dir === 1 ? -1 : 1; },    2000); // groove-glance
      else if (r < 0.80) startVibeReaction(() => startMove("walk"),                 2500); // chill stroll
      else if (r < 0.85) runDelight("star", 2600);
    } else if (musicVibe === "hype") {
      // Full energy: chosen action hammers every 0.85s for 10s — the pet is FEELING IT
      if (r < 0.24)      startVibeReaction(() => startMove("run"),                   850); // non-stop sprints
      else if (r < 0.40) startVibeReaction(() => doOneShot("jump"),                  850); // repeat jumps
      else if (r < 0.54) startVibeReaction(() => doOneShot("spin"),                  850); // spin-spin-spin
      else if (r < 0.62) { void zoomies(); }                                               // multi-lap zoomies
      else if (r < 0.72) startVibeReaction(() => startMove("hop"),                 1000); // bounce-dance
      else if (r < 0.80) runDelight("fireworks", 2400);                                   // fireworks!
      else if (r < 0.86) startVibeReaction(() => { dir = dir === 1 ? -1 : 1; },     700); // rapid head-whips
    }
  }

  // a working-tree change (you saved). The strongest "real building" signal.
  function noteBuilderActivity() {
    const now = Date.now();
    if (now - lastSaveAt > FLOW_GAP) {
      workStart = now; // a fresh burst of work
      saveCount = 0;
      flowSaid = false;
    }
    lastSaveAt = now;
    saveCount += 1;
    void bumpEffort(1); // chapter memory: this day's effort density
    // deep-focus onset: said once, then the companionship is the SILENCE
    if (!flowSaid && saveCount >= FLOW_MIN_SAVES && now - workStart > FLOW_MIN_MS) {
      flowSaid = true;
      if (now - lastFlowCue > 3 * 3600_000 && !focusMode && companionMode !== "just_there") {
        lastFlowCue = now;
        say(pick(flowLines), 6000);
      }
    }
    evalContext();
  }

  function reactBreakthrough() {
    poke();
    breakthroughActive = true;
    setTimeout(() => { breakthroughActive = false; }, 2000);
    if (petState === "idle") {
      petState = "happy";
      setTimeout(() => (petState = "idle"), 1100);
    }
    if (focusMode || companionMode === "just_there") return;
    const l = pick(breakthroughLines);
    runDelightBurst("fireworks", 60_000);
    fixFanfare();
    say(l, 9000);
    announce(l);
    void setMeta("bt_day", new Date().toISOString().slice(0, 10)); // flavours today's chapter
    void bumpEffort(15); // a hard-won win weighs heavily toward a chapter
  }

  // A detected commit (local reflog or a remote push). Counts toward milestones.
  async function onCommit(message: string) {
    const n = await bumpCounter("commits");
    // a commit that ENDS a long, high-effort burst is hard-won — celebrate the arc
    const hardWon = workStart > 0 && Date.now() - workStart > BREAKTHROUGH_MS && saveCount >= 5;
    if (MILESTONES.includes(n)) reactGit("milestone", milestoneQuip(n));
    else if (hardWon) reactBreakthrough();
    else reactGit(FIX_RE.test(message) ? "fix" : "commit");
    workStart = 0; // a commit ends the current burst
    saveCount = 0;
    flowSaid = false;
    void bumpProjectDay(); // "alongside you": this counts as a day on the project
    void bumpEffort(5); // chapter memory: commits weigh into the day's density
  }

  // ---- "Alongside you": long-term awareness of the project you keep at ----
  // The active project = the watched local folder's name, or the watched repo.
  const activeProject = $derived.by(() => {
    if (watchingRepo) {
      const parts = watchingRepo.replace(/[\\/]+$/, "").split(/[\\/]/);
      return parts[parts.length - 1] || "";
    }
    const t = parseGitHub(watchingRemote);
    return t?.kind === "repo" ? t.id.split("/")[1] : "";
  });
  const projSlug = (p: string) => p.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // a commit today → count one distinct day on the active project (then re-check
  // whether that crosses an awareness threshold).
  async function bumpProjectDay() {
    const p = activeProject;
    if (!p) return;
    const s = projSlug(p);
    const today = new Date().toISOString().slice(0, 10);
    if ((await getMeta(`proj_${s}_lastday`)) === today) return;
    const days = Number((await getMeta(`proj_${s}_days`)) ?? 0) + 1;
    await setMeta(`proj_${s}_days`, String(days));
    await setMeta(`proj_${s}_lastday`, today);
    if (!(await getMeta(`proj_${s}_first`))) await setMeta(`proj_${s}_first`, today);
    await alongsideCheck();
  }

  // fire the next unseen escalation line for the active project, if earned.
  async function alongsideCheck() {
    const p = activeProject;
    if (!p) return;
    const s = projSlug(p);
    const days = Number((await getMeta(`proj_${s}_days`)) ?? 0);
    const seen = Number((await getMeta(`proj_${s}_stage`)) ?? 0);
    const next = ALONGSIDE_STAGES.filter((x) => x <= days && x > seen).pop();
    if (!next) return;
    await setMeta(`proj_${s}_stage`, String(next));
    if (focusMode || companionMode === "just_there") return; // recorded, stays quiet
    const line = alongsideLine(next, p);
    say(line, 8000);
    announce(line);
  }

  // on launch: if we moved on from a project we stuck with, honour it once;
  // otherwise greet the ongoing one. At most one of these per launch.
  // one reflective line per launch, by priority: moved-on → chapter callback →
  // revisit-after-absence → ongoing-project greet.
  async function alongsideLaunch() {
    const p = activeProject;
    const cur = p ? projSlug(p) : "";
    const prevSlug = (await getMeta("proj_current_slug")) ?? "";
    const prevName = (await getMeta("proj_current_name")) ?? "";
    const curLastDay = cur ? ((await getMeta(`proj_${cur}_lastday`)) ?? "") : "";
    if (cur) {
      await setMeta("proj_current_slug", cur);
      await setMeta("proj_current_name", p);
    }
    const canSpeak = !focusMode && companionMode !== "just_there";
    // 1) you moved on from a project you stuck with — honour it once
    if (prevSlug && prevSlug !== cur) {
      const prevDays = Number((await getMeta(`proj_${prevSlug}_days`)) ?? 0);
      if (prevDays >= 5 && (await getMeta(`proj_${prevSlug}_closed`)) !== "1") {
        await setMeta(`proj_${prevSlug}_closed`, "1");
        if (canSpeak) {
          const line = projectStayedLine(prevName || prevSlug);
          say(line, 9000);
          announce(line);
          return;
        }
      }
    }
    // 2) a rare, sacred callback to a past chapter moment
    if (await maybeArcCallback()) return;
    // 3) returning to a project after a long absence
    if (cur && curLastDay) {
      const gapDays = (Date.now() - new Date(curLastDay).getTime()) / 86400_000;
      if (gapDays >= 14 && canSpeak) {
        const line = projectRevisitLine(p);
        say(line, 8000);
        announce(line);
        return;
      }
    }
    // 4) otherwise, greet the project we're still on
    await alongsideCheck();
  }

  // ---- Chapter Memory Engine: a CHAPTER is a day of real effort density (saves +
  // commits + breakthroughs), kept once/day as a rare `arc` memory the pet can
  // quietly recall as SHARED MEMORY weeks later. Sacred — never productivity spam.
  // Internally each chapter has a kind (sprint / long_night / breakthrough); the
  // user only ever experiences the quiet remembering. ----
  const CHAPTER_THRESHOLD = 60; // effort points in one day = a chapter worth keeping
  async function bumpEffort(points: number) {
    const today = new Date().toISOString().slice(0, 10);
    if ((await getMeta("effort_day")) !== today) {
      await setMeta("effort_day", today);
      await setMeta("effort_pts", "0");
    }
    const e = Number((await getMeta("effort_pts")) ?? 0) + points;
    await setMeta("effort_pts", String(e));
    if (e >= CHAPTER_THRESHOLD && (await getMeta("arc_day")) !== today) {
      await setMeta("arc_day", today); // at most one chapter per day
      await recordChapterMoment();
    }
  }

  async function recordChapterMoment() {
    const proj = activeProject || "this";
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getHours();
    // classify internally — never surfaced as a label, only flavours the recall
    const kind =
      (await getMeta("bt_day")) === today
        ? "breakthrough"
        : hour >= 22 || hour < 5
          ? "long_night"
          : "sprint";
    await addMemory("arc", { text: `${kind}|${proj}` }); // kept for later shared memory
    if (focusMode || companionMode === "just_there") return;
    runDelight("star", 2600);
    const l = pick(chapterMomentLines);
    say(l, 9000);
    announce(l);
  }

  // rare, sacred recollection of a past chapter — shared memory, never data recall.
  async function maybeArcCallback(): Promise<boolean> {
    if (bondTierNow < 2) return false; // earned at Trusted Friend+
    const last = Number((await getMeta("last_arc_callback")) ?? 0);
    if (Date.now() - last < 12 * 86400_000) return false;
    const arc = await oldArc(7);
    if (!arc?.text) return false;
    await setMeta("last_arc_callback", String(Date.now()));
    if (focusMode || companionMode === "just_there") return true; // handled, but quiet
    const sep = arc.text.indexOf("|");
    const kind = sep > 0 ? arc.text.slice(0, sep) : "sprint";
    const proj = sep > 0 ? arc.text.slice(sep + 1) : arc.text;
    const l = arcCallbackLine(proj, kind);
    say(l, 10000);
    announce(l);
    return true;
  }

  // ---- GitHub remote polling: a single repo, OR a whole account ----
  let remoteKind: "" | "repo" | "user" = "";
  let remoteId = ""; // "owner/repo" (repo) or "username" (account)
  let remotePollTimer: ReturnType<typeof setInterval> | undefined;

  // Optional personal-access-token → unlocks PRIVATE repos. Stored only in the
  // local SQLite (never logged, never sent anywhere but api.github.com/https).
  let ghToken = "";
  let hasToken = $state(false);
  function ghHeaders(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (ghToken) h.Authorization = `Bearer ${ghToken}`;
    return h;
  }

  /** Classify a GitHub URL/handle:
   *   github.com/owner/repo → { kind:"repo", id:"owner/repo" }
   *   github.com/owner      → { kind:"user", id:"owner" } (whole account) */
  function parseGitHub(url: string): { kind: "repo" | "user"; id: string } | null {
    const m = url.trim().match(/github\.com[/:]([^/\s]+?)(?:\/([^/\s]+?))?(?:\.git)?\/?$/i);
    if (!m) return null;
    const owner = m[1];
    const repo = m[2];
    return repo ? { kind: "repo", id: `${owner}/${repo}` } : { kind: "user", id: owner };
  }

  // one repo → its latest commit sha
  async function pollRepo(initial: boolean) {
    const res = await fetch(`https://api.github.com/repos/${remoteId}/commits?per_page=1`, {
      headers: ghHeaders()
    });
    if (!res.ok) return;
    const data = await res.json();
    const top = Array.isArray(data) ? data[0] : null;
    const sha: string | undefined = top?.sha;
    if (!sha) return;
    const last = await getMeta("git_remote_sha");
    if (sha === last) return;
    await setMeta("git_remote_sha", sha);
    if (!initial && last) onCommit(top?.commit?.message ?? ""); // never replay history
  }

  // whole account → newest PushEvent across any repo. With a token we hit the
  // authenticated feed (includes PRIVATE repo activity); otherwise public-only.
  async function pollUser(initial: boolean) {
    const feed = ghToken ? "events" : "events/public";
    const res = await fetch(`https://api.github.com/users/${remoteId}/${feed}?per_page=30`, {
      headers: ghHeaders()
    });
    if (!res.ok) return;
    const events = await res.json();
    if (!Array.isArray(events) || !events.length) return;
    const newestId: string = events[0].id;
    const last = await getMeta("git_remote_evt");
    if (newestId === last) return;
    await setMeta("git_remote_evt", newestId);
    if (initial || !last) return; // seed only — don't replay old activity
    // collect the new events (newest first) and react to the newest recognized one
    const fresh: any[] = [];
    for (const ev of events) {
      if (ev.id === last) break;
      fresh.push(ev);
    }
    for (const ev of fresh) {
      if (reactToEvent(ev)) break;
    }
  }

  // Map a GitHub event to a reaction. Returns true if it was something we react to.
  function reactToEvent(ev: any): boolean {
    switch (ev?.type) {
      case "PushEvent": {
        const commits = ev.payload?.commits ?? [];
        void onCommit(commits.length ? commits[commits.length - 1].message : "");
        return true;
      }
      case "PullRequestEvent":
        if (ev.payload?.action === "closed" && ev.payload?.pull_request?.merged) {
          reactGit("pr");
          return true;
        }
        return false;
      case "ReleaseEvent":
        if (ev.payload?.action === "published") {
          reactGit("release");
          return true;
        }
        return false;
      case "CreateEvent":
        if (ev.payload?.ref_type === "repository") {
          reactGit("repo");
          return true;
        }
        return false;
    }
    return false;
  }

  async function pollRemoteOnce(initial = false) {
    try {
      if (remoteKind === "repo") await pollRepo(initial);
      else if (remoteKind === "user") await pollUser(initial);
    } catch {
      /* network hiccup — try again next tick */
    }
  }

  function startRemotePoll(url: string) {
    const t = parseGitHub(url);
    remoteKind = t?.kind ?? "";
    remoteId = t?.id ?? "";
    clearInterval(remotePollTimer);
    if (!remoteKind) return;
    void pollRemoteOnce(true); // seed baseline now (no reaction)
    remotePollTimer = setInterval(() => void pollRemoteOnce(false), 180_000);
  }
  function stopRemotePoll() {
    clearInterval(remotePollTimer);
    remoteKind = "";
    remoteId = "";
  }

  // ---- LOCAL folder watcher (instant, via the Rust reflog poll) ----
  async function setLocal(path: string) {
    const p = path.trim();
    if (!p) return;
    if (/github\.com/i.test(p) || /^(https?:\/\/|git@|ssh:\/\/)/i.test(p)) {
      say("That's a link — put GitHub URLs in the GitHub box below.", 6000);
      return;
    }
    try {
      await invoke("git_set_repo", { path: p });
      watchingRepo = p;
      await setMeta("git_repo", p);
      say("Watching your folder now — instant reactions.", 5000);
    } catch {
      say("Hmm — I couldn't find a git repo there. Check the folder path?", 5500);
    }
  }
  async function stopLocal() {
    try { await invoke("git_clear_repo"); } catch { /* already clear */ }
    watchingRepo = "";
    await setMeta("git_repo", "");
  }

  // ---- REMOTE watcher: a GitHub repo URL or a whole account (polled) ----
  async function setRemote(url: string) {
    const p = url.trim();
    if (!p) return;
    const t = parseGitHub(p);
    if (!t) {
      say("That doesn't look like a GitHub repo or profile URL.", 6000);
      return;
    }
    try {
      const api = t.kind === "repo"
        ? `https://api.github.com/repos/${t.id}`
        : `https://api.github.com/users/${t.id}`;
      const res = await fetch(api, { headers: ghHeaders() });
      if (!res.ok) {
        say(res.status === 404
          ? (ghToken ? "Can't find that — check the URL?" : "Can't find that — is it public, or add a token?")
          : "GitHub wouldn't show me that — check the URL or token?", 6500);
        return;
      }
    } catch {
      say("Couldn't reach GitHub just now. Try again in a moment?", 5500);
      return;
    }
    watchingRemote = p;
    await setMeta("git_remote", p);
    await setMeta("git_remote_sha", ""); // fresh baselines — never replay history
    await setMeta("git_remote_evt", "");
    startRemotePoll(p);
    say(t.kind === "user"
      ? "Tracking your whole GitHub too — I'll notice pushes across all your repos."
      : "Tracking that repo on GitHub too — I'll notice new pushes.", 6500);
  }
  async function stopRemote() {
    stopRemotePoll();
    watchingRemote = "";
    await setMeta("git_remote", "");
  }

  // ---- living-companion README card: an animated SVG snapshot written to the repo ----
  // embed the sprite as a base64 PNG so the card is self-contained (GitHub-safe)
  async function spriteDataUri(): Promise<string> {
    try {
      const res = await fetch(fallbackUrl(dexId, isShiny));
      if (!res.ok) return "";
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return `data:image/png;base64,${btoa(bin)}`;
    } catch {
      return "";
    }
  }

  // Decode the animated Showdown GIF into a horizontal frame STRIP (one PNG), so the
  // README card can PLAY the companion via a CSS steps() animation — a moving figure,
  // matching the live widget. Returns null → the card falls back to a static sprite.
  type SpriteSheet = { uri: string; frames: number; fw: number; fh: number; dur: number };
  async function spriteSheetDataUri(): Promise<SpriteSheet | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const IDC = (globalThis as any).ImageDecoder;
      if (!IDC) return null;
      const res = await fetch(spriteUrl(dexId, isShiny), { mode: "cors" });
      if (!res.ok) return null;
      const dec = new IDC({ data: await res.arrayBuffer(), type: "image/gif" });
      await dec.tracks.ready;
      const total: number = dec.tracks.selectedTrack?.frameCount ?? 1;
      if (total < 2) return null; // not animated → static path

      // peek frame 0 for dimensions, then SAMPLE frames so the strip stays small —
      // a 40+ frame strip is a multi-thousand-px image that makes the card's CSS
      // animation lag. Cap to ~24 frames and ~2400px wide; keep the loop speed.
      const f0 = await dec.decode({ frameIndex: 0 });
      const fw = f0.image.displayWidth || f0.image.codedWidth || 96;
      const fh = f0.image.displayHeight || f0.image.codedHeight || 96;
      const maxF = Math.max(8, Math.min(24, Math.floor(2400 / fw)));
      const stepN = total > maxF ? total / maxF : 1;
      const idxs = [...new Set(Array.from({ length: Math.min(total, maxF) }, (_, k) => Math.floor(k * stepN)))];

      const bmps: ImageBitmap[] = [];
      let durMs = 0;
      for (const fi of idxs) {
        const img = fi === 0 ? f0.image : (await dec.decode({ frameIndex: fi })).image;
        durMs += (img.duration ?? 90000) / 1000; // µs → ms
        bmps.push(await createImageBitmap(img));
        img.close();
      }
      const count = bmps.length;
      if (!fw || !fh || !count) { for (const b of bmps) b.close(); return null; }
      const cv = document.createElement("canvas");
      cv.width = fw * count;
      cv.height = fh;
      const ctx = cv.getContext("2d");
      if (!ctx) { for (const b of bmps) b.close(); return null; }
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < bmps.length; i++) { ctx.drawImage(bmps[i], i * fw, 0); bmps[i].close(); }
      // estimate the full-loop time (sampled frames span the whole timeline)
      const loopS = Math.max(0.6, Math.min(4, (durMs * (total / count)) / 1000));
      return { uri: cv.toDataURL("image/png"), frames: count, fw, fh, dur: loopS };
    } catch {
      return null;
    }
  }
  // README card content — a tiny live window: seduce curiosity, don't explain.
  // Layer 2 — the identity / money line (the line that makes someone click)
  const CARD_TAGLINES = [
    "the companion that quietly stays while you build hard things",
    "for the long nights between stuck and breakthrough",
    "it quietly notices how hard you're trying",
    "a companion for people building difficult things"
  ];
  // Layer 4 — a soft call, never a button
  const CARD_CTAS = ["still here", "keeping watch", "staying nearby", "still noticing"];

  async function generateCard(silent = false) {
    const fm = await getMeta("first_met");
    const days = daysTogether(fm);

    // real signals → a live companion thought + narrative chips
    const today = new Date().toISOString().slice(0, 10);
    const slug = activeProject ? projSlug(activeProject) : "";
    const projDays = slug ? Number((await getMeta(`proj_${slug}_days`)) ?? 0) : 0;
    const streak = Number((await getMeta("streak")) ?? 0);
    const nightS = Number((await getMeta("sess_night")) ?? 0);
    const dayS = Number((await getMeta("sess_day")) ?? 0);
    const effPts = (await getMeta("effort_day")) === today ? Number((await getMeta("effort_pts")) ?? 0) : 0;
    const friction = lastFrictionCue > 0 && Date.now() - lastFrictionCue < 36 * 3600_000;

    // Layer 1 — a contextual COMPANION thought (an observation, never a state label)
    const thought = friction
      ? pick(["this one seems stubborn", "this one's taking a while", "still wrestling this"])
      : effPts >= 60
        ? pick(["deep waters today", "lost in it today", "still with this one"])
        : isNight
          ? pick(["keeping watch tonight", "quiet room tonight", "staying up with this one", "feels like one of those nights"])
          : projDays >= 3
            ? pick(["still here with this one", "back with this one"])
            : pick(["quietly staying nearby", "here, like always", "just keeping you company"]);

    // Layer 3 — two chips that tell DIFFERENT stories: present state + the journey
    const state = friction
      ? { icon: "🌧", label: "friction" }
      : effPts >= 60
        ? { icon: "⚡", label: "quietly locked in" }
        : isNight
          ? { icon: "🌙", label: "quiet night" }
          : { icon: "🫖", label: "slow and steady" };
    const arc =
      streak >= 3
        ? { icon: "🔥", label: `${streak}-day streak` }
        : projDays >= 3
          ? { icon: "🛠", label: "still shaping" }
          : nightS > dayS
            ? { icon: "🌙", label: "one of those seasons" }
            : days <= 7
              ? { icon: "📖", label: "chapter one" }
              : { icon: "✨", label: "quietly becoming real" };
    const chips = [state, arc];

    // the companion, named — lives INSIDE the card (one artifact → never desyncs)
    const partner = displayName(dexEntry(dexId)?.name ?? petName);

    // an emotional footer, never a metric
    const footer =
      days <= 7
        ? pick(["chapter one", "quietly becoming real", "still growing"])
        : isNight
          ? pick(["another late one", "learning how to stay", "still growing"])
          : pick(["still growing", "learning how to stay", "quietly becoming real"]);

    // prefer a moving figure (animated frame strip); fall back to a static sprite
    const sheet = await spriteSheetDataUri();
    const svg = buildCard({
      thought,
      tagline: pick(CARD_TAGLINES),
      chips,
      cta: pick(CARD_CTAS),
      footer,
      partner,
      night: isNight,
      sprite: sheet ? sheet.uri : await spriteDataUri(),
      spriteFrames: sheet?.frames,
      spriteFw: sheet?.fw,
      spriteFh: sheet?.fh,
      spriteDur: sheet?.dur,
      type: curType
    });
    if (watchingRepo) {
      const path = `${watchingRepo.replace(/[\\/]+$/, "")}/assets/hearthmon-status.svg`;
      try {
        await invoke("write_card", { path, svg });
        if (!silent) say("Card written to assets/. Add to README:  ![Hearthmon](./assets/hearthmon-status.svg)", 10000);
      } catch {
        if (!silent) say("Couldn't write the card to that folder.", 5000);
      }
    } else if (!silent) {
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "hearthmon-status.svg" });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      say("Card downloaded — put it at assets/hearthmon-status.svg + add ![Hearthmon](./assets/hearthmon-status.svg).", 10000);
    }
  }

  // Helper: build the live companion metadata sent alongside every card push.
  // Rust uses these to rewrite the static README text block so it always matches.
  // varied, context-aware one-liner for the card bubble / README status
  function cardStatusLine(): string {
    const bank = comfortMode
      ? ["taking it easy", "catching my breath", "resting a moment"]
      : focusMode
        ? ["heads down", "deep in it", "in the zone"]
        : isNight
          ? ["coding by moonlight", "late one tonight", "the quiet hours"]
          : ["quietly building", "tinkering away", "in a good rhythm", "chipping at it", "poking the codebase"];
    return pick(bank);
  }
  function cardMeta() {
    const speciesName = displayName(dexEntry(dexId)?.name ?? petName);
    const mood = comfortMode ? "Taking it Easy" : focusMode ? "In Focus" : isNight ? "Late Night Coding" : "Quietly Building";
    return { companion: speciesName, mood, status: cardStatusLine() };
  }

  // silent auto-push used by the 6h smart schedule + launch catch-up
  async function autoPushCard() {
    if (!watchingRepo) return;
    try {
      await generateCard(true);
      await invoke("push_card", { path: watchingRepo, ...cardMeta() });
      await setMeta("last_card_push", String(Date.now()));
    } catch {
      /* offline / no remote — try again next window */
    }
  }

  async function pushCard() {
    if (!watchingRepo) {
      say("Set a local profile repo in Code first!", 5000);
      return;
    }
    await generateCard(true); // make sure it's written
    say("Pushing card to GitHub...", 3000);
    try {
      await invoke("push_card", { path: watchingRepo, ...cardMeta() });
      await setMeta("last_card_push", String(Date.now()));
      say("Card pushed successfully! 🚀", 5000);
      runDelight("star", 2000);
    } catch (e) {
      say("Failed to push card.", 5000);
      console.error(e);
    }
  }

  // ---- dev helper: preview a reaction instantly ----
  // True smoke test: bypasses mode / mute / throttle and plays at full volume,
  // speaking via the same TTS path used for Pokémon names. So clicking a test
  // ALWAYS shows + sounds, even in Just-There mode or with the fx channel muted.
  const TEST_CUES: Record<GitKind, { quip: () => string; cue: string; fx: "star" | "fireworks" | null }> = {
    commit:    { quip: () => pick(commitQuips),  cue: "/sfx/commit.mp3",    fx: null },
    fix:       { quip: () => pick(fixQuips),      cue: "/sfx/bugfix.mp3",    fx: "star" },
    pr:        { quip: () => pick(prQuips),       cue: "/sfx/ship.mp3",      fx: "fireworks" },
    release:   { quip: () => pick(releaseQuips),  cue: "/sfx/ship.mp3",      fx: "fireworks" },
    repo:      { quip: () => pick(newRepoQuips),  cue: "/sfx/newrepo.mp3",   fx: "star" },
    milestone: { quip: () => milestoneQuip(50),   cue: "/sfx/milestone.mp3", fx: "fireworks" }
  };
  function testReact(kind: GitKind) {
    const t = TEST_CUES[kind];
    const line = t.quip();
    poke();
    if (petState === "idle") {
      petState = "happy";
      setTimeout(() => (petState = "idle"), 900);
    }
    if (t.fx) runDelight(t.fx, t.fx === "fireworks" ? 3000 : 2400);
    say(line, 6000);
    previewSfx(t.cue);    // cue sound at full volume, ignores mute/fx slider
    previewSpeak(line);   // spoken aloud (same voice path as Pokémon names)
  }

  // ---- GitHub token (private-repo access) — local only, never leaves the box ----
  async function setToken(token: string) {
    ghToken = token.trim();
    hasToken = !!ghToken;
    await setMeta("git_token", ghToken);
    // re-baseline so the (now authed) feed seeds without replaying history
    if (watchingRemote) {
      await setMeta("git_remote_sha", "");
      await setMeta("git_remote_evt", "");
      startRemotePoll(watchingRemote);
    }
    say(hasToken ? "Token saved — I can see your private work now." : "Token cleared.", 5000);
  }
  async function clearToken() {
    await setToken("");
  }

  // ---- friction removal: bare-key shortcuts (M mood · J jar · N notes) ----
  // 1-second interactions for power users. Ignored while typing, onboarding,
  // or mid-battle/evolution so they never fire at the wrong moment.
  function onShortcut(e: KeyboardEvent) {
    typingPerk(); // the pet notices you working — a tiny attention perk
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (phase !== "home" || battleOpen || evoActive || evoOffer) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const key = e.key.toLowerCase();
    if (key === "v") {
      // switch renderer: Classic (cozy CSS) ↔ Alive (premium Pixi) — same brain
      e.preventDefault();
      renderMode = renderMode === "alive" ? "classic" : "alive";
      void setMeta("render_mode", renderMode);
      say(renderMode === "alive" ? "Alive ✦" : "Classic", 2500);
      return;
    }
    const map: Record<string, Panel> = { m: "mood", j: "jar", n: "note" };
    const target = map[key];
    if (!target) return;
    e.preventDefault();
    togglePanel(target);
  }

  async function togglePanel(p: Panel) {
    const opening = panel !== p;
    panel = panel === p ? "none" : p;
    poke();
    if (!opening) return;
    if (p === "switch") playVoiceClip("lets-go-catch-some-pokemon", 0.8, 0.3);
    else if (p === "jar") say(pick(jarLines), 5000);
    else if (p === "note") {
      // only promise a waiting note when one is actually due
      if (await unreadLetter()) say(pick(letterReadyLines), 5000);
    }
  }

  onMount(() => {
    (async () => {
      scale = Number((await getMeta("pet_scale")) ?? 0) || 1.5;
      // size the window for the pet, then place it. Windows boot-launch → settle at the
      // default spot (bottom-right). A manual relaunch → return to the LAST place it sat.
      await fitWindow(true);
      const boot = await checkStartupLaunch();
      if (!boot) {
        const savedX = await getMeta("win_x");
        const savedY = await getMeta("win_y");
        if (savedX !== null && savedY !== null) {
          try {
            await getCurrentWindow().setPosition(new PhysicalPosition(Number(savedX), Number(savedY)));
          } catch { /* outside monitor bounds — keep default */ }
        }
      }

      // drag-resize: when the window is resized by the corner grip, scale the pet to follow.
      // We ignore resizes that match what we set ourselves (fitWindow), so the two don't fight.
      try {
        const win = getCurrentWindow();
        winSf = await win.scaleFactor();
        resizeUnlisten = await win.onResized(({ payload }) => {
          const w = payload.width / winSf;
          if (Math.abs(w - lastSetW) < 6) return; // our own programmatic resize — skip
          scale = scaleFromW(w);
          lastSetW = w;
          clearTimeout(scaleTimer);
          scaleTimer = setTimeout(() => setMeta("pet_scale", String(scale)), 400);
        });
      } catch {
        // no window resize events available — fine
      }

      autoMinutes = Number((await getMeta("auto_switch_minutes")) ?? 0) || 0;
      autoMode = (await getMeta("auto_mode")) === "evolve" ? "evolve" : "random";

      const dex = await getMeta("dex_id");
      if (!dex) {
        phase = "meeting";
        return;
      }
      dexId = Number(dex);
      petName = (await getMeta("pet_name")) ?? "Friend";
      isShiny = (await getMeta("shiny")) === "1";
      muted = (await getMeta("muted")) === "1";
      setSoundEnabled(!muted);
      focusMode = (await getMeta("focus_mode")) === "1";
      setFocus(focusMode);
      companionMode = ((await getMeta("companion_mode")) as CompanionMode | null) ?? "default";
      setMode(companionMode);
      {
        const r = await getMeta("room"); // legacy "on" → "full"
        room = r === "on" ? "full" : r === "full" || r === "sphere" || r === "square" ? r : "none";
      }
      trainAware = (await getMeta("train_aware")) !== "0"; // training awareness (default on)
      renderMode = (await getMeta("render_mode")) === "alive" ? "alive" : "classic"; // renderer choice
      flowAware = (await getMeta("flow_aware")) !== "0"; // foreground flow sensing (default on)
      try { await invoke("set_flow_aware", { on: flowAware }); } catch { /* not under Tauri */ }
      if ((await getMeta("audio_aware")) === "1") await setAudioAware(true); // music awareness (default off)
      {
        const lp = (await getMeta("train_log_path")) ?? "";
        if (lp) {
          logPath = lp;
          try { await invoke("log_set_path", { path: lp }); } catch { /* not under Tauri */ }
        }
      }

      // coding awareness: resume the saved source (local folder or GitHub URL)
      ghToken = (await getMeta("git_token")) ?? "";
      hasToken = !!ghToken;
      const savedRepo = await getMeta("git_repo");
      if (savedRepo) {
        watchingRepo = savedRepo;
        invoke("git_set_repo", { path: savedRepo }).catch(() => (watchingRepo = ""));
      }
      const savedRemote = await getMeta("git_remote");
      if (savedRemote) {
        watchingRemote = savedRemote;
        startRemotePoll(savedRemote);
      }
      // Toddler Mode resumes if it was left on
      if ((await getMeta("toddler")) === "1") {
        toddler = true;
        clearInterval(toddlerTimer);
        toddlerTimer = setInterval(() => void toddlerHop(), 6500);
      }
      nightForced = (await getMeta("night_forced")) === "1";
      bgStyle = (await getMeta("bg_style") as ("orb" | "square" | "ground" | "off") | null) ?? "orb";
      widgetOpacity = Number((await getMeta("widget_opacity")) ?? 1) || 1;
      evoCount = Number((await getMeta("evo_count")) ?? 0) || 0;
      refreshComfort();
      refreshAutostart();
      for (const ch of ["voice", "cry", "fx"] as Channel[]) {
        const saved = await getMeta(`vol_${ch}`);
        if (saved !== null) {
          setVolume(ch, Number(saved));
        }
      }
      vols = getVolumes();
      phase = "home";
      // personality signal: which part of the day you tend to show up (once per launch)
      {
        const h0 = new Date().getHours();
        void bumpCounter(h0 >= 22 || h0 < 6 ? "sess_night" : "sess_day");
      }
      // Trust Escalation: tell presence how deep the bond is, so it only
      // unlocks vulnerable lines once they've been earned.
      {
        const fm = await getMeta("first_met");
        const ix = Number((await getMeta("interactions")) ?? 0) || 0;
        const tierNow = bondStageIndex(daysTogether(fm), ix);
        setBondTier(tierNow);
        bondTierNow = tierNow; // for cozy-room unlocks
        // emergent personality → flavors the pet's ambient murmurs
        {
          const k = await kindCounts();
          const mc = await moodCounts();
          const totMoods = Object.values(mc).reduce((a, b) => a + b, 0);
          petPersona = derivePersona({
            nightSessions: Number((await getMeta("sess_night")) ?? 0),
            daySessions: Number((await getMeta("sess_day")) ?? 0),
            commits: Number((await getMeta("commits")) ?? 0),
            learned: k["learned"] ?? 0,
            wins: k["win"] ?? 0,
            goodRatio: totMoods ? (mc["good"] ?? 0) / totMoods : 0,
            days: daysTogether(fm)
          });
          setPersona(petPersona?.label ?? "");
        }
        // personality DRIFT — temperament shaped by how YOU interact with it
        {
          const mc2 = await moodCounts();
          const k2 = await kindCounts();
          petTemperament = deriveTemperament({
            pets: Number((await getMeta("t_aff")) ?? 0),
            feeds: 0,
            plays: Number((await getMeta("t_play")) ?? 0),
            comforts: Number((await getMeta("t_comfort")) ?? 0),
            lowMoods: mc2["low"] ?? 0,
            nightSessions: Number((await getMeta("sess_night")) ?? 0),
            daySessions: Number((await getMeta("sess_day")) ?? 0),
            commits: Number((await getMeta("commits")) ?? 0),
            learned: k2["learned"] ?? 0
          });
          tempPlay = petTemperament.top === "playful";
          tempCalm = petTemperament.top === "calm";
          // when a NEW dominant trait emerges (not the first time), say so once
          if (petTemperament.top) {
            const seen = (await getMeta("drift_top")) ?? "";
            if (seen !== petTemperament.top) {
              await setMeta("drift_top", petTemperament.top);
              if (seen) {
                const dl = driftLine(petTemperament.top);
                setTimeout(() => {
                  if (!focusMode && companionMode !== "just_there") {
                    say(dl, 9000);
                    announce(dl);
                  }
                }, 20000);
              }
            }
          }
        }
        // living-companion card: refresh the repo's status SVG on launch
        // living card: catch up on launch if >6h since the last push (covers "app was off for days")
        if (watchingRepo) {
          const last = Number((await getMeta("last_card_push")) ?? 0);
          if (!last || Date.now() - last >= 6 * 3600_000) void autoPushCard();
        }

        // dream pool: symbols drawn from your real recent memories (for sleep dreams)
        {
          const recent = await allMemories(30);
          const syms = recent.map(dreamSymbol).filter((s) => s !== "💭");
          if (syms.length) dreamPool = [...new Set(syms)];
        }

        // tiny-wins: coding streak (consecutive calendar days the app was opened)
        {
          const today = new Date().toDateString();
          const lastDay = await getMeta("last_active_day");
          let streak = Number((await getMeta("streak")) ?? 0) || 0;
          if (lastDay !== today) {
            const yesterday = new Date(Date.now() - 86_400_000).toDateString();
            streak = lastDay === yesterday ? streak + 1 : 1;
            await setMeta("streak", String(streak));
            await setMeta("last_active_day", today);
          }
          if ([3, 5, 7, 14, 30, 60, 100, 200, 365].includes(streak) && !focusMode) {
            if ((await getMeta("streak_seen")) !== String(streak)) {
              await setMeta("streak_seen", String(streak));
              const line = streakLine(streak);
              setTimeout(() => {
                say(line, 11000);
                announce(line);
              }, 15000);
            }
          }
        }
        // bond-tier ceremony: fire once when we cross into a deeper tier
        const seenRaw = await getMeta("bond_tier_seen");
        const seen = seenRaw === null ? -1 : Number(seenRaw);
        await setMeta("bond_tier_seen", String(tierNow));
        if (seen >= 0 && tierNow > seen && !focusMode) {
          const label = BOND_STAGES[tierNow]?.label ?? "";
          const line = bondUpLine(label);
          setTimeout(() => {
            bondCeremony = label;
            say(line, 12000);
            announce(line);
            runDelightBurst("fireworks", 60_000);
            setTimeout(() => (bondCeremony = null), 5200);
          }, 9000); // deferred so it doesn't pile onto the greeting
        }
      }
      await initPresence(
        { say, setState: (s) => (petState = s) },
        { onRitual: triggerRitual, onReturn: triggerDustOff }
      );
      scheduleWeatherAuto(); // start the periodic natural weather cycle
      // soft hello: says its own name, then its cry (unless we're focusing)
      if (!focusMode)
        setTimeout(() => voiceCry(dexId, displayName(dexEntry(dexId)?.name ?? petName), 0.16), 1400);
      // trainer chimes in, time-aware and only sometimes (never in focus mode)
      const h = new Date().getHours();
      if (!focusMode) {
        if (h >= 5 && h < 12) setTimeout(() => playVoiceClip("good-morning", 0.8, 0.5), 3400);
        else if (h >= 23 || h < 5)
          setTimeout(() => playVoiceClip("sure-got-dark-fast-huh", 0.8, 0.4), 3400);
      }

      // anniversaries: every 30 days, and especially every 365
      const firstMet = await getMeta("first_met");
      const days = daysTogether(firstMet);
      let hadAnniversary = false;

      // pet birthday — the calendar day we first met (takes precedence over the
      // generic anniversary so they never double up). Party hat for the session.
      let isBday = false;
      if (firstMet && days >= 1 && !focusMode) {
        const fm = new Date(firstMet.replace(" ", "T"));
        const now2 = new Date();
        if (fm.getMonth() === now2.getMonth() && fm.getDate() === now2.getDate()) {
          const yr = String(now2.getFullYear());
          if ((await getMeta("last_birthday")) !== yr) {
            isBday = true;
            hadAnniversary = true; // suppress the generic anniversary + letter today
            await setMeta("last_birthday", yr);
            const years = Math.round(days / 365);
            const line = years >= 1
              ? `${years} year${years === 1 ? "" : "s"} since the day we met. 🎂 Thank you for staying.`
              : "Happy day-we-met. 🎂 Glad it was you.";
            setTimeout(() => {
              birthday = true;
              say(line, 15000);
              announce(line);
              runDelightBurst("fireworks", 60_000);
              playVoiceClip(["congrats", "that-was-awesome", "awesome"], 0.85, 0.6);
            }, 6500);
          }
        }
      }

      if (!isBday && days > 0 && (days % 365 === 0 || days % 30 === 0)) {
        const today = new Date().toDateString();
        if ((await getMeta("last_anniversary")) !== today) {
          hadAnniversary = true;
          await setMeta("last_anniversary", today);
          setTimeout(() => {
            say(anniversaryLine(days), 14000);
            runDelightBurst("fireworks", 60_000);
            // yearly: the pet pulls up your Year in Review on its own
            if (days % 365 === 0 && !focusMode) setTimeout(() => (panel = "wrapped"), 4000);
          }, 6000);
        }
      }

      // a note/capsule from past-you has come due — the pet remembers, so you don't have to.
      // gentle, deferred, and never on top of an anniversary or focus session.
      if (!focusMode && !hadAnniversary) {
        if (await unreadLetter()) {
          setTimeout(() => say(pick(letterReadyLines) + " (✉️ tap to read)", 11000), 7000);
        }
      }

      // Sacred moments — at most one, ever; rare, deferred, never stacked on an anniversary.
      if (!focusMode && !hadAnniversary) {
        const ix = Number((await getMeta("interactions")) ?? 0) || 0;
        const sacred = await resolveSacred(
          {
            days,
            bondTier: bondStageIndex(days, ix),
            hardRecent: await hardMoodCount(14),
            goodTotal: (await moodCounts())["good"] ?? 0
          },
          getMeta,
          setMeta
        );
        if (sacred) {
          setTimeout(() => {
            say(sacred.line, 16000);
            announce(sacred.line);
            runDelight(sacred.effect, 3600);
          }, 12000);
        }
      }
      // "Alongside you": greet the ongoing project / honour one we moved on from.
      // Deferred so it never collides with the greeting or a sacred moment.
      setTimeout(() => void alongsideLaunch(), 17000);
    })();

    const wanderTimer = setInterval(wanderTick, 4000);
    const murmurTimer = setInterval(murmurTick, 70_000); // rare ambient quirk lines
    const fidgetTimer = setInterval(fidgetTick, 2600); // ambient blinks / micro-fidgets
    const dreamTimer = setInterval(dreamTick, 22_000); // dream bubbles while sleeping
    const autoTimer = setInterval(autoSwitchTick, 30_000);
    // Lonely Night Mode — the room dims after midnight
    const checkNight = () => {
      const now = new Date();
      nightAuto = now.getHours() >= 0 && now.getHours() < 5;
      const m = now.getMonth();
      isWinter = m === 11 || m <= 1; // Dec–Feb: snow drifts past the window
      refreshComfort(); // let comfort decay over time
      maybeOfferEvolution(); // gently check if the companion is ready to grow
    };
    checkNight();
    const nightTimer = setInterval(checkNight, 5 * 60_000);

    // Living card: auto-push on a 6h smart window while running (amends its own
    // commit so the profile isn't spammed). Launch catch-up handles long-offline.
    const cardPushTimer = setInterval(() => void autoPushCard(), 6 * 3600_000);

    // Build/Training awareness: poll the GPU (self-disables if there's no NVIDIA).
    if (trainAware) {
      gpuTimer = setInterval(() => void pollGpu(), 5000);
      void pollGpu();
    }

    // Soft-failure net: turn uncaught errors / rejected promises into one warm
    // line. Ignore element resource errors (missing sprite/clip) — those are
    // designed to fall back, so `e.error` (script errors only) is the filter.
    const onError = (e: ErrorEvent) => { if (e.error instanceof Error) softFail(e.error); };
    const onRejection = (e: PromiseRejectionEvent) => softFail(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // coding awareness: react to commits emitted by the Rust reflog watcher
    let unlistenCommit: (() => void) | undefined;
    listen<string>("git-commit", (e) => onCommit(e.payload)).then((un) => (unlistenCommit = un));

    // training awareness: react to log lines emitted by the Rust log watcher
    let unlistenTrain: (() => void) | undefined;
    let unlistenNewRun: (() => void) | undefined;
    listen<string>("train-log", (e) => onTrainLine(e.payload)).then((un) => (unlistenTrain = un));
    listen<string>("train-newfile", (e) => onNewRun(e.payload)).then((un) => (unlistenNewRun = un));

    // flow awareness: working-tree saves emitted by the Rust activity watcher
    let unlistenActive: (() => void) | undefined;
    listen<number>("repo-active", () => noteBuilderActivity()).then((un) => (unlistenActive = un));
    // flow awareness: foreground-app rhythm (process names only)
    let unlistenFocus: (() => void) | undefined;
    listen<string>("focus-app", (e) => onFocusApp(e.payload)).then((un) => (unlistenFocus = un));
    // music awareness: ephemeral energy bands [bass, mid, high, level] (opt-in)
    let unlistenAudio: (() => void) | undefined;
    listen<[number, number, number, number]>("audio-bands", (e) => onAudioBands(...e.payload)).then((un) => (unlistenAudio = un));
    // ~30s scheduler: pick a calm/chill/hype line based on slow-energy EMA
    const musicLineTimer = setInterval(maybeMusicLine, 30_000);
    // vibe tick: 2.5s animation driver while a music vibe is active
    const vibeTimer = setInterval(vibeTick, 2500);

    // global command palette — Alt+Space from anywhere summons the quick log bar
    register("Alt+Space", (e) => {
      if (e && typeof e === "object" && "state" in e && (e as { state?: string }).state === "Released") return;
      void openCommand();
    }).catch(() => {/* shortcut unavailable (e.g. browser dev) */});

    // Return-home whistle — Alt+W recalls the window to the monitor centre
    register("Alt+W", (e) => {
      if (e && typeof e === "object" && "state" in e && (e as { state?: string }).state === "Released") return;
      void returnHome();
    }).catch(() => {});

    return () => {
      clearInterval(wanderTimer);
      clearInterval(murmurTimer);
      clearInterval(fidgetTimer);
      clearInterval(dreamTimer);
      clearInterval(autoTimer);
      clearInterval(nightTimer);
      clearInterval(cardPushTimer);
      if (gpuTimer) clearInterval(gpuTimer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      unlistenCommit?.();
      unlistenTrain?.();
      unlistenNewRun?.();
      unlistenActive?.();
      unlistenFocus?.();
      unlistenAudio?.();
      clearInterval(remotePollTimer);
      clearInterval(toddlerTimer);
      clearInterval(musicLineTimer);
      clearInterval(vibeTimer);
      clearTimeout(musicVibeTimer);
      clearVibeReaction();
      clearInterval(_burstInterval);
      clearTimeout(_burstEndTimer);
      unregister("Alt+Space").catch(() => {});
      unregister("Alt+W").catch(() => {});
      resizeUnlisten?.();
    };
  });

  // ---- wander: walk, run, hop, jump, spin, turn, zoomies, butterfly, practice ----
  function busy(): boolean {
    return (
      phase !== "home" ||
      petState !== "idle" ||
      switchFx !== "none" ||
      attacking ||
      moving ||
      oneShot !== "none" ||
      panel !== "none" ||
      battleOpen ||
      evoActive ||
      evoOffer
    );
  }

  function wanderTick() {
    if (busy()) return;
    const r = Math.random();
    if (comfortMode || deepWork() || waitingMode()) {
      // calmer presence: while you're in flow / a run is going / comfort, the pet settles —
      // only slow drifts and the occasional glance. Quiet company, no zoomies.
      if (r < 0.18) startMove("walk");
      else if (r < 0.24) dir = dir === 1 ? -1 : 1;
      else if (r < 0.255 && comfortMode) runDelight("rain", 9000); // soft rain suits a heavy mood
      return;
    }
    if (companionMode === "fun") {
      // Fun mode: more energetic — runs, hops, jumps, zoomies come around far more often.
      if (r < 0.30) startMove("run");
      else if (r < 0.42) startMove("hop");
      else if (r < 0.52) doOneShot("jump");
      else if (r < 0.60) doOneShot("spin");
      else if (r < 0.70) zoomies();
      else if (r < 0.74) spawnButterfly();
      else if (r < 0.80) startMove("walk");
      else if (r < 0.83) dir = dir === 1 ? -1 : 1;
      return;
    }
    // drift: a playful companion moves more; a calm one drifts gentler
    if (tempCalm) {
      if (r < 0.26) startMove("walk");
      else if (r < 0.31) dir = dir === 1 ? -1 : 1;
      else if (r < 0.325) runDelight("rain", 9000);
      return;
    }
    if (tempPlay && r < 0.66) {
      if (r < 0.22) startMove("run");
      else if (r < 0.34) startMove("hop");
      else if (r < 0.44) doOneShot("jump");
      else if (r < 0.52) doOneShot("spin");
      else if (r < 0.60) zoomies();
      else spawnButterfly();
      return;
    }
    if (r < 0.24) startMove("walk");
    else if (r < 0.31) startMove("run");
    else if (r < 0.37) startMove("hop");
    else if (r < 0.41) doOneShot("jump");
    else if (r < 0.44) doOneShot("spin");
    else if (r < 0.5) dir = dir === 1 ? -1 : 1; // glance the other way
    else if (r < 0.52) attack(); // practice swing with a real move
    else if (r < 0.535) zoomies();
    else if (r < 0.55) spawnButterfly();
    else if (r < 0.562) spawnVisitor(); // a wild Pokémon passes through
    // micro-delights: rare magic, never spammy
    else if (r < 0.572) runDelight("star", 2600); // shooting star
    else if (r < 0.578) runDelight("rain", 9000); // soft pixel rain
  }

  // Ambient murmurs — mostly the pet says nothing. Occasionally it surfaces a
  // context-aware PERSONALITY QUIRK ("it's Monday…", "found another star"), or
  // falls back to a persona/generic murmur. Shown in the bubble only (not spoken
  // aloud) so it stays gentle and non-intrusive.
  function murmurTick() {
    if (busy() || petState === "sleeping") return;
    if (deepWork()) return; // you're deep in it — the company is the silence
    if (focusMode || companionMode === "just_there") return; // stay quiet
    if (Math.random() > 0.18) return; // rare on purpose
    const now = new Date();
    const ctx = {
      hour: now.getHours(),
      weekday: now.getDay(),
      weather: weatherKind,
      isNight,
      isWinter
    };
    let line: string | null = null;
    if (Math.random() < 0.6) line = quirkLine(dexId, ctx); // a quirk, if one fits now
    if (!line) {
      const pa = petPersona ? personaAmbient[petPersona.label] : undefined;
      line = pick(pa && pa.length && Math.random() < 0.5 ? pa : ambientLines);
    }
    if (line) say(line, 5000);
  }

  function wanderMax(): number {
    return Math.max(40, Math.floor((winW - imgSize) / 2) - 40);
  }

  function startMove(mode: "walk" | "run" | "hop", to?: number) {
    const max = wanderMax();
    const target =
      to !== undefined
        ? Math.max(-max, Math.min(max, to))
        : Math.round(-max + Math.random() * 2 * max);
    const dist = Math.abs(target - petX);
    if (dist < 24) return;
    dir = target > petX ? 1 : -1;
    const speed = mode === "run" ? 130 : mode === "hop" ? 60 : 40; // px per second
    moveDur = dist / speed;
    running = mode === "run";
    hopping = mode === "hop";
    moving = true;
    petX = target;
    clearTimeout(moveEndTimer);
    moveEndTimer = setTimeout(() => {
      moving = false;
      hopping = false;
    }, moveDur * 1000 + 80);
  }

  function doOneShot(kind: "jump" | "spin") {
    if (busy()) return;
    oneShot = kind;
    setTimeout(() => (oneShot = "none"), kind === "jump" ? 700 : 650);
  }

  // ---- ambient body language: subtle micro-fidgets that read as "alive" ----
  // (transform-based, since the sprites are static images)
  let lastPerk = 0;
  function fidget(kind: "blink" | "tilt" | "perk") {
    if (busy()) return;
    oneShot = kind;
    const ms = kind === "blink" ? 180 : kind === "perk" ? 380 : 720;
    setTimeout(() => (oneShot = "none"), ms);
  }
  function fidgetTick() {
    if (!idleNow || busy()) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const r = Math.random();
    if (r < 0.42) fidget("blink");                 // frequent — a living blink
    else if (r < 0.52) fidget("tilt");             // a little "hmm" head-tilt
    else if (r < 0.57) dir = dir === 1 ? -1 : 1;   // glance the other way
    else if (r < 0.585 && !comfortMode) triggerRitual(); // rare sleepy stretch
    // otherwise: a still, calm moment (stillness is alive too)
  }
  // a tiny perk of attention when you type (only while idle, throttled)
  function typingPerk() {
    if (!idleNow || Date.now() - lastPerk < 1500) return;
    lastPerk = Date.now();
    fidget("perk");
  }

  async function zoomies() {
    void bumpCounter("t_play"); // drift: playful temperament
    for (let i = 0; i < 3; i++) {
      if (phase !== "home" || switchFx !== "none" || petState !== "idle") return;
      startMove("run");
      await new Promise((r) => setTimeout(r, moveDur * 1000 + 140));
    }
  }

  function spawnButterfly() {
    if (butterfly) return;
    const max = wanderMax();
    const side = Math.random() < 0.5 ? -1 : 1;
    const from = side * (max + 60);
    const to = -side * (max + 60);
    const dur = 6.5;
    butterfly = { from, to, dur };
    // the pet notices and trots after it
    setTimeout(() => {
      if (!busy()) startMove("hop", Math.round((from + to) / 2 + side * 30));
    }, 900);
    setTimeout(() => (butterfly = null), dur * 1000 + 400);
  }

  function attack(move?: Move) {
    if (attacking || switchFx !== "none" || moving) return;
    attacking = true;
    attackMove = move ?? randomMove(dexId);
    atkKind = animKind(attackMove);
    particles = makeParticles(attackMove, dir);
    const dur = attackMove.cls === 3 ? 1250 : attackMove.cls === 1 ? 1150 : 950;
    setTimeout(() => {
      attacking = false;
      attackMove = null;
      atkKind = null;
      particles = [];
    }, dur);
  }

  // ---- auto-switch / auto-grow timer ----
  async function setAutoSwitch(mins: number, mode: "random" | "evolve" = "random") {
    autoMinutes = mins;
    autoMode = mode;
    await setMeta("auto_switch_minutes", String(mins));
    await setMeta("auto_mode", mode);
    await setMeta("last_auto_switch", String(Date.now()));
    // "evolve" splits the chosen interval evenly across the whole evolution chain
    if (mode === "evolve") {
      await setMeta("auto_evo_steps", String(Math.max(1, evolutionStepsAhead(dexId))));
    }
  }

  async function autoSwitchTick() {
    // never mid-battle, mid-ceremony, or while asleep
    if (!autoMinutes || phase !== "home" || switchFx !== "none" || battleOpen) return;
    if (petState === "sleeping" || evoActive || evoOffer) return;
    const last = Number((await getMeta("last_auto_switch")) ?? "0");

    if (autoMode === "evolve") {
      // split the interval across the chain: one stage per (interval / total steps)
      if (!hasEvolution(dexId)) return; // fully evolved — nothing left to grow into
      const steps = Math.max(1, Number((await getMeta("auto_evo_steps")) ?? 1));
      const stepMs = (autoMinutes / steps) * 60_000;
      if (Date.now() - last >= stepMs) {
        await setMeta("last_auto_switch", String(Date.now()));
        const target = nextEvolution(dexId);
        if (target) startEvolutionCeremony(target);
      }
      return;
    }

    // random mode (default)
    if (Date.now() - last >= autoMinutes * 60_000) {
      await setMeta("last_auto_switch", String(Date.now()));
      switchTo(randomEntry(dexId));
    }
  }

  // ---- the Pokéball switch sequence ----
  function resolveName(entry: DexEntry, typed?: string): string {
    const oldDefault = displayName(dexEntry(dexId)?.name ?? "");
    const t = (typed ?? petName).trim();
    // a custom name carries over; a default name yields to the new form's own
    return t && t !== oldDefault ? t : displayName(entry.name);
  }

  function switchTo(entry: DexEntry, typedName?: string) {
    if (switchFx !== "none" || evoActive || entry.id === dexId) return;
    panel = "none";
    poke();
    // a deliberate switch is a new companion — its evolution journey starts fresh
    evoOffer = false;
    evoCount = 0;
    setMeta("evo_count", "0");
    const newName = resolveName(entry, typedName);
    const becomesShiny = Math.random() < 1 / 128;

    switchFx = "recall"; // red glow, shrink into the ball
    setTimeout(async () => {
      switchFx = "ballout"; // ball zips back to the trainer off-screen
      dexId = entry.id;
      petName = newName;
      isShiny = becomesShiny;
      await setMeta("dex_id", String(entry.id));
      await setMeta("pet_name", newName);
      await setMeta("shiny", becomesShiny ? "1" : "0");
      await addMemory("note", {
        text: `changed form: ${becomesShiny ? "✨ SHINY " : ""}${displayName(entry.name)}`
      });
    }, 480);
    setTimeout(() => {
      switchFx = "gap"; // empty stage, the trainer winds up…
      announceGo(displayName(entry.name)); // always the real species name: "Tapu Koko, go!"
    }, 480 + 440);
    setTimeout(() => {
      switchFx = "throw"; // ball arcs in from off-screen, spinning
    }, 480 + 440 + 700);
    setTimeout(() => {
      switchFx = "release"; // pops open: flash burst, new form grows out
      // Ash just said the name — the Pokémon answers with its cry only
      playCry(entry.id, 1);
    }, 480 + 440 + 700 + 680);
    setTimeout(() => {
      switchFx = "none";
      if (becomesShiny) say(`✨ A shiny ${displayName(entry.name)}! One in a hundred.`, 12000);
      else say(pick(switchLines), 8000);
    }, 480 + 440 + 700 + 680 + 620);
  }

  // ---- evolution ceremony ----
  // Offered, never forced (like the games, you can say "not yet"). Earned through
  // genuine bonding — interactions accrue from taps, moods, logs — and paced apart.
  async function maybeOfferEvolution() {
    if (evoOffer || evoActive || switchFx !== "none" || battleOpen || phase !== "home") return;
    if (petState === "sleeping" || !hasEvolution(dexId)) return;
    const interactions = Number((await getMeta("interactions")) ?? 0);
    const need = 12 + evoCount * 18; // escalates with each evolution
    if (interactions < need) return;
    const declined = Number((await getMeta(`evo_declined_${dexId}`)) ?? 0);
    if (Date.now() - declined < 24 * 3_600_000) return; // respect a recent "not yet"
    evoTarget = nextEvolution(dexId);
    if (evoTarget) {
      evoOffer = true;
      say(pick(evolveOfferLines), 11000);
    }
  }

  async function declineEvolution() {
    evoOffer = false;
    await setMeta(`evo_declined_${dexId}`, String(Date.now()));
    say(pick(evolveDeclineLines), 7000);
  }

  function acceptEvolution() {
    if (!evoTarget) return;
    evoOffer = false;
    startEvolutionCeremony(evoTarget);
  }

  // The white-silhouette flicker → reveal flash → new form. Used by the manual
  // offer and by auto-evolve. Keeps nickname + all memory; only the form changes.
  function startEvolutionCeremony(target: DexEntry) {
    if (evoActive) return;
    evoTarget = target;
    evoActive = true;
    poke();
    let t = 0;
    let gap = 300;
    const flick = () => {
      evoShowNew = !evoShowNew;
      gap = Math.max(70, gap - 22);
      t += gap;
      if (t < 2400) {
        setTimeout(flick, gap);
      } else {
        // bright reveal flash → the new form, in color
        evoFlash = true;
        evoShowNew = true;
        playVoiceClip("whoa-you-evolved", 0.9);
        setTimeout(async () => {
          dexId = target.id;
          await setMeta("dex_id", String(target.id));
          evoCount += 1;
          await setMeta("evo_count", String(evoCount));
          await addMemory("note", { text: `evolved into ${displayName(target.name)}` });
          playCry(target.id, 1);
        }, 220);
        setTimeout(() => {
          evoFlash = false;
          evoActive = false;
          evoShowNew = false;
          evoTarget = null;
          say(pick(evolveDoneLines), 10000);
        }, 900);
      }
    };
    flick();
  }

  async function onMeetingDone(creature: Creature, name: string, building: string) {
    await setMeta("dex_id", String(creature.dexId));
    await setMeta("pet_name", name);
    await setMeta("first_met", new Date().toISOString());
    if (building.trim()) await addMemory("seed", { text: building.trim() });
    dexId = creature.dexId;
    petName = name;
    phase = "home";
    await initPresence({ say, setState: (s) => (petState = s) }, { greet: false });
    say(pick(firstMeetingClose), 9000);
    voiceCry(creature.dexId, creature.name, 0.25);
  }

  function onPetTap() {
    poke();
    if (evoActive) return;
    bumpCounter("interactions").then(() => maybeOfferEvolution()); // bond deepens, may be ready to grow
    if (switchFx !== "none" || evoOffer) return;
    if (Math.random() < 0.12) {
      attack();
      return;
    }
    petState = "happy";
    setTimeout(() => (petState = "idle"), 950);
    // usually just a silent bounce — presence > conversation
    if (Math.random() < 0.08) voiceCry(dexId, displayName(dexEntry(dexId)?.name ?? petName), 0.2);
    else if (Math.random() < 0.25) say(pick(pokeReactions), 2500);
  }

  // "Today felt like…" — a lighter, one-word check-in that still feeds the mood timeline
  const FELT_MOOD: Record<string, Mood> = {
    good: "good", hopeful: "good", peaceful: "good",
    messy: "uncertain", strange: "uncertain",
    heavy: "low", hard: "low"
  };
  async function onTodayFelt(word: string) {
    panel = "none";
    poke();
    await addMemory("mood", { mood: FELT_MOOD[word] ?? "uncertain", text: `today felt ${word}` });
    await bumpCounter("interactions");
    const warm = ["good", "hopeful", "peaceful"].includes(word);
    say(warm ? "Glad today held some of that." : "Noted. Some days just are — I'm here.", 6500);
    petState = "happy";
    setTimeout(() => (petState = "idle"), 1200);
  }

  async function onMoodSave(mood: Mood, note: string) {
    panel = "none";
    poke();
    await addMemory("mood", { mood, text: note.trim() || undefined });
    await bumpCounter("interactions");
    moodGlow = MOOD_COLORS[mood]; // emotional weather: the room takes the tint
    setTimeout(() => (moodGlow = ""), 90_000);

    // Comfort Mode — heavy moods soften the pet for a while; a good day lifts it.
    if (mood === "good") {
      await setMeta("comfort_until", "0");
      comfortMode = false;
    } else {
      const hrs = mood === "low" ? 24 : mood === "stressed" || mood === "frustrated" ? 14 : 0;
      if (hrs) {
        await setMeta("comfort_until", String(Date.now() + hrs * 3_600_000));
        if (!comfortMode) void bumpCounter("t_comfort"); // drift: calm temperament
        comfortMode = true;
      }
    }

    // gentle burnout awareness — once every 3 days at most, never a diagnosis
    if (mood !== "good") {
      const heavy = await hardMoodCount(7);
      const lastNote = Number((await getMeta("last_burnout_note")) ?? 0);
      if (heavy >= 3 && Date.now() - lastNote > 3 * 86_400_000) {
        await setMeta("last_burnout_note", String(Date.now()));
        say(pick(burnoutLines), 12000);
        return;
      }
    }

    // memory retrieval beats generic comfort — "we've been here before"
    const past = mood !== "good" ? await findFamiliar(mood) : null;
    if (past) say(familiarLine(mood, monthOf(past.created_at)), 12000);
    else say(pick(moodResponses[mood]), 9000);

    // in comfort mode, gently offer something familiar — the Vault for the heaviest
    // days, the lighter Good Things Jar otherwise.
    if (comfortMode && mood !== "good") {
      const hint = mood === "low" ? " (🫂)" : " (🫙)";
      setTimeout(() => say(pick(comfortOffer) + hint, 9000), 9500);
    }
  }

  async function onLogSave(kind: MemoryKind, text: string) {
    panel = "none";
    poke();
    await addMemory(kind, { text });
    await bumpCounter("interactions");
    if (kind === "win" || kind === "survived") {
      attack(signatureMove(dexId)); // strongest move for the celebration
      runDelightBurst("fireworks", 60_000); // 1 full minute of crackers for a win/survived
      if (!focusMode) playVoiceClip(["that-was-awesome", "congrats", "awesome"], 0.85, 0.5);
    } else if (kind === "praise") {
      // tender, not triumphant — a soft glow, no fireworks
      moodGlow = "#f0a8d8";
      setTimeout(() => (moodGlow = ""), 30_000);
    }
    if (kind !== "praise") {
      petState = "happy";
      setTimeout(() => (petState = "idle"), 1500);
    }
    const bank =
      kind === "win"
        ? winSaved
        : kind === "learned"
          ? learnedSaved
          : kind === "praise"
            ? praiseSaved
            : survivedSaved;
    say(pick(bank), 8000);
  }

  // ✕ tucks the companion into the system tray — it never truly leaves.
  // (Quit-for-real lives in the tray menu.) Soul: presence, "welcome back".
  async function quit() {
    const h = new Date().getHours();
    // end-of-night ritual: closing late, the pet says goodnight and settles to sleep
    // before tucking away — never just a cold exit. (Skips Focus / Just-There silence.)
    if ((h >= 22 || h < 5) && !focusMode && companionMode !== "just_there") {
      say(pick(endOfNightLines), 4000);
      petState = "sleeping";
      playVoiceClip("see-you-later", 0.85);
      setTimeout(() => getCurrentWindow().hide(), 2600);
    } else {
      playVoiceClip("see-you-later", 0.85);
      setTimeout(() => getCurrentWindow().hide(), 900);
    }
  }

  // ---- launch on startup ----
  let autostartOn = $state(false);
  async function refreshAutostart() {
    try {
      autostartOn = await isEnabled();
    } catch {
      autostartOn = false;
    }
  }
  async function toggleAutostart() {
    try {
      if (autostartOn) await disable();
      else await enable();
    } catch {
      // plugin unavailable (e.g. web preview) — ignore
    }
    await refreshAutostart();
  }

  // ---- startup "ask first" ----  when Windows boot-launches us (autostart adds a
  // --autostarted arg), greet and ASK before settling in. "Not now" quietly quits.
  let startupAsk = $state(false);
  async function checkStartupLaunch(): Promise<boolean> {
    try {
      const boot = await invoke<boolean>("is_autostart_launch");
      startupAsk = boot;
      return boot;
    } catch {
      return false; // not under Tauri
    }
  }
  function startupYes() {
    startupAsk = false; // settle in — the presence system handles the greeting
  }
  async function startupNo() {
    startupAsk = false;
    try { await invoke("quit_app"); } catch { /* ignore */ }
  }
</script>

<svelte:window onkeydown={onShortcut} onmousemove={onMouseLook} />

<main
  class="widget"
  class:idle={idleNow}
  class:ground-mode={bgStyle === "ground"}
  class:no-bg={bgStyle === "off"}
  style="--orbr: {Math.round((imgSize + 84) / 2)}px; --wo: {widgetOpacity}"
  onpointerdown={() => phase === "home" && poke()}
  onpointerenter={() => (hovering = true)}
  onpointerleave={() => {
    hovering = false;
    resetLook();
  }}
  onpointermove={trackLook}
  onwheel={onWheel}
>
  {#if phase === "meeting"}
    <FirstMeeting onDone={onMeetingDone} />
  {:else if phase === "home"}
    {#if panel === "mood"}
      <MoodCheckIn onSave={onMoodSave} onClose={() => (panel = "none")} />
    {:else if panel === "log"}
      <LogMemory onSave={onLogSave} onClose={() => (panel = "none")} />
    {:else if panel === "remind"}
      <RemindMe onClose={() => (panel = "none")} />
    {:else if panel === "switch"}
      <SwitchCompanion
        currentDexId={dexId}
        currentName={petName}
        {autoMinutes}
        {autoMode}
        canEvolve={hasEvolution(dexId)}
        onPick={switchTo}
        onAutoSave={setAutoSwitch}
        onSaveName={async (newName) => {
          petName = newName;
          await setMeta("pet_name", newName);
          say(`✦ Nickname saved — ${newName}!`, 3000);
        }}
        onClose={() => (panel = "none")}
      />
    {:else if panel === "journey"}
      <JourneyPanel
        {petName}
        {dexId}
        temperament={petTemperament?.summary ?? ""}
        onClose={() => (panel = "none")}
        onChapterClose={(name) => {
          poke();
          runDelightBurst("fireworks", 60_000);
          const line = chapterCloseLine(name);
          say(line, 12000);
          announce(line);
        }}
      />
    {:else if panel === "jar"}
      <GoodThingsJar onClose={() => (panel = "none")} />
    {:else if panel === "note"}
      <LeaveNote {petName} onClose={() => (panel = "none")} />
    {:else if panel === "vault"}
      <VaultPanel {petName} onClose={() => (panel = "none")} />
    {:else if panel === "future"}
      <FutureSelf {petName} onClose={() => (panel = "none")} />
    {:else if panel === "today"}
      <TodayFelt onPick={onTodayFelt} onClose={() => (panel = "none")} />
    {:else if panel === "code"}
      <CodePanel
        localPath={watchingRepo}
        remoteUrl={watchingRemote}
        {hasToken}
        onSetLocal={setLocal}
        onStopLocal={stopLocal}
        onSetRemote={setRemote}
        onStopRemote={stopRemote}
        onSaveToken={setToken}
        onClearToken={clearToken}
        onTest={testReact}
        onShowcase={() => (panel = "showcase")}
        onCard={() => generateCard(false)}
        onClose={() => (panel = "none")}
        {gpuAvailable}
        {gpu}
        {trainAware}
        onToggleTrain={(on) => void setTrainAware(on)}
        {flowAware}
        onToggleFlow={(on) => void setFlowAware(on)}
        {audioAware}
        onToggleAudio={(on) => void setAudioAware(on)}
        {logPath}
        {trainStatus}
        onSetLog={(p) => void setLogPath(p)}
        onStopLog={() => void stopLog()}
        onTestTrain={() => trainReact("done")}
        onTestCrash={() => trainReact("crash")}
      />
    {/if}

    {#if panel === "wrapped"}
      <YearInReview {petName} {dexId} shiny={isShiny} onClose={() => (panel = "none")} />
    {/if}

    {#if panel === "movie"}
      <JourneyMovie
        {petName}
        {dexId}
        shiny={isShiny}
        temperament={petTemperament?.summary ?? ""}
        onClose={() => (panel = "none")}
      />
    {/if}

    {#if panel === "showcase"}
      <Showcase {petName} {dexId} shiny={isShiny} handle={ghHandle} onClose={() => (panel = "none")} />
    {/if}

    {#if bondCeremony}
      <div class="bondceremony" aria-hidden="true">
        <div class="bc-inner">
          <div class="bc-spark">✦</div>
          <div class="bc-label">{bondCeremony}</div>
          <div class="bc-sub">bond deepened</div>
        </div>
      </div>
    {/if}

    {#if cmdOpen}
      <CommandBar onRun={runCommand} onClose={() => (cmdOpen = false)} />
    {/if}

    {#if startupAsk}
      <div class="startup-ask" role="dialog" aria-label="Start Hearthmon?">
        <div class="sa-card">
          <img class="sa-pet" src={spriteUrl(dexId, isShiny)} alt="" onerror={(e) => ((e.target as HTMLImageElement).src = fallbackUrl(dexId))} />
          <p class="sa-q">Morning — want me around today?</p>
          <div class="sa-btns">
            <button class="sa-yes" onclick={startupYes}>Yes, stay</button>
            <button class="sa-no" onclick={startupNo}>Not now</button>
          </div>
        </div>
      </div>
    {/if}

    {#if isNight}
      <div class="nightveil" aria-hidden="true"></div>
      <span class="moon" aria-hidden="true">🌙</span>
    {/if}
    {#if comfortMode}
      <div class="comfortglow" aria-hidden="true"></div>
    {/if}
    {#if isWinter}
      <div class="snow" aria-hidden="true">
        {#each Array(18) as _, i (i)}
          <span
            class="flake"
            style="left: {(i * 5.6 + (i % 4) * 2) % 100}%; animation-delay: {(i % 9) * 0.7}s; animation-duration: {6 + (i % 5)}s; font-size: {7 + (i % 4) * 2}px"
            >❄</span
          >
        {/each}
      </div>
    {/if}
    <!-- Natural weather effects layer (wind / rain / snow / thunder) -->
    <WeatherFx kind={weatherKind} />

    {#if moodGlow}
      <div class="moodglow" style="--mg: {moodGlow}" aria-hidden="true"></div>
    {/if}
    {#if delight === "star"}
      <span class="shootingstar" aria-hidden="true">✦</span>
    {:else if delight === "rain"}
      {#each Array(14) as _, i (i)}
        <span
          class="raindrop"
          style="left: {6 + i * 7}%; animation-delay: {(i % 7) * 0.45}s"
          aria-hidden="true"></span>
      {/each}
    {:else if delight === "fireworks"}
      {#each [{ x: 28, y: 30, c: "#ffd94a", d: 0 }, { x: 64, y: 22, c: "#f85888", d: 450 }, { x: 46, y: 40, c: "#58a8f0", d: 900 }] as f (f.d)}
        <span
          class="firework"
          style="left: {f.x}%; top: {f.y}%; --fc: {f.c}; animation-delay: {f.d}ms"
          aria-hidden="true"></span>
      {/each}
    {/if}

    <!-- background drag handle: grabbing the empty box moves the window -->
    <div class="draglayer" role="presentation" aria-label="Drag to move widget" onpointerdown={startWinDrag}></div>

    {#if bgStyle !== "off" && switchFx === "none"}
      {#if bgStyle === "orb"}
        <!-- Glossy type-energy orb -->
        <div
          class="typebg typebg-orb"
          style="--tc: {TYPE_FX[curType]?.color ?? '#888'}; background: {backgroundFor(
            curType,
            dexId
          )}; width: {imgSize + 84}px; height: {imgSize + 84}px; opacity: calc(0.5 * {widgetOpacity})"
          aria-hidden="true"
        >
          {#each Array(5) as _, i (i)}
            <span
              class="mote"
              style="left: {12 + i * 19}%; animation-delay: {i * 1.1}s; animation-duration: {6 +
                (i % 3) * 2}s">{TYPE_FX[curType]?.emoji ?? '✦'}</span
            >
          {/each}
        </div>
      {:else if bgStyle === "ground"}
        <!-- Flat ground platform at the pet's feet -->
        <div
          class="typebg typebg-ground"
          style="--tc: {TYPE_FX[curType]?.color ?? '#888'}; --psize: {imgSize}px; background: {backgroundFor(
            curType,
            dexId
          )}; width: {imgSize + 110}px; opacity: calc(0.72 * {widgetOpacity})"
          aria-hidden="true"
        >
          {#each Array(3) as _, i (i)}
            <span
              class="mote"
              style="left: {18 + i * 28}%; animation-delay: {i * 1.4}s; animation-duration: {5 +
                i * 2}s">{TYPE_FX[curType]?.emoji ?? '✦'}</span
            >
          {/each}
        </div>
      {:else if bgStyle === "square"}
        <!-- Rounded card backdrop -->
        <div
          class="typebg typebg-square"
          style="--tc: {TYPE_FX[curType]?.color ?? '#888'}; background: {backgroundFor(
            curType,
            dexId
          )}; width: {imgSize + 70}px; height: {imgSize + 70}px; opacity: calc(0.5 * {widgetOpacity})"
          aria-hidden="true"
        >
          {#each Array(5) as _, i (i)}
            <span
              class="mote"
              style="left: {12 + i * 19}%; animation-delay: {i * 1.1}s; animation-duration: {6 +
                (i % 3) * 2}s">{TYPE_FX[curType]?.emoji ?? '✦'}</span
            >
          {/each}
        </div>
      {/if}
    {/if}

    {#if treat}
      <span class="treat" style="--from: {treat.from}px; --to: {treat.to}px" aria-hidden="true"
        >{treat.food}</span
      >
    {/if}

    <div class="stage" class:pixihide={renderMode === "alive"}>
      {#if habitatOn}
        <!-- Type Habitat: a Tiny Living Sanctuary chosen by the pet's type -->
        <div
          class="roombg"
          style="opacity: {0.96 * widgetOpacity}; border-radius: {habitatShape === 'sphere'
            ? '50%'
            : habitatShape === 'square'
              ? '10px'
              : '20px'}"
          aria-hidden="true"
        >
          <div class="r-wall" style="background: linear-gradient(180deg, {currentBiome.wall[0]}, {currentBiome.wall[1]})"></div>
          <!-- the window shows the biome's outside world (shape varies per biome) -->
          <div class="r-window w-{currentBiome.window}" class:moonlit={isNight} style="--lite: {currentBiome.light}">
            <div class="r-scene sc-{currentBiome.scene}" style="--lite: {currentBiome.light}"></div>
            {#if weatherEnabled && weatherKind === "rain"}<div class="r-rain"></div>{/if}
          </div>
          <div class="r-floor" style="background: linear-gradient(180deg, {currentBiome.floor[0]}, {currentBiome.floor[1]})"></div>
          <div class="r-seam"></div>
          <div class="r-beam" style="--lite: {currentBiome.light}"></div>
          <!-- lantern: midground identity prop, warmer with bond -->
          <div class="r-lantern" style="--lite: {currentBiome.light}; opacity: {lanternGlow}"></div>
          <div class="r-pool" style="--lite: {currentBiome.light}"></div>
          <!-- ground interaction: water ripples, embers, moss, snow… by type -->
          <div class="r-ground g-{currentBiome.ground}" style="--g: {currentBiome.groundColor}"></div>
          <div class="r-shadow"></div>
          {#each PARTICLES as m (m.i)}
            <span
              class="r-mote p-{currentBiome.particle}"
              style="left: {m.x}%; bottom: {m.y}%; width: {m.s}px; height: {m.s}px; background: {currentBiome.particleColor}; animation-delay: {m.d}s; animation-duration: {m.dur}s"
            ></span>
          {/each}
        </div>
        <!-- foreground vignette: sits in front of the pet → real depth -->
        <div class="roomfg" aria-hidden="true"></div>
      {/if}
      {#if switchFx !== "none"}
        <img
          class="ash"
          class:enter={switchFx === "recall" || switchFx === "ballout"}
          class:windup={switchFx === "gap"}
          class:throwing={switchFx === "throw"}
          class:leaving={switchFx === "release"}
          src={TRAINER_URL}
          alt="Trainer"
          style="width: {Math.round(imgSize * 0.95)}px"
          onerror={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      {/if}
      {#if visitor}
        <div class="visitor" style="transform: translateX(calc(-50% + {visitor.x}px))">
          <img
            src={spriteUrl(visitor.entry.id, visitor.shiny)}
            alt={displayName(visitor.entry.name)}
            style="width: {Math.round(imgSize * 0.8)}px; height: {Math.round(
              imgSize * 0.8
            )}px; transform: scaleX({visitor.flip ? -1 : 1})"
            onerror={(e) => ((e.target as HTMLImageElement).src = fallbackUrl(visitor!.entry.id))}
          />
        </div>
      {/if}
      <div
        class="mover"
        class:moving
        class:running
        class:hopping
        class:inroom={habitatOn}
        style="transform: translateX({petX}px); transition-duration: {moveDur}s; --dir: {dir}; --psize: {imgSize}px; --atkcolor: {attackMove?.color ?? '#fff'}; --rim: {currentBiome.rim || 'transparent'}"
      >
        <Bubble text={bubble} />
        {#if attackMove}
          <div class="callout" style="color: {attackMove.color}">{attackMove.name}!</div>
        {/if}
        <div
          class="petwrap"
          class:recall={switchFx === "recall"}
          class:release={switchFx === "release"}
          class:attacking={attacking && attackMove?.cls !== 1}
          class:channeling={attacking && attackMove?.cls === 1}
          class:jump={oneShot === "jump"}
          class:spin={oneShot === "spin"}
          class:dust={oneShot === "dust"}
          class:blink={oneShot === "blink"}
          class:tilt={oneShot === "tilt"}
          class:perk={oneShot === "perk"}
          class:stretch={ritualStretch}
          class:eat={eating}
        >
          {#if birthday}
            <span class="bday-hat" aria-hidden="true">🎉</span>
          {/if}
          {#if dreaming}
            <span class="dreambubble" aria-hidden="true">💭{dreaming}</span>
          {/if}
          {#if evoActive}
            <!-- classic evolution: a white silhouette flickering between the two forms -->
            <img
              class="evosil"
              class:revealed={evoFlash}
              src={spriteUrl(evoShowNew && evoTarget ? evoTarget.id : dexId, isShiny)}
              alt="evolving"
              style="width: {imgSize}px; height: {imgSize}px"
            />
          {:else if switchFx === "ballout" || switchFx === "throw"}
            <div class="pokeball" class:flyout={switchFx === "ballout"} class:throwin={switchFx === "throw"}></div>
          {:else if switchFx === "gap"}
            <!-- empty stage: the trainer is winding up the throw -->
            <div class="gapspace"></div>
          {:else}
            <Pet
              {dexId}
              name={petName}
              state={petState}
              flip={dir === 1}
              size={imgSize}
              shiny={isShiny}
              type={curType}
              {lookX}
              {lookY}
              {lookTilt}
              onTap={onPetTap}
              onPet={onPetStroke}
            />
          {/if}
        </div>
        {#if attacking && (atkKind === "beam" || atkKind === "bolt")}
          <div class="minibeam" aria-hidden="true"></div>
        {/if}
        {#if attacking && (atkKind === "orb" || atkKind === "stream")}
          <span class="projectile">{attackMove?.emoji}</span>
        {/if}
        {#if attacking && atkKind === "slash"}
          <div class="slasharc" aria-hidden="true"></div>
        {/if}
        {#if attacking && atkKind === "status"}
          <div class="aura" aria-hidden="true"></div>
        {/if}
        {#each particles as p (p.id)}
          <span
            class="particle"
            style="--dx: {p.dx}px; --dy: {p.dy}px; animation-delay: {p.delay}ms; font-size: {p.size}px"
            >{p.emoji}</span
          >
        {/each}
        {#if switchFx === "release"}
          <div class="burst" aria-hidden="true"></div>
          <div class="ring" aria-hidden="true"></div>
        {/if}
      </div>
      {#if butterfly}
        <span
          class="butterfly"
          style="--bfrom: {butterfly.from}px; --bto: {butterfly.to}px; animation-duration: {butterfly.dur}s"
          >🦋</span
        >
      {/if}
    </div>

    <!-- V2 preview: Pixi body + biome (visual; toggle with V). pointer-events off
         so window-drag, radial menu and panels keep working over it. -->
    {#if renderMode === "alive"}
      <div class="pixilayer">
        <PixiStage
          {dexId}
          shiny={isShiny}
          size={imgSize}
          {petState}
          {bubble}
          calm={comfortMode || deepWork()}
          flowContext={waitingMode() ? "waiting" : (Date.now() - lastFrictionCue < 30 * 60_000) ? "friction" : deepWork() ? "focus" : "none"}
          habitat={habitatOn}
          {habitatShape}
          {bgStyle}
          opacity={widgetOpacity}
          onTap={onPetTap}
          onStroke={onPetStroke}
          onBackgroundDown={beginWindowDrag}
          fx={aliveFx}
          {audioEnergy}
          {audioBeat}
          {audioStrength}
        />
      </div>
    {/if}

    {#if evoFlash}
      <div class="evoflash" aria-hidden="true"></div>
    {/if}

    {#if evoOffer && evoTarget}
      <div class="evo-offer">
        <p class="evo-q">Ready to grow — together?</p>
        <div class="evo-btns">
          <button class="evo-yes" onclick={acceptEvolution}>Evolve ✦</button>
          <button class="evo-no" onclick={declineEvolution}>Not yet</button>
        </div>
      </div>
    {/if}

    <!-- chrome (nameplate, rails, system cluster) hides while a panel or battle is open,
         so the open surface stands alone instead of buttons piling on top of it -->
    {#if panel === "none" && !battleOpen}
    <div class="nameplate">
      {petName}{#if dexEntry(dexId) && displayName(dexEntry(dexId)!.name) !== petName}
        <span class="species"> · {displayName(dexEntry(dexId)!.name)}</span>{/if}
      {#if isShiny}<span class="shinytag">✨</span>{/if}
    </div>

    <!-- Radial menu replaces both rails + syscluster -->
    <RadialMenu
      petSize={imgSize}
      {muted}
      {focusMode}
      roaming={toddler}
      {companionMode}
      {nightForced}
      {bgStyle}
      {weatherKind}
      soundPanelOpen={soundPanel}
      onTogglePanel={togglePanel}
      onFeed={feed}
      onPet={petOnce}
      onOpenBattle={openBattle}
      onSwitchRandom={() => switchTo(randomEntry(dexId))}
      onToggleMute={toggleMute}
      onToggleNight={toggleNight}
      onToggleFocus={toggleFocus}
      onToggleRoam={toggleToddler}
      onCycleMode={cycleMode}
      onCycleRoom={cycleRoom}
      onCycleBg={cycleBg}
      onCycleWeather={cycleWeatherManual}
      onNudgeScale={nudgeScale}
      onToggleSoundPanel={() => (soundPanel = !soundPanel)}
      onPushCard={pushCard}
      onQuit={quit}
      onMenuOpen={() => { petState = 'happy'; setTimeout(() => (petState = 'idle'), 800); }}
      onDirHint={onRadialDirHint}
    />

    <!-- transparency slider: fades the whole widget (pet + orb) -->
    <div class="opacitybar" title="Widget transparency">
      <span class="opicon">◑</span>
      <input
        type="range"
        min="20"
        max="100"
        value={Math.round(widgetOpacity * 100)}
        oninput={(e) => setWidgetOpacity(Number((e.target as HTMLInputElement).value) / 100)}
      />
    </div>
    {/if}

    {#if soundPanel}
      <div class="soundpanel">
        <label class="mute">
          <input type="checkbox" checked={!muted} onchange={toggleMute} /> sound on
        </label>
        {#each [{ ch: "voice" as const, label: "voices" }, { ch: "cry" as const, label: "cries" }, { ch: "fx" as const, label: "effects" }] as row (row.ch)}
          <label class="vol">
            <span>{row.label}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(vols[row.ch] * 100)}
              disabled={muted}
              oninput={(e) => setVol(row.ch, Number((e.target as HTMLInputElement).value) / 100)}
            />
          </label>
        {/each}
        <label class="mute startup">
          <input type="checkbox" checked={autostartOn} onchange={toggleAutostart} />
          launch at startup
        </label>
      </div>
    {/if}

    <!-- drag this corner to resize the whole companion -->
    <div
      class="resizeGrip"
      role="button"
      tabindex="-1"
      aria-label="Drag to resize"
      title="Drag to resize"
      onpointerdown={beginResize}
    ></div>

    <!-- celebrate button: right edge, vertical mid — tap to throw a 60s party -->
    {#if panel === "none" && !battleOpen && phase === "home"}
    <button
      id="celebrate-btn"
      class="celebrate-btn"
      class:celebrating={_burstInterval}
      title="Celebrate! 🎉"
      aria-label="Celebrate"
      onclick={celebrate}
    >🎉</button>
    {/if}

    {#if battleOpen}
      <BattleScene currentDexId={dexId} onClose={closeBattle} />
    {/if}
  {/if}
</main>

<style>
  .widget {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  /* ---- celebrate button: mirrors the ✦ radial trigger, right edge mid ---- */
  .celebrate-btn {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid rgba(180, 160, 240, 0.35);
    background: rgba(28, 22, 42, 0.82);
    color: rgba(200, 185, 240, 0.5);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.25s ease,
      color 0.25s,
      border-color 0.25s,
      background 0.25s,
      box-shadow 0.25s,
      transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1);
    padding: 0;
    user-select: none;
    -webkit-user-select: none;
  }
  .widget:hover .celebrate-btn {
    opacity: 1;
    pointer-events: all;
    color: rgba(220, 205, 255, 0.85);
  }
  .celebrate-btn:hover {
    color: #f0b66a;
    border-color: rgba(240, 182, 106, 0.6);
    background: rgba(50, 38, 68, 0.95);
    box-shadow: 0 0 18px rgba(240, 182, 106, 0.3), 0 2px 12px rgba(0,0,0,0.4);
    transform: translateY(-50%) scale(1.08);
  }
  .celebrate-btn:active {
    transform: translateY(-50%) scale(0.92);
  }
  .celebrate-btn.celebrating {
    opacity: 1;
    pointer-events: all;
    color: #f0b66a;
    border-color: rgba(240, 182, 106, 0.6);
    background: rgba(50, 38, 68, 0.95);
    animation: celebpulse 0.7s ease-in-out infinite alternate;
  }
  @keyframes celebpulse {
    from { box-shadow: 0 0 10px rgba(255,200,80,0.3), 0 2px 10px rgba(0,0,0,0.35); }
    to   { box-shadow: 0 0 24px rgba(255,200,80,0.8), 0 2px 14px rgba(0,0,0,0.4);  }
  }
  /* background drag handle fills the window; the pet sits above and re-enables clicks */
  .draglayer {
    position: absolute;
    inset: 0;
    z-index: 0;
    cursor: grab;
  }
  .draglayer:active {
    cursor: grabbing;
  }
  /* ---- cozy room: a micro-diorama (light + depth + grounding), not props ---- */
  .roombg {
    position: absolute;
    inset: 14px;
    border-radius: 20px;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    border: 1px solid rgba(180, 160, 240, 0.12);
    /* corner vignette: pulls the eye to the centre, sells "a place" */
    box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.6), inset 0 0 18px rgba(0, 0, 0, 0.4);
    animation: roomfade 0.6s ease;
  }
  @keyframes roomfade {
    from { opacity: 0 !important; }
  }
  .r-wall {
    position: absolute;
    inset: 0 0 34% 0; /* top 66% is wall */
  }
  .r-floor {
    position: absolute;
    inset: 66% 0 0 0; /* bottom 34% is floor */
  }
  /* the wall→floor seam: a thin lit baseboard that grounds the whole scene */
  .r-seam {
    position: absolute;
    left: 0;
    right: 0;
    top: 66%;
    height: 2px;
    margin-top: -1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45);
  }
  /* a big soft window in the upper-left of the wall — the room's light source */
  .r-window {
    position: absolute;
    left: 9%;
    top: 9%;
    width: 40%;
    height: 44%;
    border-radius: 12px;
    border: 3px solid rgba(14, 11, 22, 0.82);
    background: linear-gradient(155deg, var(--lite), rgba(16, 12, 26, 0.96) 80%);
    box-shadow: 0 0 26px var(--lite), inset 0 0 16px rgba(255, 255, 255, 0.22),
      0 5px 14px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }
  .r-window::before {
    content: "";
    position: absolute;
    left: 50%;
    top: -1px;
    bottom: -1px;
    width: 2px;
    margin-left: -1px;
    background: rgba(14, 11, 22, 0.7);
    z-index: 2; /* mullion sits over the scene */
  }
  .r-window::after {
    content: "";
    position: absolute;
    top: 50%;
    left: -1px;
    right: -1px;
    height: 2px;
    margin-top: -1px;
    background: rgba(14, 11, 22, 0.7);
    z-index: 2;
  }
  /* ---- biome-specific window silhouettes (each biome = a different world) ---- */
  /* wide low ocean opening — landscape, no cross bars */
  .r-window.w-ocean {
    left: 8%;
    top: 11%;
    width: 56%;
    height: 33%;
    border-radius: 12px;
  }
  .r-window.w-ocean::before,
  .r-window.w-ocean::after { display: none; }
  /* arched forge mouth (fire) — one vertical glazing bar under the crown */
  .r-window.w-arch {
    left: 10%;
    top: 9%;
    width: 38%;
    height: 46%;
    border-radius: 50% 50% 12px 12px / 62% 62% 12px 12px;
  }
  .r-window.w-arch::after { display: none; }
  .r-window.w-arch::before { top: 18%; }
  /* tall arched greenhouse glass */
  .r-window.w-greenhouse {
    left: 11%;
    top: 7%;
    width: 36%;
    height: 50%;
    border-radius: 50% 50% 6px 6px / 34% 34% 6px 6px;
    border-color: rgba(70, 92, 50, 0.85);
  }
  .r-window.w-greenhouse::before { top: 14%; }
  /* monitor / light panel (electric) — thin bezel, no mullion */
  .r-window.w-panel {
    left: 9%;
    top: 11%;
    width: 46%;
    height: 38%;
    border-radius: 8px;
    border-width: 4px;
    border-color: rgba(30, 40, 58, 0.92);
    box-shadow: 0 0 22px var(--lite), inset 0 0 18px rgba(120, 220, 255, 0.25),
      0 5px 14px rgba(0, 0, 0, 0.5);
  }
  .r-window.w-panel::before,
  .r-window.w-panel::after { display: none; }
  /* organic rock opening (cave) */
  .r-window.w-cave {
    left: 9%;
    top: 10%;
    width: 42%;
    height: 44%;
    border-radius: 58% 42% 52% 48% / 50% 56% 44% 50%;
    border-color: rgba(40, 30, 18, 0.85);
  }
  .r-window.w-cave::before,
  .r-window.w-cave::after { display: none; }
  /* porthole / moon window (ghost) */
  .r-window.w-round {
    left: 11%;
    top: 9%;
    width: 38%;
    height: 42%;
    border-radius: 50%;
    border-width: 4px;
  }
  .r-window.w-round::before,
  .r-window.w-round::after { display: none; }
  /* frosted cabin pane (ice) */
  .r-window.w-frost {
    border-color: rgba(150, 175, 200, 0.7);
    box-shadow: 0 0 22px #dbeeff, inset 0 0 16px rgba(255, 255, 255, 0.4),
      0 5px 14px rgba(0, 0, 0, 0.4);
  }
  /* pointed mountain-shrine opening (dragon) */
  .r-window.w-shrine {
    left: 11%;
    top: 7%;
    width: 34%;
    height: 50%;
    clip-path: polygon(50% 0, 100% 22%, 100% 100%, 0 100%, 0 22%);
    border: none;
    box-shadow: 0 0 22px var(--lite);
  }
  .r-window.w-shrine::before,
  .r-window.w-shrine::after { display: none; }
  /* observatory dome (psychic) */
  .r-window.w-dome {
    left: 10%;
    top: 8%;
    width: 40%;
    height: 46%;
    border-radius: 50% 50% 10px 10px / 78% 78% 10px 10px;
  }
  .r-window.w-dome::after { display: none; }
  .r-window.w-dome::before { top: 30%; }
  /* a diagonal shaft of light spilling from the window down onto the floor */
  .r-beam {
    position: absolute;
    left: 9%;
    top: 16%;
    width: 64%;
    height: 74%;
    background: linear-gradient(138deg, var(--lite), transparent 60%);
    opacity: 0.24;
    clip-path: polygon(0 0, 42% 0, 100% 100%, 0 72%);
    filter: blur(3px);
  }
  /* the warm pool where the beam lands on the floor */
  .r-pool {
    position: absolute;
    left: 30%;
    bottom: 13%;
    width: 48%;
    height: 30px;
    border-radius: 50%;
    background: radial-gradient(ellipse, var(--lite), transparent 70%);
    opacity: 0.26;
    filter: blur(2px);
  }
  /* a contact shadow directly under the pet's body — grounding (dark core) */
  .r-shadow {
    position: absolute;
    left: 50%;
    bottom: 23%;
    width: 40%;
    height: 15px;
    margin-left: -20%;
    border-radius: 50%;
    background: radial-gradient(
      ellipse,
      rgba(0, 0, 0, 0.62) 0%,
      rgba(0, 0, 0, 0.42) 38%,
      transparent 74%
    );
    filter: blur(1px);
  }
  /* rim-light: the window-side edge of the sprite picks up the room's light */
  .mover.inroom .petwrap {
    filter: drop-shadow(-2px -3px 2px var(--rim)) drop-shadow(0 4px 4px rgba(0, 0, 0, 0.35));
  }
  /* ---- window scenes: what the outside world looks like per biome ---- */
  .r-scene {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .sc-plain {
    background: linear-gradient(155deg, var(--lite), transparent 75%);
    opacity: 0.5;
  }
  .sc-ocean {
    background: linear-gradient(
      180deg,
      rgba(70, 100, 150, 0.55) 0%,
      rgba(24, 46, 78, 0.9) 50%,
      rgba(46, 86, 128, 0.75) 52%,
      rgba(10, 26, 46, 0.95) 100%
    );
  }
  .sc-ocean::before {
    content: "";
    position: absolute;
    left: 60%;
    top: 12%;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: radial-gradient(circle, #eaf2ff, rgba(200, 220, 255, 0.2) 70%, transparent);
    box-shadow: 0 0 14px #cfe0ff;
  }
  .sc-ocean::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 46%;
    background: repeating-linear-gradient(180deg, rgba(190, 215, 255, 0.18) 0 1px, transparent 1px 6px);
    animation: wave 5s linear infinite;
  }
  @keyframes wave {
    from { background-position: 0 0; }
    to { background-position: 0 6px; }
  }
  .sc-forest {
    background: radial-gradient(120% 90% at 50% 0%, rgba(150, 190, 110, 0.5), transparent 60%),
      linear-gradient(180deg, rgba(60, 95, 50, 0.85), rgba(24, 40, 20, 0.95));
  }
  .sc-forest::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 25% 60%, rgba(120, 170, 90, 0.5), transparent 30%),
      radial-gradient(circle at 70% 42%, rgba(150, 200, 110, 0.45), transparent 28%);
  }
  /* soft diagonal light rays through the greenhouse glass */
  .sc-forest::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      115deg,
      transparent 0%,
      rgba(220, 240, 170, 0.35) 18%,
      transparent 30%,
      rgba(220, 240, 170, 0.22) 48%,
      transparent 62%
    );
    animation: rays 7s ease-in-out infinite;
  }
  @keyframes rays {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.78; }
  }
  /* forge: warm glow rising from below + heat shimmer (fire) */
  .sc-forge {
    background: radial-gradient(
      circle at 50% 78%,
      rgba(255, 165, 75, 0.7),
      rgba(120, 42, 16, 0.92) 58%,
      rgba(40, 16, 8, 0.96)
    );
  }
  .sc-forge::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 90%, rgba(255, 212, 120, 0.6), transparent 46%);
    animation: heatshimmer 3s ease-in-out infinite;
  }
  @keyframes heatshimmer {
    0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.6; }
    50% { transform: translateY(-2px) scaleY(1.05); opacity: 0.88; }
  }
  .sc-snowfall {
    background: linear-gradient(180deg, rgba(90, 120, 150, 0.8), rgba(40, 58, 78, 0.95));
  }
  .sc-snowfall::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(2px 2px at 20% 10%, #fff, transparent),
      radial-gradient(2px 2px at 60% 30%, #fff, transparent),
      radial-gradient(1.5px 1.5px at 40% 60%, #fff, transparent),
      radial-gradient(2px 2px at 82% 50%, #fff, transparent);
    animation: snowdown 4s linear infinite;
  }
  @keyframes snowdown {
    from { background-position: 0 0, 0 0, 0 0, 0 0; }
    to { background-position: 0 40px, 0 36px, 0 44px, 0 38px; }
  }
  .sc-stars {
    background: linear-gradient(180deg, rgba(20, 34, 74, 0.95), rgba(6, 12, 30, 0.98));
  }
  .sc-stars::before,
  .sc-cosmos::after,
  .sc-city::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(1.5px 1.5px at 20% 25%, #fff, transparent),
      radial-gradient(1.5px 1.5px at 55% 15%, #dbe6ff, transparent),
      radial-gradient(1px 1px at 75% 40%, #fff, transparent),
      radial-gradient(1.5px 1.5px at 35% 55%, #fff, transparent),
      radial-gradient(1px 1px at 85% 65%, #cde, transparent);
    animation: twk 3.5s ease-in-out infinite;
  }
  @keyframes twk {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
  .sc-city {
    background: linear-gradient(180deg, rgba(44, 34, 80, 0.9), rgba(18, 12, 32, 0.97));
  }
  .sc-city::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 55%;
    background: repeating-linear-gradient(
      90deg,
      rgba(8, 6, 16, 0.95) 0 9px,
      transparent 9px 14px,
      rgba(8, 6, 16, 0.95) 14px 20px,
      transparent 20px 26px
    );
  }
  .sc-cave {
    background: radial-gradient(circle at 55% 40%, rgba(150, 110, 60, 0.45), rgba(20, 14, 8, 0.96) 70%);
  }
  .sc-cave::after {
    content: "";
    position: absolute;
    left: 30%;
    top: 52%;
    width: 8px;
    height: 8px;
    background: radial-gradient(circle, #bfe6ff, transparent);
    box-shadow: 0 0 8px #9fd0ff;
    animation: twk 3s ease-in-out infinite;
  }
  .sc-neon {
    background: linear-gradient(180deg, rgba(14, 22, 38, 0.95), rgba(6, 10, 20, 0.98));
  }
  .sc-neon::before {
    content: "";
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      180deg,
      transparent 0 8px,
      rgba(120, 220, 255, 0.35) 8px 9px,
      transparent 9px 18px,
      rgba(255, 120, 200, 0.3) 18px 19px,
      transparent 19px 28px
    );
    animation: neon 4s linear infinite;
  }
  @keyframes neon {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 0.9; }
  }
  .sc-cosmos {
    background: radial-gradient(circle at 42% 35%, rgba(170, 90, 210, 0.55), rgba(18, 10, 40, 0.96) 70%);
  }
  /* ---- the lantern: a warm midground identity prop (warmer with bond) ---- */
  .r-lantern {
    position: absolute;
    left: 80%;
    bottom: 30%;
    width: 16px;
    height: 22px;
    border-radius: 6px;
    background: radial-gradient(circle at 50% 40%, var(--lite), rgba(40, 28, 16, 0.9));
    box-shadow: 0 0 18px var(--lite), 0 0 7px var(--lite);
    animation: lampflick 4s ease-in-out infinite;
  }
  @keyframes lampflick {
    0%, 100% { filter: brightness(1); }
    45% { filter: brightness(1.12); }
    70% { filter: brightness(0.95); }
  }
  /* ---- ground interaction under the pet, per biome type ---- */
  .r-ground {
    position: absolute;
    left: 50%;
    bottom: 16%;
    width: 52%;
    height: 20px;
    margin-left: -26%;
    border-radius: 50%;
  }
  .g-warm,
  .g-moss {
    background: radial-gradient(ellipse, var(--g), transparent 71%);
    opacity: 0.5;
    filter: blur(2px);
  }
  .g-stone {
    background: radial-gradient(ellipse, var(--g), transparent 74%);
    opacity: 0.4;
    filter: blur(1.5px);
  }
  .g-snow {
    background: radial-gradient(ellipse, var(--g), transparent 72%);
    opacity: 0.6;
    filter: blur(2px);
  }
  .g-ember {
    background: radial-gradient(ellipse, var(--g), transparent 68%);
    opacity: 0.55;
    filter: blur(2px);
    animation: emberflick 3.2s ease-in-out infinite;
  }
  .g-cyber {
    height: 8px;
    bottom: 18%;
    border: 1.5px solid var(--g);
    box-shadow: 0 0 8px var(--g), inset 0 0 6px var(--g);
    opacity: 0.6;
    animation: sparkpulse 2.4s ease-in-out infinite;
  }
  .g-fog {
    background: radial-gradient(ellipse, var(--g), transparent 75%);
    opacity: 0.5;
    filter: blur(3px);
    animation: fogdrift 6s ease-in-out infinite;
  }
  .g-cosmic {
    background: radial-gradient(ellipse, var(--g), transparent 70%);
    opacity: 0.55;
    filter: blur(1.5px);
    box-shadow: 0 0 10px var(--g);
  }
  /* water: a reflective puddle with slow concentric ripples (gold standard) */
  .g-water {
    background: radial-gradient(ellipse at 50% 50%, var(--g), transparent 70%);
    opacity: 0.6;
    filter: blur(1px);
  }
  .g-water::before,
  .g-water::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    border: 1.5px solid var(--g);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    animation: ripple 4.4s ease-out infinite;
  }
  .g-water::after { animation-delay: 2.2s; }
  @keyframes ripple {
    0% { width: 12%; height: 24%; opacity: 0.55; }
    100% { width: 94%; height: 135%; opacity: 0; }
  }
  @keyframes emberflick {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.66; }
  }
  @keyframes sparkpulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 0.7; }
  }
  @keyframes fogdrift {
    0%, 100% { transform: translateX(-4px); }
    50% { transform: translateX(4px); }
  }
  /* ---- ambient particles: kind comes from the biome ---- */
  .r-mote {
    position: absolute;
    border-radius: 50%;
    opacity: 0;
    filter: blur(0.5px);
  }
  .p-dust { animation: pRise linear infinite; }
  .p-pollen { animation: pRise linear infinite; filter: blur(0.8px); }
  .p-firefly {
    animation: pFirefly ease-in-out infinite;
    box-shadow: 0 0 5px rgba(255, 235, 150, 0.85);
    filter: blur(0.3px);
  }
  .p-ember {
    animation: pEmber ease-in infinite;
    box-shadow: 0 0 5px rgba(255, 140, 60, 0.8);
  }
  .p-spark {
    animation: pSpark linear infinite;
    box-shadow: 0 0 5px rgba(150, 230, 255, 0.9);
  }
  .p-snow { animation: pSnow linear infinite; filter: blur(0.4px); }
  .p-star { animation: pStar ease-in-out infinite; }
  .p-mist {
    animation: pMist ease-in-out infinite;
    filter: blur(2px);
    border-radius: 40%;
  }
  @keyframes pRise {
    0% { opacity: 0; transform: translateY(0) translateX(0); }
    15% { opacity: 0.7; }
    50% { opacity: 0.55; transform: translateY(-24px) translateX(6px); }
    100% { opacity: 0; transform: translateY(-50px) translateX(-4px); }
  }
  @keyframes pFirefly {
    0%, 100% { opacity: 0; transform: translateY(0); }
    20% { opacity: 0.95; }
    40% { opacity: 0.25; }
    60% { opacity: 0.9; transform: translateY(-16px) translateX(8px); }
    80% { opacity: 0.3; }
    95% { opacity: 0.6; transform: translateY(-30px) translateX(-2px); }
  }
  @keyframes pEmber {
    0% { opacity: 0; transform: translateY(0) scale(1); }
    15% { opacity: 0.9; }
    70% { opacity: 0.5; }
    100% { opacity: 0; transform: translateY(-44px) translateX(5px) scale(0.6); }
  }
  @keyframes pSpark {
    0%, 100% { opacity: 0; }
    10% { opacity: 0.95; }
    14% { opacity: 0.2; }
    22% { opacity: 0.85; }
    60% { opacity: 0; transform: translateY(-6px) translateX(4px); }
  }
  @keyframes pSnow {
    0% { opacity: 0; transform: translateY(-6px) translateX(0); }
    12% { opacity: 0.85; }
    100% { opacity: 0; transform: translateY(40px) translateX(8px); }
  }
  @keyframes pStar {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.95; }
  }
  @keyframes pMist {
    0% { opacity: 0; transform: translateX(0); }
    25% { opacity: 0.5; }
    75% { opacity: 0.45; }
    100% { opacity: 0; transform: translateX(26px); }
  }
  /* rain streaks inside the window pane (when weather is raining) */
  .r-rain {
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      76deg,
      rgba(255, 255, 255, 0.16) 0 1px,
      transparent 1px 7px
    );
    opacity: 0.55;
    animation: wrain 0.5s linear infinite;
  }
  @keyframes wrain {
    from { background-position: 0 0; }
    to { background-position: 7px 22px; }
  }
  /* cooler moon-tinted pane at night */
  .r-window.moonlit {
    box-shadow: 0 0 26px #bcd2ff, inset 0 0 16px rgba(255, 255, 255, 0.28),
      0 5px 14px rgba(0, 0, 0, 0.45);
    filter: hue-rotate(8deg) brightness(1.04);
  }
  /* foreground vignette in front of the pet → cinematic depth */
  .roomfg {
    position: absolute;
    inset: 14px;
    border-radius: 20px;
    z-index: 2;
    pointer-events: none;
    box-shadow: inset 0 -34px 44px rgba(0, 0, 0, 0.4),
      inset 0 0 46px rgba(0, 0, 0, 0.22);
  }

  .stage {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* nudge slightly below true center so the bubble/callout have headroom */
    padding-top: 18px;
    /* empty areas are click-through to the drag layer; the pet re-enables itself */
    pointer-events: none;
    transition: -webkit-mask-position 0.2s ease;
    opacity: var(--wo, 1); /* user-adjustable widget transparency */
  }
  /* V2 preview swaps the CSS stage for the Pixi render */
  .stage.pixihide {
    display: none;
  }
  .pixilayer {
    position: absolute;
    inset: 0;
    z-index: 1; /* below chrome (radial 8–12, panels 5+) so menus stay clickable */
    pointer-events: auto; /* Alive renderer handles pet interaction + bg window-drag */
  }
  /* idle: clip the pet/shadow/bubble to the orb so only the sphere shows.
     on hover the mask lifts, so controls and overflow return. */
  .widget.idle .stage {
    -webkit-mask: radial-gradient(
      circle at 50% 52%,
      #000 var(--orbr, 110px),
      transparent calc(var(--orbr, 110px) + 10px)
    );
    mask: radial-gradient(
      circle at 50% 52%,
      #000 var(--orbr, 110px),
      transparent calc(var(--orbr, 110px) + 10px)
    );
  }
  /* Ground mode: no sphere clip — the pet and platform must show fully */
  .widget.ground-mode.idle .stage,
  .widget.no-bg.idle .stage {
    -webkit-mask: none;
    mask: none;
  }
  .mover {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition-property: transform;
    /* spring: glide, slight overshoot, settle — motion reads as intent, not a slide */
    transition-timing-function: cubic-bezier(0.32, 1.28, 0.5, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    .mover { transition-timing-function: ease-out; }
  }

  /* transparency slider along the bottom, revealed on hover */
  .opacitybar {
    position: absolute;
    bottom: 7px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 11px;
    border-radius: 999px;
    background: rgba(33, 28, 48, 0.92);
    border: 1px solid rgba(120, 108, 160, 0.45);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    opacity: 0;
    transition: opacity 0.25s ease;
    z-index: 6;
  }
  .widget:hover .opacitybar {
    opacity: 1;
  }
  .opacitybar input {
    width: 104px;
    accent-color: #f0b66a;
    cursor: pointer;
  }
  .opicon {
    font-size: 11px;
    color: #9d92bd;
  }

  /* corner resize grip — grab to scale the whole companion */
  .resizeGrip {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 16px;
    height: 16px;
    z-index: 7;
    cursor: nwse-resize;
    opacity: 0;
    transition: opacity 0.25s ease;
    background:
      linear-gradient(135deg, transparent 0 50%, #8d82ab 50% 60%, transparent 60% 70%, #8d82ab 70% 80%, transparent 80%);
  }
  .widget:hover .resizeGrip {
    opacity: 0.75;
  }
  .resizeGrip:hover {
    opacity: 1;
  }

  /* ---- walking / running / hopping ---- */
  .petwrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: calc(var(--psize, 110px) + 8px);
    justify-content: flex-end;
  }
  .mover.moving .petwrap {
    animation: trot 0.38s ease-in-out infinite;
  }
  .mover.running .petwrap {
    animation-duration: 0.22s;
  }
  .mover.hopping .petwrap {
    animation: hop 0.5s ease-in-out infinite;
  }
  @keyframes trot {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }
  @keyframes hop {
    0%,
    100% {
      transform: translateY(0) scale(1, 1);
    }
    30% {
      transform: translateY(-13px);
    }
    55% {
      transform: translateY(0) scale(1.06, 0.92);
    }
  }

  /* ---- one-shot moves: jump, spin ---- */
  .petwrap.jump {
    animation: bigjump 0.65s cubic-bezier(0.34, 1.3, 0.64, 1);
  }
  @keyframes bigjump {
    0%,
    100% {
      transform: translateY(0) scale(1, 1);
    }
    15% {
      transform: translateY(2px) scale(1.08, 0.88);
    }
    45% {
      transform: translateY(calc(var(--psize, 110px) * -0.35)) scale(0.96, 1.06);
    }
    80% {
      transform: translateY(0) scale(1.08, 0.9);
    }
  }
  .petwrap.spin {
    animation: spinaround 0.6s ease-in-out;
  }
  @keyframes spinaround {
    0% {
      transform: rotate(0);
    }
    100% {
      transform: rotate(calc(var(--dir) * 360deg));
    }
  }

  /* ---- daily ritual stretch — a gentle yawn-and-stretch on first launch ---- */
  .petwrap.stretch {
    animation: morningstretch 1.1s cubic-bezier(0.34, 1.3, 0.64, 1);
  }
  @keyframes morningstretch {
    0%   { transform: scaleY(1) scaleX(1); }
    18%  { transform: scaleY(0.88) scaleX(1.07); }  /* squish down */
    42%  { transform: scaleY(1.14) scaleX(0.93) translateY(-6px); } /* stretch tall */
    65%  { transform: scaleY(0.96) scaleX(1.04) translateY(0); }
    82%  { transform: scaleY(1.04) scaleX(0.98); }
    100% { transform: scaleY(1) scaleX(1); }
  }

  /* ---- return dust-off — a quick "kept things warm" shimmy ---- */
  .petwrap.dust {
    animation: dustoff 0.85s ease-in-out;
  }
  @keyframes dustoff {
    0%   { transform: rotate(0deg); }
    15%  { transform: rotate(-7deg); }
    35%  { transform: rotate(6deg); }
    55%  { transform: rotate(-4deg); }
    75%  { transform: rotate(3deg); }
    100% { transform: rotate(0deg); }
  }

  /* ---- ambient micro-fidgets (body language) ---- */
  .petwrap.blink,
  .petwrap.tilt {
    transform-origin: 50% 100%;
  }
  .petwrap.blink {
    animation: blink 0.18s ease;
  }
  @keyframes blink {
    0%, 100% { transform: scaleY(1); }
    50%      { transform: scaleY(0.8); }
  }
  .petwrap.tilt {
    animation: tilt 0.72s ease-in-out;
  }
  @keyframes tilt {
    0%, 100%  { transform: rotate(0deg); }
    30%, 70%  { transform: rotate(-5deg); }
  }
  .petwrap.perk {
    animation: perk 0.38s cubic-bezier(0.34, 1.4, 0.6, 1);
  }
  @keyframes perk {
    0%, 100% { transform: translateY(0) scale(1); }
    45%      { transform: translateY(-3px) scale(1.05); }
  }

  /* ---- bond-tier ceremony banner ---- */
  /* startup "ask first" prompt (boot-launch) */
  .startup-ask {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 6, 16, 0.62);
    backdrop-filter: blur(3px);
  }
  .sa-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 18px 22px;
    border-radius: 16px;
    background: linear-gradient(180deg, #1d1733, #15112a);
    border: 1px solid color-mix(in srgb, var(--tc, #f0b66a) 45%, transparent);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    max-width: 220px;
    text-align: center;
  }
  .sa-pet {
    width: 64px;
    height: 64px;
    image-rendering: pixelated;
    object-fit: contain;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.4));
  }
  .sa-q {
    margin: 0;
    font-size: 13.5px;
    color: #f6f1ff;
    font-weight: 600;
  }
  .sa-btns {
    display: flex;
    gap: 8px;
    margin-top: 2px;
  }
  .sa-btns button {
    border: none;
    border-radius: 9px;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .sa-yes {
    background: var(--tc, #f0b66a);
    color: #1a1208;
  }
  .sa-no {
    background: rgba(255, 255, 255, 0.08);
    color: #b9aee0;
  }
  .sa-no:hover { background: rgba(255, 255, 255, 0.14); }
  .sa-yes:hover { filter: brightness(1.08); }

  .bondceremony {
    position: absolute;
    inset: 0;
    z-index: 14;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    background: radial-gradient(ellipse at center, rgba(240, 182, 106, 0.16), transparent 65%);
    animation: bcfade 5.2s ease both;
  }
  .bc-inner {
    text-align: center;
    color: #ece6f7;
    animation: bcpop 0.7s cubic-bezier(0.2, 1.5, 0.4, 1) both;
  }
  .bc-spark {
    font-size: 30px;
    color: #f0b66a;
    filter: drop-shadow(0 0 12px rgba(240, 182, 106, 0.7));
    animation: bcspin 5s ease;
  }
  .bc-label {
    font-size: 21px;
    font-weight: 800;
    color: #f0d9a6;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
    margin-top: 2px;
  }
  .bc-sub {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #b6acce;
    margin-top: 3px;
  }
  @keyframes bcfade {
    0% { opacity: 0; }
    10% { opacity: 1; }
    82% { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes bcpop {
    from { transform: scale(0.7); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes bcspin {
    0% { transform: rotate(0) scale(1); }
    100% { transform: rotate(360deg) scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .bondceremony, .bc-inner, .bc-spark { animation-duration: 0.01s; }
  }

  /* ---- birthday party hat (day-we-met) ---- */
  .bday-hat {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 22px;
    z-index: 6;
    pointer-events: none;
    animation: bdaybob 2.2s ease-in-out infinite;
    filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.4));
  }
  @keyframes bdaybob {
    0%, 100% { transform: translateX(-50%) translateY(0) rotate(-6deg); }
    50% { transform: translateX(-50%) translateY(-4px) rotate(6deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .bday-hat { animation: none; }
  }

  /* ---- sleep dream bubble ---- */
  .dreambubble {
    position: absolute;
    top: -18px;
    left: 58%;
    z-index: 6;
    font-size: 16px;
    pointer-events: none;
    white-space: nowrap;
    animation: dreamfloat 5.2s ease-in-out both;
  }
  @keyframes dreamfloat {
    0% { opacity: 0; transform: translateY(6px) scale(0.8); }
    18% { opacity: 0.95; transform: translateY(0) scale(1); }
    82% { opacity: 0.95; transform: translateY(-6px); }
    100% { opacity: 0; transform: translateY(-12px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .dreambubble { animation: none; opacity: 0.9; }
  }

  /* ---- butterfly visitor ---- */
  .butterfly {
    position: absolute;
    bottom: calc(var(--psize, 110px) * 0.95);
    left: 50%;
    font-size: 14px;
    pointer-events: none;
    animation: flutter 6.5s ease-in-out forwards;
  }
  @keyframes flutter {
    0% {
      transform: translateX(var(--bfrom)) translateY(0) rotate(-8deg);
      opacity: 0;
    }
    8% {
      opacity: 1;
    }
    25% {
      transform: translateX(calc(var(--bfrom) * 0.5 + var(--bto) * 0.5 * 0.4)) translateY(-14px)
        rotate(8deg);
    }
    50% {
      transform: translateX(calc(var(--bfrom) * 0.2 + var(--bto) * 0.6)) translateY(-4px)
        rotate(-8deg);
    }
    75% {
      transform: translateX(var(--bto)) translateY(-18px) rotate(8deg);
      opacity: 1;
    }
    100% {
      transform: translateX(var(--bto)) translateY(-70px) rotate(0);
      opacity: 0;
    }
  }

  /* ---- move callout ("Thunderbolt!") ---- */
  .callout {
    position: absolute;
    bottom: calc(var(--psize, 110px) + 26px);
    left: 50%;
    transform: translateX(-50%);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
    text-shadow:
      0 1px 4px rgba(0, 0, 0, 0.75),
      0 0 14px currentColor;
    animation: calloutpop 1.1s ease-out forwards;
    pointer-events: none;
    z-index: 3;
  }
  @keyframes calloutpop {
    0% {
      transform: translateX(-50%) translateY(8px) scale(0.6);
      opacity: 0;
    }
    18% {
      transform: translateX(-50%) translateY(0) scale(1.08);
      opacity: 1;
    }
    30% {
      transform: translateX(-50%) scale(1);
    }
    75% {
      opacity: 1;
    }
    100% {
      transform: translateX(-50%) translateY(-10px);
      opacity: 0;
    }
  }

  /* ---- special: glowing orb shot ---- */
  .projectile {
    position: absolute;
    bottom: calc(var(--psize, 110px) * 0.5);
    left: 50%;
    width: 26px;
    height: 26px;
    line-height: 26px;
    text-align: center;
    font-size: 15px;
    border-radius: 50%;
    background: radial-gradient(circle, #fff 10%, var(--atkcolor) 50%, transparent 78%);
    box-shadow:
      0 0 12px var(--atkcolor),
      0 0 30px var(--atkcolor);
    pointer-events: none;
    animation: shoot 0.55s 0.35s ease-in both;
    z-index: 2;
  }
  @keyframes shoot {
    0% {
      transform: translateX(-50%) scale(0.4);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    100% {
      transform: translateX(calc(-50% + var(--dir) * var(--psize, 110px) * 1.3))
        translateY(-14px) scale(1.4);
      opacity: 0;
    }
  }

  /* ---- beam moves: a real beam from the pet ---- */
  .minibeam {
    position: absolute;
    bottom: calc(var(--psize, 110px) * 0.5);
    left: 50%;
    width: calc(var(--psize, 110px) * 1.5);
    height: 10px;
    margin-top: -5px;
    transform: scaleX(var(--dir));
    transform-origin: left center;
    border-radius: 5px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--atkcolor) 25%,
      #fff 50%,
      var(--atkcolor) 75%,
      transparent
    );
    box-shadow:
      0 0 12px var(--atkcolor),
      0 0 32px var(--atkcolor);
    animation: minibeamfire 0.8s 0.3s ease-out both;
    pointer-events: none;
    z-index: 2;
  }
  @keyframes minibeamfire {
    0% { clip-path: inset(0 100% 0 0); opacity: 0; }
    15% { clip-path: inset(0 0 0 0); opacity: 1; }
    40% { opacity: 0.8; }
    60% { opacity: 1; }
    100% { clip-path: inset(0 0 0 100%); opacity: 0; }
  }

  /* ---- physical: slash arc at the strike point ---- */
  .slasharc {
    position: absolute;
    bottom: calc(var(--psize, 110px) * 0.35);
    left: calc(50% + var(--dir) * var(--psize, 110px) * 0.45);
    width: calc(var(--psize, 110px) * 0.5);
    height: calc(var(--psize, 110px) * 0.5);
    border: 4px solid transparent;
    border-top-color: #fff;
    border-right-color: var(--atkcolor);
    border-radius: 50%;
    filter: drop-shadow(0 0 8px var(--atkcolor));
    pointer-events: none;
    animation: slashsweep 0.4s 0.32s ease-out both;
    z-index: 2;
  }
  @keyframes slashsweep {
    0% {
      transform: rotate(-80deg) scale(0.5);
      opacity: 0;
    }
    25% {
      opacity: 1;
    }
    100% {
      transform: rotate(160deg) scale(1.25);
      opacity: 0;
    }
  }

  /* ---- status: aura pulse ---- */
  .aura {
    position: absolute;
    bottom: 6px;
    left: 50%;
    width: calc(var(--psize, 110px) * 0.95);
    height: calc(var(--psize, 110px) * 0.95);
    border-radius: 50%;
    border: 2px solid var(--atkcolor);
    box-shadow:
      0 0 18px var(--atkcolor),
      inset 0 0 14px var(--atkcolor);
    opacity: 0;
    pointer-events: none;
    animation: aurapulse 1.1s ease-out forwards;
  }
  @keyframes aurapulse {
    0% {
      transform: translateX(-50%) scale(0.55);
      opacity: 0;
    }
    25% {
      opacity: 0.85;
    }
    100% {
      transform: translateX(-50%) scale(1.15);
      opacity: 0;
    }
  }
  .petwrap.channeling {
    animation: channelglow 1.1s ease-in-out;
  }
  @keyframes channelglow {
    0%,
    100% {
      filter: none;
    }
    40% {
      filter: drop-shadow(0 0 10px var(--atkcolor)) brightness(1.25);
    }
  }

  /* ---- nameplate: top-left pill (top-right belongs to the system cluster) ---- */
  .nameplate {
    position: absolute;
    top: 8px;
    left: 8px;
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 4px 14px;
    border-radius: 999px;
    background: rgba(33, 28, 48, 0.88);
    border: 1px solid rgba(120, 108, 160, 0.45);
    font-size: 11px;
    font-weight: 600;
    color: #e7e0f4;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.25s ease;
    pointer-events: none;
    z-index: 6;
  }
  .widget:hover .nameplate {
    opacity: 0.96;
  }
  .species {
    font-weight: 400;
    color: #b3a8d1;
  }
  .shinytag {
    margin-left: 4px;
  }
  .gapspace {
    height: calc(var(--psize, 110px) * 0.4);
  }

  /* ---- sound popover ---- */
  .soundpanel {
    position: absolute;
    top: 42px;
    right: 8px;
    z-index: 7;
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(33, 28, 48, 0.96);
    border: 1px solid rgba(120, 108, 160, 0.45);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    font-size: 11px;
    color: #c9bfe2;
  }
  .soundpanel .mute {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-weight: 600;
  }
  .soundpanel .mute input {
    accent-color: #f0b66a;
  }
  .soundpanel .startup {
    margin-top: 2px;
    padding-top: 7px;
    border-top: 1px solid rgba(120, 108, 160, 0.22);
    font-weight: 500;
    color: #9d92bd;
  }
  .soundpanel .vol {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .soundpanel .vol span {
    width: 44px;
    color: #9d92bd;
  }
  .soundpanel .vol input {
    width: 110px;
    accent-color: #f0b66a;
  }

  /* ---- Lonely Night Mode: dim veil + a quiet moon ---- */
  .nightveil {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background: radial-gradient(
      ellipse at 50% 100%,
      rgba(255, 190, 120, 0.06) 0%,
      rgba(10, 8, 24, 0.28) 60%,
      rgba(6, 5, 18, 0.42) 100%
    );
  }
  .moon {
    position: absolute;
    top: 34px;
    left: 14px;
    font-size: 17px;
    opacity: 0.75;
    pointer-events: none;
    z-index: 1;
    filter: drop-shadow(0 0 10px rgba(255, 240, 180, 0.5));
  }

  /* ---- emotional weather: the room takes the mood's tint, then it passes ---- */
  .moodglow {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 45%;
    pointer-events: none;
    z-index: 0;
    background: radial-gradient(ellipse at 50% 100%, var(--mg) 0%, transparent 70%);
    opacity: 0.14;
    transition: opacity 2s ease;
  }

  /* comfort mode: a warm, slow-breathing hearth-glow that just stays with you */
  .comfortglow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: radial-gradient(
      ellipse at 50% 78%,
      rgba(240, 170, 110, 0.16) 0%,
      rgba(220, 140, 90, 0.07) 45%,
      transparent 72%
    );
    animation: hearth 7s ease-in-out infinite;
  }
  @keyframes hearth {
    0%,
    100% {
      opacity: 0.65;
    }
    50% {
      opacity: 1;
    }
  }

  /* ---- type-themed background: orb (sphere) or ground (curved platform) ---- */
  .typebg {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    /* opacity is set inline = fraction * widgetOpacity so it dims with the slider */
    box-shadow: 0 0 26px 2px color-mix(in srgb, var(--tc) 45%, transparent);
    transition: opacity 0.4s ease;
  }

  /* Orb: perfect sphere, centered on the pet */
  .typebg-orb {
    top: 52%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    box-shadow:
      0 0 26px 2px color-mix(in srgb, var(--tc) 45%, transparent),
      inset 0 3px 10px rgba(255, 255, 255, 0.22),
      inset 0 -10px 22px rgba(0, 0, 0, 0.35);
  }
  /* glossy specular highlight for orb */
  .typebg-orb::before {
    content: "";
    position: absolute;
    top: 8%; left: 22%; width: 56%; height: 34%;
    border-radius: 50%;
    background: radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.6), transparent 70%);
    filter: blur(1px);
  }
  /* faint starfield clipped to orb */
  .typebg-orb::after {
    content: "";
    position: absolute; inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.55) 0.6px, transparent 0.7px);
    background-size: 9px 9px;
    opacity: 0.18;
  }

  /* Square: a rounded card, centered on the pet */
  .typebg-square {
    top: 52%;
    transform: translate(-50%, -50%);
    border-radius: 22px;
    box-shadow:
      0 0 26px 2px color-mix(in srgb, var(--tc) 45%, transparent),
      inset 0 3px 10px rgba(255, 255, 255, 0.16),
      inset 0 -10px 22px rgba(0, 0, 0, 0.3);
  }
  .typebg-square::after {
    content: "";
    position: absolute; inset: 0; border-radius: 22px;
    background-image: radial-gradient(rgba(255,255,255,0.5) 0.6px, transparent 0.7px);
    background-size: 9px 9px;
    opacity: 0.14;
  }

  /* Ground: flat elliptical platform sitting at the pet's feet */
  .typebg-ground {
    /* stage center ≈ 52% (padding-top shifts it slightly); feet = center + ~46% of psize */
    top: calc(52% + var(--psize, 110px) * 0.36);
    transform: translateX(-50%);
    /* flat ellipse — wide and shallow like a proper ground disc */
    height: calc(var(--psize, 110px) * 0.28);
    border-radius: 50%;
    box-shadow:
      0 -6px 32px 6px color-mix(in srgb, var(--tc) 60%, transparent),
      inset 0 6px 18px rgba(255,255,255,0.18),
      inset 0 -6px 14px rgba(0,0,0,0.28);
  }
  .typebg-ground::before {
    content: "";
    position: absolute;
    top: 8%; left: 18%; width: 64%; height: 48%;
    border-radius: 50%;
    background: radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.4), transparent 70%);
    filter: blur(2px);
  }

  .mote {
    position: absolute;
    bottom: 24%;
    font-size: 11px;
    opacity: 0.7;
    filter: drop-shadow(0 0 4px var(--tc));
    z-index: 1;
    animation-name: motefloat;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  }
  @keyframes motefloat {
    0% { transform: translateY(0) rotate(0); opacity: 0; }
    20% { opacity: 0.75; }
    80% { opacity: 0.6; }
    100% { transform: translateY(-44px) rotate(40deg); opacity: 0; }
  }

  /* ---- a treat tossed in, arcing toward the pet, then chomped ---- */
  .treat {
    position: absolute;
    bottom: calc(var(--psize, 110px) * 0.42);
    left: 50%;
    z-index: 3;
    font-size: 20px;
    pointer-events: none;
    filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.4));
    animation: treattoss 0.76s cubic-bezier(0.4, 0, 0.7, 1) forwards;
  }
  @keyframes treattoss {
    0% {
      transform: translateX(calc(-50% + var(--from))) translateY(-6px) scale(1) rotate(0);
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    55% {
      transform: translateX(calc(-50% + (var(--from) * 0.35 + var(--to) * 0.65))) translateY(-52px)
        scale(1.05) rotate(210deg);
    }
    88% {
      transform: translateX(calc(-50% + var(--to))) translateY(0) scale(1) rotate(355deg);
      opacity: 1;
    }
    100% {
      transform: translateX(calc(-50% + var(--to))) translateY(3px) scale(0.2) rotate(380deg);
      opacity: 0;
    }
  }
  /* the eat: a happy little chomp + bob */
  .petwrap.eat {
    animation: nom 0.42s ease 2;
  }
  @keyframes nom {
    0%, 100% { transform: translateY(0) scaleY(1); }
    45% { transform: translateY(5px) scaleY(0.88) scaleX(1.05); }
  }

  /* ---- winter: snow drifting past ---- */
  .snow {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
  }
  .flake {
    position: absolute;
    top: -14px;
    color: rgba(230, 240, 255, 0.85);
    text-shadow: 0 0 4px rgba(200, 225, 255, 0.6);
    animation-name: snowfall;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  @keyframes snowfall {
    0% {
      transform: translateY(0) translateX(0) rotate(0);
      opacity: 0;
    }
    12% {
      opacity: 0.9;
    }
    88% {
      opacity: 0.9;
    }
    100% {
      transform: translateY(105vh) translateX(18px) rotate(220deg);
      opacity: 0;
    }
  }

  /* ---- evolution ceremony ---- */
  .evosil {
    object-fit: contain;
    image-rendering: pixelated;
    /* turn the sprite into a glowing white silhouette */
    filter: brightness(0) invert(1) drop-shadow(0 0 10px #cfe6ff) drop-shadow(0 0 22px #9fd0ff);
    animation: evopulse 0.5s ease-in-out infinite alternate;
  }
  .evosil.revealed {
    /* the reveal: drop the silhouette, show true colors with a burst of glow */
    filter: drop-shadow(0 0 18px #fff) drop-shadow(0 0 40px #ffe9a8);
    animation: none;
    transform: scale(1.06);
  }
  @keyframes evopulse {
    from {
      transform: scale(0.97);
      opacity: 0.82;
    }
    to {
      transform: scale(1.04);
      opacity: 1;
    }
  }
  .evoflash {
    position: absolute;
    inset: 0;
    z-index: 9;
    pointer-events: none;
    background: radial-gradient(circle at 50% 55%, #ffffff 0%, rgba(255, 255, 255, 0.7) 35%, transparent 75%);
    animation: evoflash 0.9s ease-out forwards;
  }
  @keyframes evoflash {
    0% {
      opacity: 0;
    }
    25% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  .evo-offer {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 8;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 16px;
    background: rgba(28, 22, 44, 0.96);
    border: 1px solid rgba(180, 200, 255, 0.4);
    box-shadow: 0 6px 26px rgba(0, 0, 0, 0.5), 0 0 22px rgba(150, 190, 255, 0.18);
    animation: evopop 0.34s cubic-bezier(0.34, 1.4, 0.6, 1);
  }
  @keyframes evopop {
    from {
      opacity: 0;
      transform: translate(-50%, -46%) scale(0.92);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  .evo-q {
    margin: 0;
    font-size: 12.5px;
    color: #dce6ff;
    text-align: center;
  }
  .evo-btns {
    display: flex;
    gap: 8px;
  }
  .evo-yes,
  .evo-no {
    border-radius: 10px;
    border: 1px solid rgba(180, 200, 255, 0.4);
    padding: 6px 16px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
  }
  .evo-yes {
    background: linear-gradient(180deg, #acd0ff, #6fa8ee);
    color: #1a1630;
    font-weight: 700;
    border-color: transparent;
  }
  .evo-yes:hover {
    filter: brightness(1.08);
  }
  .evo-no {
    background: transparent;
    color: #9d92bd;
  }
  .evo-no:hover {
    border-color: #c4b5f0;
    color: #c4b5f0;
  }

  /* ---- micro-delights ---- */
  .shootingstar {
    position: absolute;
    top: 18%;
    left: -8%;
    font-size: 13px;
    color: #fff6d8;
    text-shadow:
      0 0 8px #ffec8a,
      -14px 4px 12px rgba(255, 236, 138, 0.5);
    pointer-events: none;
    z-index: 2;
    animation: starfly 2.4s ease-in forwards;
  }
  @keyframes starfly {
    0% { transform: translate(0, 0) rotate(-12deg) scale(0.7); opacity: 0; }
    12% { opacity: 1; }
    85% { opacity: 0.9; }
    100% { transform: translate(120vw, 26vh) rotate(-12deg) scale(1); opacity: 0; }
  }
  .raindrop {
    position: absolute;
    top: -14px;
    width: 1.5px;
    height: 11px;
    border-radius: 1px;
    background: linear-gradient(to bottom, transparent, rgba(150, 190, 240, 0.65));
    pointer-events: none;
    z-index: 2;
    animation: dropfall 1.6s linear infinite;
  }
  @keyframes dropfall {
    0% { transform: translateY(0); opacity: 0; }
    12% { opacity: 0.8; }
    92% { opacity: 0.7; }
    100% { transform: translateY(105vh); opacity: 0; }
  }
  .firework {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fc);
    pointer-events: none;
    z-index: 2;
    animation: fwboom 1.1s ease-out both;
    box-shadow:
      0 -22px 0 -1px var(--fc),
      0 22px 0 -1px var(--fc),
      22px 0 0 -1px var(--fc),
      -22px 0 0 -1px var(--fc),
      16px -16px 0 -2px var(--fc),
      -16px -16px 0 -2px var(--fc),
      16px 16px 0 -2px var(--fc),
      -16px 16px 0 -2px var(--fc);
  }
  @keyframes fwboom {
    0% { transform: scale(0.1); opacity: 0; }
    18% { transform: scale(0.45); opacity: 1; }
    65% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(1.35); opacity: 0; }
  }

  /* ---- wild visitor ---- */
  .visitor {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transition: transform 1.6s linear;
    pointer-events: none;
    z-index: 0;
  }
  .visitor img {
    object-fit: contain;
    image-rendering: pixelated;
    opacity: 0.95;
  }

  /* ---- attack: lunge + type particles ---- */
  .petwrap.attacking {
    animation: lunge 0.5s ease;
  }
  @keyframes lunge {
    0%,
    100% {
      transform: translateX(0);
    }
    18% {
      /* wind-up: pull back and crouch before the hit */
      transform: translateX(calc(var(--dir) * -12px)) scale(1.05, 0.92);
    }
    42% {
      transform: translateX(calc(var(--dir) * 36px)) rotate(calc(var(--dir) * -7deg))
        scale(0.97, 1.04);
    }
    65% {
      transform: translateX(calc(var(--dir) * 10px));
    }
  }
  .particle {
    position: absolute;
    bottom: calc(var(--psize, 110px) * 0.55);
    left: 50%;
    font-size: 15px;
    pointer-events: none;
    opacity: 0;
    animation: scatter 0.72s ease-out forwards;
  }
  @keyframes scatter {
    0% {
      transform: translate(-50%, 0) scale(0.5);
      opacity: 0;
    }
    18% {
      opacity: 1;
    }
    100% {
      transform: translate(calc(-50% + var(--dx)), var(--dy)) scale(1.2);
      opacity: 0;
    }
  }

  /* ---- Pokéball switch sequence ---- */
  .petwrap.recall {
    animation: recall 0.48s ease-in forwards;
  }
  @keyframes recall {
    0% {
      transform: scale(1);
      filter: none;
    }
    35% {
      filter: sepia(1) saturate(7) hue-rotate(-18deg) brightness(1.5);
    }
    100% {
      transform: scale(0.04) translateY(40px);
      filter: sepia(1) saturate(9) hue-rotate(-18deg) brightness(2.4);
      opacity: 0.85;
    }
  }
  .petwrap.release {
    animation: release 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  @keyframes release {
    0% {
      transform: scale(0.04) translateY(40px);
      filter: brightness(3.2);
    }
    65% {
      filter: brightness(1.7);
    }
    100% {
      transform: scale(1) translateY(0);
      filter: none;
    }
  }

  .pokeball {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: linear-gradient(
      to bottom,
      #e3350d 0%,
      #e3350d 44%,
      #1c1c1c 44%,
      #1c1c1c 56%,
      #f5f5f5 56%,
      #f5f5f5 100%
    );
    border: 2.5px solid #1c1c1c;
    position: relative;
    margin-bottom: 26px;
    box-shadow: 0 5px 12px rgba(0, 0, 0, 0.45);
  }
  .pokeball::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 11px;
    height: 11px;
    transform: translate(-50%, -50%);
    background: #f5f5f5;
    border: 3px solid #1c1c1c;
    border-radius: 50%;
  }
  /* ball returns to the trainer's hand at the left */
  .pokeball.flyout {
    animation: ballreturn 0.42s ease-in both;
  }
  @keyframes ballreturn {
    0% {
      transform: translate(0, 0) scale(1) rotate(0);
      opacity: 1;
    }
    20% {
      transform: translate(8px, -14px) scale(0.95) rotate(30deg);
    }
    100% {
      transform: translate(-160px, -95px) scale(0.45) rotate(-140deg);
      opacity: 0;
    }
  }
  /* the throw: arcs from the trainer's hand, spinning, lands with a bounce */
  .pokeball.throwin {
    animation: ballthrow 0.66s cubic-bezier(0.25, 0.6, 0.45, 1) both;
  }
  @keyframes ballthrow {
    0% {
      transform: translate(-185px, -90px) scale(0.55) rotate(0);
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    45% {
      transform: translate(-95px, -140px) scale(0.8) rotate(330deg);
    }
    78% {
      transform: translate(-8px, -16px) scale(1) rotate(620deg);
    }
    88% {
      transform: translate(0, 4px) scale(1.05, 0.92) rotate(700deg);
    }
    100% {
      transform: translate(0, 0) scale(1) rotate(720deg);
    }
  }

  /* ---- the trainer himself ---- */
  .ash {
    position: absolute;
    bottom: 10px;
    left: 8px;
    z-index: 1;
    image-rendering: pixelated;
    object-fit: contain;
    transform-origin: 50% 100%;
    pointer-events: none;
  }
  .ash.enter {
    animation: ashin 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
  }
  @keyframes ashin {
    from {
      transform: translateX(-130px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .ash.windup {
    animation: ashwind 0.7s ease both;
  }
  @keyframes ashwind {
    0% {
      transform: rotate(0);
    }
    45%,
    80% {
      transform: rotate(-9deg) translateY(-3px);
    }
    100% {
      transform: rotate(-6deg);
    }
  }
  .ash.throwing {
    animation: ashthrow 0.5s ease both;
  }
  @keyframes ashthrow {
    0% {
      transform: rotate(-8deg);
    }
    35% {
      transform: rotate(13deg) translateX(8px);
    }
    100% {
      transform: rotate(4deg);
    }
  }
  .ash.leaving {
    animation: ashout 0.55s 0.15s ease both;
  }
  @keyframes ashout {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(-130px);
      opacity: 0;
    }
  }

  .burst,
  .ring {
    position: absolute;
    bottom: calc(var(--psize, 110px) * 0.4);
    left: 50%;
    pointer-events: none;
  }
  .burst {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0) 70%);
    animation: burst 0.5s ease-out forwards;
  }
  @keyframes burst {
    0% {
      transform: translateX(-50%) scale(0.4);
      opacity: 1;
    }
    100% {
      transform: translateX(-50%) scale(13);
      opacity: 0;
    }
  }
  .ring {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid rgba(255, 244, 214, 0.9);
    animation: ringout 0.55s 0.05s ease-out forwards;
    opacity: 0;
  }
  @keyframes ringout {
    0% {
      transform: translateX(-50%) scale(0.5);
      opacity: 1;
    }
    100% {
      transform: translateX(-50%) scale(6.5);
      opacity: 0;
    }
  }

</style>
