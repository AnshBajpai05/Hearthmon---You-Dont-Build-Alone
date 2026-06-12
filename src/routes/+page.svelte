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
  import { getMeta, setMeta, addMemory, findFamiliar, hardMoodCount, bumpCounter } from "$lib/db";
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
    firstMeetingClose,
    switchLines,
    burnoutLines,
    anniversaryLine,
    pokeReactions,
    jarLines,
    letterReadyLines
  } from "$lib/lines";
  import {
    dexEntry,
    randomEntry,
    displayName,
    spriteUrl,
    fallbackUrl,
    TRAINER_URL,
    type Creature,
    type DexEntry
  } from "$lib/sprites";
  import {
    makeParticles,
    randomMove,
    signatureMove,
    type Move,
    type Particle
  } from "$lib/attackfx";
  import { animKind, type AnimKind } from "$lib/fx";

  type Panel = "none" | "mood" | "log" | "remind" | "switch" | "journey" | "jar" | "note";
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
  let muted = $state(false);
  let focusMode = $state(false);
  let isNight = $state(false);
  let moodGlow = $state(""); // emotional weather: tint after a check-in
  let delight = $state<"none" | "star" | "rain" | "fireworks">("none");
  let delightTimer: ReturnType<typeof setTimeout> | undefined;

  // ---- daily opening ritual: stretch animation ----
  let ritualStretch = $state(false);
  function triggerRitual() {
    ritualStretch = true;
    setTimeout(() => (ritualStretch = false), 1200);
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

  // ---- pet size / window fit ----
  let scale = $state(1.5);
  let winW = $state(360);
  const imgSize = $derived(Math.round(110 * scale));
  let scaleTimer: ReturnType<typeof setTimeout> | undefined;

  function targetDims() {
    const img = Math.round(110 * scale);
    return { w: Math.max(320, img + 200), h: Math.max(380, img + 240) };
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

  function togglePanel(p: Panel) {
    const opening = panel !== p;
    panel = panel === p ? "none" : p;
    poke();
    if (opening && p === "switch") playVoiceClip("lets-go-catch-some-pokemon", 0.8, 0.3);
    if (opening && p === "jar") say(pick(jarLines), 5000);
    if (opening && p === "note") say(pick(letterReadyLines), 5000);
  }

  onMount(() => {
    (async () => {
      scale = Number((await getMeta("pet_scale")) ?? 0) || 1.5;
      // size the window for the pet and settle near the bottom-right
      await fitWindow(true);

      autoMinutes = Number((await getMeta("auto_switch_minutes")) ?? 0) || 0;

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
      if (days > 0 && (days % 365 === 0 || days % 30 === 0)) {
        const today = new Date().toDateString();
        if ((await getMeta("last_anniversary")) !== today) {
          await setMeta("last_anniversary", today);
          setTimeout(() => {
            say(anniversaryLine(days), 14000);
            runDelight("fireworks", 3200);
          }, 6000);
        }
      }
    })();

    const wanderTimer = setInterval(wanderTick, 4000);
    const autoTimer = setInterval(autoSwitchTick, 30_000);
    // Lonely Night Mode — the room dims after midnight
    const checkNight = () => {
      const h = new Date().getHours();
      isNight = h >= 0 && h < 5;
    };
    checkNight();
    const nightTimer = setInterval(checkNight, 5 * 60_000);
    return () => {
      clearInterval(wanderTimer);
      clearInterval(autoTimer);
      clearInterval(nightTimer);
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
      battleOpen
    );
  }

  function wanderTick() {
    if (busy()) return;
    const r = Math.random();
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

  // ---- auto-switch timer ----
  async function setAutoSwitch(mins: number) {
    autoMinutes = mins;
    await setMeta("auto_switch_minutes", String(mins));
    await setMeta("last_auto_switch", String(Date.now()));
  }

  async function autoSwitchTick() {
    // never mid-battle (it would fight the arena for the window),
    // never while asleep (we don't disturb a sleeping companion)
    if (!autoMinutes || phase !== "home" || switchFx !== "none" || battleOpen) return;
    if (petState === "sleeping") return;
    const last = Number((await getMeta("last_auto_switch")) ?? "0");
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
    if (switchFx !== "none" || entry.id === dexId) return;
    panel = "none";
    poke();
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
    bumpCounter("interactions"); // the bond deepens through genuine contact
    if (switchFx !== "none") return;
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
    }
    petState = "happy";
    setTimeout(() => (petState = "idle"), 1500);
    const bank = kind === "win" ? winSaved : kind === "learned" ? learnedSaved : survivedSaved;
    say(pick(bank), 8000);
  }

  async function quit() {
    playVoiceClip("see-you-later", 0.85);
    setTimeout(() => getCurrentWindow().close(), 1000);
  }
</script>

<main class="widget" onpointerdown={() => phase === "home" && poke()} onwheel={onWheel}>
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
    {/if}

    {#if isNight}
      <div class="nightveil" aria-hidden="true"></div>
      <span class="moon" aria-hidden="true">🌙</span>
    {/if}
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
        >
          {#if switchFx === "ballout" || switchFx === "throw"}
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

    <div class="nameplate">
      {petName}{#if dexEntry(dexId) && displayName(dexEntry(dexId)!.name) !== petName}
        <span class="species"> · {displayName(dexEntry(dexId)!.name)}</span>{/if}
      {#if isShiny}<span class="shinytag">✨</span>{/if}
    </div>

    <div class="sidebar">
      <button title="How are we doing?" onclick={() => togglePanel("mood")}>🙂</button>
      <button title="For the record…" onclick={() => togglePanel("log")}>✦</button>
      <button title="Remind me who I am" onclick={() => togglePanel("remind")}>🔥</button>
      <button title="Our journey" onclick={() => togglePanel("journey")}>📖</button>
      <button title="Good Things Jar" onclick={() => togglePanel("jar")}>🫙</button>
      <button title="Leave a note for tomorrow" onclick={() => togglePanel("note")}>✉️</button>
      <button title="Switch form" onclick={() => togglePanel("switch")}>
        <span class="miniball"></span>
      </button>
      <button title="Surprise me — random Pokémon" onclick={() => switchTo(randomEntry(dexId))}
        >🎲</button
      >
      <button title="Battle!" onclick={openBattle}>⚔</button>
    </div>

    <div class="syscluster">
      <button
        title={focusMode ? "Focus mode on — I'll stay quiet" : "Focus mode"}
        class:active={focusMode}
        onclick={toggleFocus}>🎯</button
      >
      <button title="Sound" onclick={() => (soundPanel = !soundPanel)}>{muted ? "🔇" : "🔊"}</button>
      <button title="Smaller (or scroll down)" onclick={() => nudgeScale(-0.15)}>−</button>
      <button title="Bigger (or scroll up)" onclick={() => nudgeScale(0.15)}>+</button>
      <button title="Goodnight" onclick={quit}>✕</button>
    </div>

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
      </div>
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
  .stage {
    position: absolute;
    bottom: 40px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
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
  /* action rail: vertical, right edge — uses the tall empty space */
  .sidebar {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 7px;
    opacity: 0;
    transition: opacity 0.25s ease;
    z-index: 6;
  }
  /* system cluster: top-right corner — mute, size, close */
  .syscluster {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 6px;
    opacity: 0;
    transition: opacity 0.25s ease;
    z-index: 6;
  }
  .widget:hover .sidebar,
  .widget:hover .syscluster {
    opacity: 1;
  }
  .sidebar button,
  .syscluster button {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid rgba(120, 108, 160, 0.45);
    background: rgba(33, 28, 48, 0.92);
    color: #d9d0ec;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  }
  .syscluster button {
    width: 26px;
    height: 26px;
    font-size: 11px;
  }
  .syscluster button.active {
    border-color: #f0b66a;
    background: rgba(240, 182, 106, 0.22);
  }
  .sidebar button:hover,
  .syscluster button:hover {
    border-color: #f0b66a;
    background: rgba(53, 44, 74, 0.96);
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

  /* tiny Pokéball toolbar icon */
  .miniball {
    display: block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: linear-gradient(
      to bottom,
      #e3350d 0%,
      #e3350d 42%,
      #1c1c1c 42%,
      #1c1c1c 58%,
      #f5f5f5 58%,
      #f5f5f5 100%
    );
    border: 1px solid #1c1c1c;
    position: relative;
  }
  .miniball::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 4px;
    transform: translate(-50%, -50%);
    background: #f5f5f5;
    border: 1px solid #1c1c1c;
    border-radius: 50%;
  }
</style>
