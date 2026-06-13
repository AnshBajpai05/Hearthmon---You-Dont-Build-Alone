<script lang="ts">
  import { onMount } from "svelte";
  import {
    getCurrentWindow,
    currentMonitor,
    PhysicalPosition,
    PhysicalSize
  } from "@tauri-apps/api/window";
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
  import WeatherFx from "$lib/components/WeatherFx.svelte";
  import type { WeatherKind } from "$lib/components/WeatherFx.svelte";
  import RadialMenu from "$lib/components/RadialMenu.svelte";
  import {
    playCry,
    voiceCry,
    announceGo,
    playVoiceClip,
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
    bumpCounter,
    unreadLetter
  } from "$lib/db";
  import type { Mood, MemoryKind } from "$lib/db";
  import { initPresence, poke, setFocus } from "$lib/presence";
  import type { PetState } from "$lib/presence";
  import { daysTogether } from "$lib/bond";
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
    jarLines,
    letterReadyLines
  } from "$lib/lines";
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
    | "vault";
  // the full Ash sequence: recall beam → ball returns → "Name, go!" → thrown ball arcs in → release
  type SwitchFx = "none" | "recall" | "ballout" | "gap" | "throw" | "release";

  let phase = $state<"loading" | "meeting" | "home">("loading");
  let dexId = $state(0);
  let petName = $state("");
  let petState = $state<PetState>("idle");
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
  let bgStyle = $state<"orb" | "ground" | "off">("orb");
  const curType = $derived(dexEntry(dexId)?.type ?? "normal");
  async function cycleBg() {
    bgStyle = bgStyle === "orb" ? "ground" : bgStyle === "ground" ? "off" : "orb";
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

  function runDelight(kind: "star" | "rain" | "fireworks", ms: number) {
    if (delight !== "none") return;
    delight = kind;
    clearTimeout(delightTimer);
    delightTimer = setTimeout(() => (delight = "none"), ms);
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
  let oneShot = $state<"none" | "jump" | "spin">("none");
  let butterfly = $state<{ from: number; to: number; dur: number } | null>(null);

  // ---- attack state ----
  let attacking = $state(false);
  let attackMove = $state<Move | null>(null);
  let atkKind = $state<AnimKind | null>(null);
  let particles = $state<Particle[]>([]);

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

  function onWheel(e: WheelEvent) {
    if (phase !== "home" || panel !== "none" || battleOpen) return;
    e.preventDefault();
    nudgeScale(e.deltaY < 0 ? 0.1 : -0.1);
  }

  /** Grab the empty area (the "box" around the pet) to move the window. */
  async function startWinDrag(e: PointerEvent) {
    if (e.button !== 0) return;
    poke();
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // dragging unavailable in web preview
    }
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
    if (petAffection % 6 === 0) bumpCounter("interactions");
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
      // size the window for the pet and settle near the bottom-right
      await fitWindow(true);

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
      nightForced = (await getMeta("night_forced")) === "1";
      bgStyle = (await getMeta("bg_style") as ("orb" | "ground" | "off") | null) ?? "orb";
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
      await initPresence(
        { say, setState: (s) => (petState = s) },
        { onRitual: triggerRitual }
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
      if (days > 0 && (days % 365 === 0 || days % 30 === 0)) {
        const today = new Date().toDateString();
        if ((await getMeta("last_anniversary")) !== today) {
          hadAnniversary = true;
          await setMeta("last_anniversary", today);
          setTimeout(() => {
            say(anniversaryLine(days), 14000);
            runDelight("fireworks", 3200);
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
    })();

    const wanderTimer = setInterval(wanderTick, 4000);
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
    return () => {
      clearInterval(wanderTimer);
      clearInterval(autoTimer);
      clearInterval(nightTimer);
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
    if (comfortMode) {
      // calmer presence: only slow drifts and the occasional glance — no zoomies,
      // no attacks, no jumps. Just quietly here.
      if (r < 0.18) startMove("walk");
      else if (r < 0.24) dir = dir === 1 ? -1 : 1;
      else if (r < 0.255) runDelight("rain", 9000); // soft rain suits the mood
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

  async function zoomies() {
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
      runDelight("fireworks", 3200); // tiny fireworks after a milestone
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
    playVoiceClip("see-you-later", 0.85);
    setTimeout(() => getCurrentWindow().hide(), 900);
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
</script>

<main
  class="widget"
  class:idle={idleNow}
  class:ground-mode={bgStyle === "ground"}
  class:no-bg={bgStyle === "off"}
  style="--orbr: {Math.round((imgSize + 84) / 2)}px; --wo: {widgetOpacity}"
  onpointerdown={() => phase === "home" && poke()}
  onpointerenter={() => (hovering = true)}
  onpointerleave={() => (hovering = false)}
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
        onClose={() => (panel = "none")}
      />
    {:else if panel === "journey"}
      <JourneyPanel {petName} onClose={() => (panel = "none")} />
    {:else if panel === "jar"}
      <GoodThingsJar onClose={() => (panel = "none")} />
    {:else if panel === "note"}
      <LeaveNote {petName} onClose={() => (panel = "none")} />
    {:else if panel === "vault"}
      <VaultPanel {petName} onClose={() => (panel = "none")} />
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
    <div class="draglayer" onpointerdown={startWinDrag}></div>

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
      {/if}
    {/if}

    {#if treat}
      <span class="treat" style="--from: {treat.from}px; --to: {treat.to}px" aria-hidden="true"
        >{treat.food}</span
      >
    {/if}

    <div class="stage">
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
        style="transform: translateX({petX}px); transition-duration: {moveDur}s; --dir: {dir}; --psize: {imgSize}px; --atkcolor: {attackMove?.color ?? '#fff'}"
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
          class:stretch={ritualStretch}
          class:eat={eating}
        >
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
      {muted}
      {focusMode}
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
      onCycleBg={cycleBg}
      onCycleWeather={cycleWeatherManual}
      onNudgeScale={nudgeScale}
      onToggleSoundPanel={() => (soundPanel = !soundPanel)}
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
    transition-timing-function: linear;
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
