<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    POKEDEX,
    STARTERS,
    searchDex,
    randomEntry,
    dexEntry,
    thumbUrl,
    spriteUrl,
    spriteBackUrl,
    fallbackUrl,
    spriteSrc,
    displayName,
    type DexEntry
  } from "../sprites";
  import { maxHpFor, firstSide, calcTurn, effText, statsFor } from "../battle";
  import { chooseMove } from "../combat/ai";
  import { speciesIdentity } from "../combat/identity";
  import { movesFor, type Move } from "../attackfx";
  import { playCry, voiceCry, playVoiceClip, thump } from "../sound";
  import {
    animKind,
    FAMILY,
    impactSparks,
    streamSparks,
    boltPath,
    quakeRocks,
    confettiBurst,
    type Spark,
    type Rock,
    type Confetto
  } from "../fx";

  interface Props {
    currentDexId: number;
    onClose: () => void;
  }
  let { currentDexId, onClose }: Props = $props();

  type Side = "L" | "R";
  type Anim = "idle" | "attack" | "shoot" | "channel" | "hit" | "faint" | "win" | "dodge";

  let phase = $state<"setup" | "battle" | "over">("setup");
  let qL = $state("");
  let qR = $state("");
  // Use $derived for initial value to avoid state_referenced_locally warning
  const defaultSelL = $derived(dexEntry(currentDexId) ?? null);
  let selL = $state<DexEntry | null>(null);
  let selR = $state<DexEntry | null>(null);
  $effect(() => { if (selL === null) selL = defaultSelL; });
  let maxL = $state(100);
  let maxR = $state(100);
  let hpL = $state(100);
  let hpR = $state(100);
  let ghostL = $state(100);
  let ghostR = $state(100);
  let animL = $state<Anim>("idle");
  let animR = $state<Anim>("idle");
  let msg = $state("");
  let shake = $state(false);
  let zoom = $state(false);
  let intro = $state(false);
  let srcL = $state("");
  let srcR = $state("");

  // ---- encounters (v5): framing + difficulty over the same auto-spar ----
  let encounter = $state<"spar" | "wild" | "trainer" | "boss" | "legendary">("spar");
  let introLine = $state(""); // framing shown during the intro ("A wild X appeared!")
  let hpMul = 1; // boss/legendary tankiness (encounter difficulty — a fatter HP pool, not a stat edit)
  // per-side control: "cpu" = identity AI (watch), "you" = pick the moves. Default BOTH cpu — the
  // soul default is a spar to WATCH; manual control is an opt-in, never forced into a game loop.
  let ctrlL = $state<"cpu" | "you">("cpu");
  let ctrlR = $state<"cpu" | "you">("cpu");
  let pendingMoves = $state<Move[] | null>(null); // shown when a "you" side must choose its move
  let resolveMove: ((m: Move) => void) | null = null;
  // Heavy-move cooldown: a strong move can't be SPAMMED — after use it's locked for the next 2 of
  // that side's turns (per move, so you rotate your kit instead of mashing one button).
  let pickSide = $state<Side>("L"); // which side is currently choosing (cooldown lookup)
  let turnNo = $state<{ L: number; R: number }>({ L: 0, R: 0 }); // each side's completed picks
  let lockedUntil = $state<{ L: Record<string, number>; R: Record<string, number> }>({ L: {}, R: {} });
  const HEAVY_POWER = 90; // power at/above which a move counts as "heavy"
  const HEAVY_CD = 2; // turns a heavy move stays locked after use
  const isHeavy = (m: Move) => (m.power ?? 0) >= HEAVY_POWER;
  const moveCdLeft = (side: Side, m: Move) =>
    Math.max(0, (lockedUntil[side][m.name] ?? -1) - turnNo[side] + 1);

  // ---- fx state ----
  let arenaEl = $state<HTMLDivElement | null>(null);
  let fxBeam = $state<{ x: number; y: number; len: number; ang: number; color: string } | null>(null);
  let fxOrb = $state<{ x: number; y: number; tx: number; ty: number; color: string; emoji: string } | null>(null);
  let fxStream = $state<{ x: number; y: number; sparks: Spark[] } | null>(null);
  let fxBolt = $state<{ x: number; h: number; points: string } | null>(null);
  let fxRocks = $state<Rock[] | null>(null);
  let impactFx = $state<{ x: number; y: number; color: string; sparks: Spark[]; key: number } | null>(null);
  let dmgPop = $state<{ x: number; y: number; text: string; crit: boolean; key: number } | null>(null);
  let flashColor = $state<string | null>(null);
  let dashSide = $state<Side | null>(null);
  let confetti = $state<Confetto[]>([]);

  // ---- cinematic combat: charge buff + big callouts ----
  let chargedL = false;
  let chargedR = false;
  let callout = $state<{ text: string; kind: "dodge" | "charge" | "comeback" | "crit"; key: number } | null>(null);
  let calloutTimer: ReturnType<typeof setTimeout> | undefined;
  function showCallout(text: string, kind: "dodge" | "charge" | "comeback" | "crit") {
    callout = { text, kind, key: Math.random() };
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => (callout = null), 1000);
  }

  let alive = true;
  onDestroy(() => {
    alive = false;
    if (resolveMove && pendingMoves) resolveMove(pendingMoves[0]); // unblock a pending pick on unmount
  });

  const suggested: DexEntry[] = STARTERS.map(
    (s) => POKEDEX.find((e) => e.id === s.dexId)!
  ).filter(Boolean);
  const resultsL = $derived(qL.trim() ? searchDex(qL, 6) : suggested);
  const resultsR = $derived(qR.trim() ? searchDex(qR, 6) : suggested);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const disp = (e: DexEntry | null) => (e ? displayName(e.name) : "");

  function setAnim(side: Side, a: Anim) {
    if (side === "L") animL = a;
    else animR = a;
  }

  function anchor(side: Side) {
    const W = arenaEl?.clientWidth ?? 620;
    const H = arenaEl?.clientHeight ?? 400;
    return side === "L" ? { x: W * 0.225, y: H * 0.58 } : { x: W * 0.775, y: H * 0.34 };
  }

  function failL() {
    if (!selL) return;
    srcL = srcL.includes("/back/") ? spriteUrl(selL.id) : fallbackUrl(selL.id);
  }
  function failR() {
    if (!selR) return;
    srcR = srcR.includes("showdown") ? fallbackUrl(selR.id) : srcR;
  }

  function hpClass(hp: number, max: number): string {
    const p = hp / max;
    return p > 0.5 ? "ok" : p > 0.2 ? "warn" : "low";
  }

  function clearFx() {
    fxBeam = null;
    fxOrb = null;
    fxStream = null;
    fxBolt = null;
    fxRocks = null;
    impactFx = null;
  }

  // ── Encounters — auto-pick the opponent by kind, set difficulty + intro framing, then spar.
  // A framed delight to WATCH (wild/trainer/boss/legendary), never a game mode (SOUL / §10). ──
  function bst(idn: number): number {
    const s = statsFor(idn);
    return s.hp + s.atk + s.def + s.spa + s.spd + s.spe;
  }
  let legendPool: number[] = [];
  let bossPool: number[] = [];
  function ensurePools() {
    if (legendPool.length) return;
    for (const e of POKEDEX) {
      const idn = speciesIdentity(e.id);
      if (idn.legendary) legendPool.push(e.id);
      else if (idn.stage >= 2 && bst(e.id) >= 540) bossPool.push(e.id); // pseudo-legend tier
    }
  }
  function randEntry(pool: number[], excl?: number): DexEntry | null {
    const p = pool.filter((x) => x !== excl);
    return p.length ? (dexEntry(p[Math.floor(Math.random() * p.length)]) ?? null) : null;
  }
  function wildEntry(excl?: number): DexEntry {
    let e = randomEntry(excl);
    for (let i = 0; i < 6 && speciesIdentity(e.id).legendary; i++) e = randomEntry(excl); // wild ≠ legendary
    return e;
  }
  function startEncounter(kind: "wild" | "trainer" | "boss" | "legendary") {
    ensurePools();
    if (!selL) selL = defaultSelL;
    const excl = selL?.id;
    let foe: DexEntry | null;
    if (kind === "legendary") { foe = randEntry(legendPool, excl); hpMul = 2.0; }
    else if (kind === "boss") { foe = randEntry(bossPool, excl); hpMul = 1.6; }
    else if (kind === "trainer") {
      foe = wildEntry(excl);
      for (let i = 0; i < 4 && speciesIdentity(foe.id).stage < 2; i++) foe = wildEntry(excl); // a trained, evolved mon
      hpMul = 1;
    } else { foe = wildEntry(excl); hpMul = 1; } // wild
    if (!foe) foe = wildEntry(excl); // empty pool → fall back to any wild
    selR = foe;
    encounter = kind;
    const nm = disp(foe);
    introLine =
      kind === "wild" ? `A wild ${nm} appeared!`
      : kind === "trainer" ? `A Trainer sent out ${nm}!`
      : kind === "boss" ? `Boss battle — ${nm}!`
      : `⚡ The Legendary ${nm} challenges you!`;
    startBattle();
  }

  async function startBattle() {
    if (!selL || !selR) return;
    srcL = spriteBackUrl(selL.id);
    srcR = spriteUrl(selR.id);
    maxL = maxHpFor(selL.id);
    maxR = Math.round(maxHpFor(selR.id) * hpMul); // boss/legendary get a fatter HP pool (difficulty)
    hpL = ghostL = maxL;
    hpR = ghostR = maxR;
    animL = animR = "idle";
    chargedL = chargedR = false;
    turnNo = { L: 0, R: 0 }; // fresh heavy-move cooldowns each battle
    lockedUntil = { L: {}, R: {} };
    callout = null;
    confetti = [];
    clearFx();
    phase = "battle";
    intro = true;
    msg = introLine; // encounter framing during the intro ("" for a plain spar)
    playVoiceClip(["lets-have-a-battle", "lets-do-this", "i-got-this"], 0.85, 0.7);
    setTimeout(() => selL && voiceCry(selL.id, disp(selL), 0.3), 1100);
    setTimeout(() => selR && voiceCry(selR.id, disp(selR), 0.3), 1950);
    await wait(1450);
    intro = false;
    msg = `${disp(selL)} vs ${disp(selR)}!`;
    await wait(700);

    let turn: Side = firstSide(selL.id, selR.id); // speed-weighted coin toss — fast favoured, not certain
    const tossWinner = turn === "L" ? selL : selR;
    showCallout(`🪙 ${disp(tossWinner)} moves first!`, "charge");
    await wait(900);
    while (alive && phase === "battle" && hpL > 0 && hpR > 0) {
      await doTurn(turn);
      turn = turn === "L" ? "R" : "L";
      if (hpL > 0 && hpR > 0) await wait(380);
    }
    if (!alive || phase !== "battle") return;

    const loser: Side = hpL <= 0 ? "L" : "R";
    const winner: Side = loser === "L" ? "R" : "L";
    const loserSel = loser === "L" ? selL : selR;
    const winnerSel = winner === "L" ? selL : selR;
    setAnim(loser, "faint");
    msg = `${disp(loserSel)} fainted!`;
    if (loserSel) playCry(loserSel.id, 0.22);
    await wait(1200);
    if (!alive) return;
    setAnim(winner, "win");
    if (winnerSel) voiceCry(winnerSel.id, disp(winnerSel), 0.3);
    msg = `${disp(winnerSel)} wins! 🏆`;
    confetti = confettiBurst();
    phase = "over";
    // the trainer reacts: your corner is the left one
    setTimeout(
      () =>
        playVoiceClip(
          winner === "L" ? ["that-was-awesome", "awesome", "congrats"] : ["oh-no", "no-way", "awww"],
          0.85,
          0.8
        ),
      1500
    );
  }

  // self-control: pause the acting side's turn for a move pick (resolved by a button click).
  function playerMove(dexId: number, side: Side): Promise<Move> {
    pickSide = side;
    turnNo[side] += 1; // advance this side's turn counter (drives cooldowns)
    pendingMoves = movesFor(dexId).slice(0, 4); // the learnset's top four
    msg = "Choose a move…";
    return new Promise((res) => (resolveMove = res));
  }
  function pickPlayerMove(m: Move) {
    if (moveCdLeft(pickSide, m) > 0) return; // on cooldown — the button is disabled anyway
    if (isHeavy(m)) lockedUntil[pickSide][m.name] = turnNo[pickSide] + HEAVY_CD; // lock for 2 turns
    pendingMoves = null;
    const r = resolveMove;
    resolveMove = null;
    r?.(m);
  }

  async function doTurn(side: Side) {
    const atk = side === "L" ? selL : selR;
    const def = side === "L" ? selR : selL;
    if (!atk || !def) return;
    const defSide: Side = side === "L" ? "R" : "L";
    const ctrl = side === "L" ? ctrlL : ctrlR;
    const mv =
      ctrl === "you"
        ? await playerMove(atk.id, side) // self-control: wait for the player's pick
        : chooseMove(atk.id, def.type, side === "L" ? hpL / maxL : hpR / maxR); // identity/temperament AI
    if (!alive || phase !== "battle") return;
    const res = calcTurn(mv, atk.id, def.id, atk.type, def.type); // sim: stats → damage (separate from the choice)
    const kind = FAMILY[animKind(mv, atk.id)]; // battle reads the 8 render families (melee/burst/breath/…)
    const A = anchor(side);
    const D = anchor(defSide);
    msg = `${disp(atk)} used ${mv.name}!`;

    if (kind === "status") {
      setAnim(side, "channel");
      if (side === "L") chargedL = true;
      else chargedR = true;
      showCallout("POWERING UP!", "charge");
      await wait(900);
      setAnim(side, "idle");
      if (!alive) return;
      msg = `${disp(atk)} is charging up…`;
      await wait(620);
      return;
    }

    // consume a pending charge buff (set by a previous status move)
    const charged = side === "L" ? chargedL : chargedR;
    if (charged) {
      if (side === "L") chargedL = false;
      else chargedR = false;
    }

    // dodge — a charged hit always connects (payoff); a low-HP defender slips more often
    const defFrac = defSide === "L" ? hpL / maxL : hpR / maxR;
    const dodged = !charged && Math.random() < Math.min(0.3, 0.1 + (defFrac < 0.35 ? 0.16 : 0));
    if (dodged) {
      if (kind === "claw" || kind === "bite" || kind === "dash") {
        dashSide = side;
        setAnim(side, "attack");
      } else {
        setAnim(side, "shoot");
      }
      await wait(300);
      if (!alive) return;
      dashSide = null;
      setAnim(defSide, "dodge");
      showCallout("DODGED!", "dodge");
      playVoiceClip(["woah", "no-way", "phew", "awww"], 0.8, 0.7);
      msg = `${disp(def)} slipped away!`;
      await wait(640);
      setAnim(side, "idle");
      setAnim(defSide, "idle");
      return;
    }

    // a charged hit: amplified, with a wind-up flare and forced heavy FX
    if (charged) {
      res.damage = Math.round(res.damage * 1.7);
      setAnim(side, "channel");
      showCallout("FULLY CHARGED!", "charge");
      await wait(520);
      if (!alive) return;
    }

    if (kind === "claw" || kind === "bite" || kind === "dash") {
      dashSide = side;
      setAnim(side, "attack");
      await wait(440); // melee: impact lands mid-dash
    } else {
      setAnim(side, "shoot"); // charge-up glow
      await wait(320);
      if (!alive) return;
      if (mv.type === "electric") {
        // electric reads as a strike from above, whatever the archetype
        fxBolt = { x: D.x, h: D.y - 6, points: boltPath(D.y - 6) };
        await wait(300);
      } else if (kind === "beam") {
        const dx = D.x - A.x;
        const dy = D.y - A.y;
        fxBeam = {
          x: A.x,
          y: A.y,
          len: Math.hypot(dx, dy) - 26,
          ang: (Math.atan2(dy, dx) * 180) / Math.PI,
          color: mv.color
        };
        await wait(400);
      } else if (kind === "burst") {
        shake = true;
        setTimeout(() => (shake = false), 750);
        fxRocks = quakeRocks();
        await wait(560);
      } else if (kind === "breath") {
        // a sustained torrent across the arena
        fxStream = { x: A.x, y: A.y, sparks: streamSparks(mv.color, mv.emoji, D.x - A.x, D.y - A.y) };
        await wait(640);
      } else {
        // projectile / status / default — a lobbed energy orb
        fxOrb = { x: A.x, y: A.y, tx: D.x - A.x, ty: D.y - A.y, color: mv.color, emoji: mv.emoji };
        await wait(500);
      }
    }
    if (!alive) return;

    // ---- IMPACT ----
    setAnim(defSide, "hit");
    impactFx = { x: D.x, y: D.y, color: mv.color, sparks: impactSparks(mv.color, mv.emoji), key: Math.random() };
    dmgPop = {
      x: D.x,
      y: D.y - 36,
      text: res.eff === 0 ? "no effect" : `-${res.damage}`,
      crit: res.crit && res.eff > 0,
      key: Math.random()
    };
    const heavy = res.eff >= 2 || res.crit || charged;
    thump(heavy ? 1 : 0.55);
    zoom = true;
    setTimeout(() => (zoom = false), 270);
    if (heavy) {
      flashColor = mv.color;
      setTimeout(() => (flashColor = null), 230);
      shake = true;
      setTimeout(() => (shake = false), 420);
    }
    if (res.crit && res.eff > 0) showCallout("CRITICAL!", "crit");
    if (defSide === "L") hpL = Math.max(0, hpL - res.damage);
    else hpR = Math.max(0, hpR - res.damage);
    setTimeout(() => {
      ghostL = hpL;
      ghostR = hpR;
    }, 480);
    await wait(580);
    dashSide = null;
    setAnim(side, "idle");
    setAnim(defSide, "idle");
    clearFx();
    setTimeout(() => (dmgPop = null), 320);
    if (!alive) return;
    if (res.crit && res.eff > 0) {
      msg = "Critical hit!";
      await wait(560);
    }
    const t = effText(res.eff);
    if (t) {
      msg = t;
      await wait(560);
    }
    // comeback moment — attacker on the ropes lands a big one
    const atkFrac = side === "L" ? hpL / maxL : hpR / maxR;
    const defAlive = (defSide === "L" ? hpL : hpR) > 0;
    if ((res.crit || res.eff >= 2) && atkFrac < 0.3 && defAlive) {
      showCallout("COMEBACK!", "comeback");
      playVoiceClip(["lets-go", "that-was-awesome", "awesome"], 0.85, 0.7);
      shake = true;
      setTimeout(() => (shake = false), 480);
      msg = "What a comeback!";
      await wait(620);
    }
  }

  function rematch() {
    phase = "setup";
    msg = "";
    confetti = [];
    encounter = "spar";
    hpMul = 1;
    introLine = "";
  }
</script>

<div class="scene" class:shake>
  <button class="x" onclick={onClose}>✕</button>

  {#if phase === "setup"}
    <div class="setup">
      <h2>⚔ Battle</h2>
      <div class="encounters">
        <button class="enc enc-wild" onclick={() => startEncounter("wild")}>🌿 Wild</button>
        <button class="enc enc-trainer" onclick={() => startEncounter("trainer")}>🧢 Trainer</button>
        <button class="enc enc-boss" onclick={() => startEncounter("boss")}>👑 Boss</button>
        <button class="enc enc-legendary" onclick={() => startEncounter("legendary")}>⚡ Legendary</button>
      </div>
      <div class="enchint">quick encounter — auto-picks a foe · or hand-pick below</div>
      <div class="cols">
        {#each [{ side: "L" as const }, { side: "R" as const }] as col (col.side)}
          <div class="col">
            <div class="corner">{col.side === "L" ? "left corner" : "right corner"}</div>
            <div class="ctrl">
              <button class:on={(col.side === "L" ? ctrlL : ctrlR) === "cpu"} onclick={() => { if (col.side === "L") ctrlL = "cpu"; else ctrlR = "cpu"; }}>🤖 Auto</button>
              <button class:on={(col.side === "L" ? ctrlL : ctrlR) === "you"} onclick={() => { if (col.side === "L") ctrlL = "you"; else ctrlR = "you"; }}>🎮 You</button>
            </div>
            <div class="chosen">
              {#if col.side === "L" ? selL : selR}
                {@const s = col.side === "L" ? selL! : selR!}
                <img use:spriteSrc={thumbUrl(s.id)} alt={disp(s)} />
                <span>{disp(s)} <em>· {s.type}</em></span>
              {:else}
                <span class="hint">pick a fighter</span>
              {/if}
            </div>
            <div class="srow">
              <input
                type="text"
                placeholder="search…"
                value={col.side === "L" ? qL : qR}
                oninput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  if (col.side === "L") qL = v;
                  else qR = v;
                }}
              />
              <button
                class="dice"
                title="Random"
                onclick={() => {
                  if (col.side === "L") selL = randomEntry(selR?.id);
                  else selR = randomEntry(selL?.id);
                }}>🎲</button
              >
            </div>
            <div class="grid">
              {#each col.side === "L" ? resultsL : resultsR as e (e.id)}
                <button
                  class="pickbtn"
                  class:picked={(col.side === "L" ? selL : selR)?.id === e.id}
                  onclick={() => {
                    if (col.side === "L") selL = e;
                    else selR = e;
                  }}
                >
                  <img use:spriteSrc={thumbUrl(e.id)} alt={disp(e)} loading="lazy" />
                  <span>{disp(e)}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      <button class="fight" disabled={!selL || !selR} onclick={() => { encounter = "spar"; hpMul = 1; introLine = ""; startBattle(); }}>FIGHT!</button>
    </div>
  {:else}
    <div class="arena" class:zoom bind:this={arenaEl}>
      <div class="platform pR"></div>
      <div class="platform pL"></div>

      {#if encounter === "boss" || encounter === "legendary"}
        <div class="encbadge enc-{encounter}">{encounter === "legendary" ? "⚡ LEGENDARY" : "👑 BOSS"}</div>
      {/if}

      {#if selR}
        <div class="hpbox boxR">
          <div class="hpname">{disp(selR)} <em>{selR.type}</em></div>
          <div class="hpbar">
            <div class="ghost" style="width: {(ghostR / maxR) * 100}%"></div>
            <div class="fill {hpClass(hpR, maxR)}" style="width: {(hpR / maxR) * 100}%"></div>
          </div>
          <div class="hpnum">{hpR}/{maxR}</div>
        </div>
      {/if}
      {#if selL}
        <div class="hpbox boxL">
          <div class="hpname">{disp(selL)} <em>{selL.type}</em></div>
          <div class="hpbar">
            <div class="ghost" style="width: {(ghostL / maxL) * 100}%"></div>
            <div class="fill {hpClass(hpL, maxL)}" style="width: {(hpL / maxL) * 100}%"></div>
          </div>
          <div class="hpnum">{hpL}/{maxL}</div>
        </div>
      {/if}

      {#if dashSide === "L"}
        <img class="mon monL ghostimg g1 anim-attack" use:spriteSrc={srcL} alt="" />
        <img class="mon monL ghostimg g2 anim-attack" use:spriteSrc={srcL} alt="" />
      {:else if dashSide === "R"}
        <img class="mon monR ghostimg g1 anim-attack" use:spriteSrc={srcR} alt="" />
        <img class="mon monR ghostimg g2 anim-attack" use:spriteSrc={srcR} alt="" />
      {/if}
      <img class="mon monL anim-{animL}" use:spriteSrc={srcL} onerror={failL} alt={disp(selL)} />
      <img class="mon monR anim-{animR}" use:spriteSrc={srcR} onerror={failR} alt={disp(selR)} />

      {#if fxBeam}
        <div
          class="beam"
          style="left: {fxBeam.x}px; top: {fxBeam.y}px; width: {fxBeam.len}px; --bc: {fxBeam.color}; transform: rotate({fxBeam.ang}deg)"
        ></div>
      {/if}
      {#if fxOrb}
        <span
          class="orb"
          style="left: {fxOrb.x}px; top: {fxOrb.y}px; --tx: {fxOrb.tx}px; --ty: {fxOrb.ty}px; --bc: {fxOrb.color}"
          >{fxOrb.emoji}</span
        >
      {/if}
      {#if fxStream}
        {#each fxStream.sparks as s (s.id)}
          <span
            class="spark"
            class:circle={!s.emoji}
            style="left: {fxStream.x}px; top: {fxStream.y}px; --dx: {s.dx}px; --dy: {s.dy}px; animation-delay: {s.delay}ms; --bc: {s.color}; width: {s.size}px; height: {s.size}px; font-size: {s.size}px"
            >{s.emoji ?? ""}</span
          >
        {/each}
      {/if}
      {#if fxBolt}
        <svg class="bolt" style="left: {fxBolt.x - 40}px" width="80" height={fxBolt.h}>
          <polyline points={fxBolt.points} />
        </svg>
      {/if}
      {#if fxRocks}
        {#each fxRocks as r (r.id)}
          <span
            class="rock"
            style="left: {r.x}%; animation-delay: {r.delay}ms; font-size: {r.size}px">🪨</span
          >
        {/each}
      {/if}

      {#if impactFx}
        {#key impactFx.key}
          <div class="impact" style="left: {impactFx.x}px; top: {impactFx.y}px; --bc: {impactFx.color}"></div>
          {#each impactFx.sparks as s (s.id)}
            <span
              class="spark imp"
              class:circle={!s.emoji}
              style="left: {impactFx.x}px; top: {impactFx.y}px; --dx: {s.dx}px; --dy: {s.dy}px; animation-delay: {s.delay}ms; --bc: {s.color}; width: {s.size}px; height: {s.size}px; font-size: {s.size}px"
              >{s.emoji ?? ""}</span
            >
          {/each}
        {/key}
      {/if}
      {#if dmgPop}
        {#key dmgPop.key}
          <span class="dmg" class:crit={dmgPop.crit} style="left: {dmgPop.x}px; top: {dmgPop.y}px"
            >{dmgPop.text}{dmgPop.crit ? " CRIT!" : ""}</span
          >
        {/key}
      {/if}
      {#if flashColor}
        <div class="flashover" style="background: {flashColor}"></div>
      {/if}

      {#each confetti as c (c.id)}
        <span
          class="confetto"
          style="left: {c.x}%; background: {c.color}; animation-delay: {c.delay}ms; --drift: {c.drift}px"
        ></span>
      {/each}

      {#if callout}
        {#key callout.key}
          <div class="callout c-{callout.kind}">{callout.text}</div>
        {/key}
      {/if}

      {#if intro && selL && selR}
        <div class="vs">
          <span class="vsname vl">{disp(selL)}</span>
          <span class="vsmark">VS</span>
          <span class="vsname vr">{disp(selR)}</span>
        </div>
      {/if}

      <div class="msg">{msg}</div>

      {#if pendingMoves}
        <div class="movepick">
          {#each pendingMoves as m (m.name)}
            {@const cd = moveCdLeft(pickSide, m)}
            <button
              class="mvbtn"
              class:cooling={cd > 0}
              disabled={cd > 0}
              style="--mc: {m.color}"
              onclick={() => pickPlayerMove(m)}
            >
              <span class="mvname">{displayName(m.name)}</span>
              <span class="mvmeta">{cd > 0 ? `⏳ ${cd} turn${cd > 1 ? "s" : ""}` : `${m.type}${m.power ? ` · ${m.power}` : ""}`}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if phase === "over"}
        <div class="overbtns">
          <button onclick={rematch}>rematch</button>
          <button onclick={onClose}>done</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .scene {
    position: absolute;
    inset: 0;
    z-index: 20;
    background:
      radial-gradient(ellipse at 75% 30%, rgba(90, 70, 140, 0.35), transparent 55%),
      radial-gradient(ellipse at 20% 85%, rgba(70, 90, 140, 0.3), transparent 55%),
      linear-gradient(to bottom, #1a1626 0%, #241e36 60%, #2b2342 100%);
    border-radius: 14px;
    overflow: hidden;
    color: #ece6f7;
    font-size: 13px;
  }
  .scene.shake {
    animation: arenashake 0.45s ease;
  }
  @keyframes arenashake {
    0%, 100% { transform: translate(0, 0); }
    20% { transform: translate(-6px, 3px); }
    40% { transform: translate(5px, -3px); }
    60% { transform: translate(-4px, 2px); }
    80% { transform: translate(3px, -1px); }
  }
  .x {
    position: absolute;
    top: 8px;
    right: 10px;
    z-index: 30;
    background: none;
    border: none;
    color: #8d82ab;
    cursor: pointer;
    font-size: 13px;
  }

  /* ---- setup ---- */
  .setup {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    height: 100%;
    box-sizing: border-box;
  }
  /* encounters — quick framed battles (auto-pick the foe) */
  .encounters {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .enc {
    padding: 6px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.05);
    color: #f6f1ff;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.12s, background 0.12s, border-color 0.12s, box-shadow 0.12s;
  }
  .enc:hover { transform: translateY(-1px); background: rgba(255, 255, 255, 0.1); }
  .enc-wild:hover { border-color: #6fcf5f; }
  .enc-trainer:hover { border-color: #58a8f0; }
  .enc-boss:hover { border-color: #f0b66a; }
  .enc-legendary:hover { border-color: #ffd94a; box-shadow: 0 0 12px rgba(255, 217, 74, 0.35); }
  .enchint { font-size: 9.5px; color: #8d82ab; }
  .encbadge {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    padding: 3px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    z-index: 6;
    pointer-events: none;
  }
  .encbadge.enc-boss {
    background: rgba(240, 182, 106, 0.16);
    color: #f0b66a;
    border: 1px solid rgba(240, 182, 106, 0.5);
  }
  .encbadge.enc-legendary {
    background: rgba(255, 217, 74, 0.16);
    color: #ffd94a;
    border: 1px solid rgba(255, 217, 74, 0.55);
    box-shadow: 0 0 14px rgba(255, 217, 74, 0.3);
  }
  /* per-side control toggle (Auto = watch · You = pick) */
  .ctrl {
    display: flex;
    gap: 4px;
    width: 100%;
  }
  .ctrl button {
    flex: 1;
    padding: 3px 6px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #8d82ab;
    font-size: 9.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .ctrl button.on {
    background: rgba(240, 182, 106, 0.16);
    color: #f0b66a;
    border-color: rgba(240, 182, 106, 0.5);
  }
  /* self-control move picker (only when a "You" side is acting) */
  .movepick {
    position: absolute;
    left: 50%;
    bottom: 8px;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    width: min(86%, 360px);
    z-index: 7;
  }
  .mvbtn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 7px 10px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--mc, #888) 55%, transparent);
    background: color-mix(in srgb, var(--mc, #888) 16%, #160f24);
    color: #f6f1ff;
    cursor: pointer;
    text-align: left;
    transition: transform 0.1s, background 0.1s;
  }
  .mvbtn:hover {
    transform: translateY(-1px);
    background: color-mix(in srgb, var(--mc, #888) 28%, #160f24);
  }
  .mvbtn.cooling {
    opacity: 0.45;
    filter: grayscale(0.7);
    cursor: not-allowed;
  }
  .mvbtn.cooling:hover {
    transform: none;
    background: color-mix(in srgb, var(--mc, #888) 16%, #160f24);
  }
  .mvname { font-size: 11px; font-weight: 700; }
  .mvmeta { font-size: 9px; color: #b9aee0; text-transform: capitalize; }
  h2 {
    margin: 0;
    font-size: 15px;
    color: #f0b66a;
    letter-spacing: 0.04em;
  }
  .cols {
    display: flex;
    gap: 12px;
    width: 100%;
    flex: 1;
    min-height: 0;
  }
  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .corner {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9d92bd;
    text-align: center;
  }
  .chosen {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 34px;
    font-weight: 600;
  }
  .chosen img {
    width: 30px;
    height: 30px;
    image-rendering: pixelated;
  }
  .chosen em {
    font-style: normal;
    font-weight: 400;
    color: #9d92bd;
  }
  .hint {
    color: #7d7398;
    font-size: 11px;
  }
  .srow {
    display: flex;
    gap: 5px;
  }
  .srow input {
    flex: 1;
    min-width: 0;
    padding: 6px 9px;
    border-radius: 8px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(0, 0, 0, 0.25);
    color: #ece6f7;
    font-size: 12px;
    outline: none;
  }
  .dice {
    width: 30px;
    border-radius: 8px;
    border: 1px solid rgba(120, 108, 160, 0.4);
    background: rgba(255, 255, 255, 0.05);
    cursor: pointer;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
    overflow-y: auto;
  }
  .grid::-webkit-scrollbar {
    width: 5px;
  }
  .grid::-webkit-scrollbar-thumb {
    background: rgba(120, 108, 160, 0.4);
    border-radius: 3px;
  }
  .pickbtn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 5px 2px;
    gap: 1px;
    border-radius: 9px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    font-size: 9.5px;
    cursor: pointer;
  }
  .pickbtn:hover {
    border-color: #f0b66a;
  }
  .pickbtn.picked {
    border-color: #f0b66a;
    background: rgba(240, 182, 106, 0.14);
  }
  .pickbtn img {
    width: 34px;
    height: 34px;
    image-rendering: pixelated;
  }
  .pickbtn span {
    max-width: 70px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fight {
    padding: 9px 36px;
    border-radius: 12px;
    border: none;
    background: #e3350d;
    color: #fff;
    font-weight: 800;
    font-size: 14px;
    letter-spacing: 0.1em;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(227, 53, 13, 0.4);
  }
  .fight:disabled {
    opacity: 0.35;
    cursor: default;
    box-shadow: none;
  }

  /* ---- arena ---- */
  .arena {
    position: absolute;
    inset: 0;
  }
  .arena.zoom {
    animation: zoomp 0.27s ease;
  }
  @keyframes zoomp {
    0%, 100% { transform: scale(1); }
    40% { transform: scale(1.045); }
  }
  .platform {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02) 70%);
  }
  .pL {
    left: 6%;
    bottom: 13%;
    width: 220px;
    height: 56px;
  }
  .pR {
    right: 7%;
    top: 47%;
    width: 180px;
    height: 44px;
  }
  .mon {
    position: absolute;
    image-rendering: pixelated;
    object-fit: contain;
    z-index: 2;
  }
  .monL {
    left: 9%;
    bottom: 17%;
    width: 150px;
    height: 150px;
  }
  .monR {
    right: 10%;
    top: 17%;
    width: 125px;
    height: 125px;
  }
  .ghostimg {
    z-index: 1;
    pointer-events: none;
  }
  .g1 {
    opacity: 0.3;
    animation-delay: 0.06s !important;
  }
  .g2 {
    opacity: 0.15;
    animation-delay: 0.12s !important;
  }

  .anim-attack.monL {
    animation: atkL 0.7s ease;
  }
  .anim-attack.monR {
    animation: atkR 0.7s ease;
  }
  @keyframes atkL {
    0%, 100% { transform: translate(0, 0); }
    18% { transform: translate(-16px, 7px) scale(1.05, 0.93); }
    52% { transform: translate(135px, -78px) rotate(6deg); }
    70% { transform: translate(70px, -40px); }
  }
  @keyframes atkR {
    0%, 100% { transform: translate(0, 0); }
    18% { transform: translate(16px, -7px) scale(1.05, 0.93); }
    52% { transform: translate(-135px, 78px) rotate(6deg); }
    70% { transform: translate(-70px, 40px); }
  }
  .anim-shoot.monL {
    animation: chargeL 0.85s ease;
  }
  .anim-shoot.monR {
    animation: chargeR 0.85s ease;
  }
  @keyframes chargeL {
    0%, 100% { transform: translate(0, 0); filter: none; }
    30% { transform: translate(-12px, 5px) scale(1.06, 0.94); filter: brightness(1.8); }
    55% { transform: translate(8px, -3px); filter: brightness(1.3); }
  }
  @keyframes chargeR {
    0%, 100% { transform: translate(0, 0); filter: none; }
    30% { transform: translate(12px, -5px) scale(1.06, 0.94); filter: brightness(1.8); }
    55% { transform: translate(-8px, 3px); filter: brightness(1.3); }
  }
  /* ---- dodge sidestep ---- */
  .anim-dodge.monL {
    animation: dodgeL 0.6s cubic-bezier(0.3, 0.9, 0.3, 1);
  }
  .anim-dodge.monR {
    animation: dodgeR 0.6s cubic-bezier(0.3, 0.9, 0.3, 1);
  }
  @keyframes dodgeL {
    0% { transform: translate(0, 0); }
    35% { transform: translate(-30px, -16px) rotate(-9deg); }
    65% { transform: translate(-30px, -16px) rotate(-9deg); }
    100% { transform: translate(0, 0); }
  }
  @keyframes dodgeR {
    0% { transform: translate(0, 0); }
    35% { transform: translate(30px, -16px) rotate(9deg); }
    65% { transform: translate(30px, -16px) rotate(9deg); }
    100% { transform: translate(0, 0); }
  }
  .anim-channel {
    animation: chan 0.9s ease;
  }
  @keyframes chan {
    0%, 100% { filter: none; }
    50% { filter: brightness(1.5) drop-shadow(0 0 14px #f0b66a); }
  }
  .anim-hit {
    animation: hitshake 0.55s ease;
  }
  @keyframes hitshake {
    0%, 100% { transform: translateX(0); filter: none; }
    10% { transform: translateX(-12px) ; filter: brightness(3) saturate(0); }
    30% { transform: translateX(9px); filter: brightness(1.8); }
    50% { transform: translateX(-7px); filter: brightness(1.4); }
    72% { transform: translateX(4px); }
  }
  .anim-faint {
    animation: faintfall 1.1s ease forwards;
  }
  @keyframes faintfall {
    0% { transform: translateY(0); filter: none; opacity: 1; }
    100% { transform: translateY(46px); filter: grayscale(1) brightness(0.6); opacity: 0; }
  }
  .anim-win {
    animation: winbounce 0.6s ease 2;
  }
  @keyframes winbounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-18px); }
  }

  /* ---- beam ---- */
  .beam {
    position: absolute;
    height: 16px;
    margin-top: -8px;
    transform-origin: left center;
    border-radius: 8px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--bc) 25%,
      #fff 50%,
      var(--bc) 75%,
      transparent
    );
    box-shadow:
      0 0 16px var(--bc),
      0 0 40px var(--bc);
    animation: beamfire 0.95s ease-out both;
    z-index: 3;
    pointer-events: none;
  }
  @keyframes beamfire {
    0% { clip-path: inset(0 100% 0 0); opacity: 0; }
    12% { clip-path: inset(0 0 0 0); opacity: 1; }
    30% { opacity: 0.85; }
    45% { opacity: 1; }
    60% { opacity: 0.9; }
    85% { opacity: 1; }
    100% { clip-path: inset(0 0 0 100%); opacity: 0; }
  }

  /* ---- orb ---- */
  .orb {
    position: absolute;
    font-size: 20px;
    line-height: 34px;
    width: 34px;
    height: 34px;
    text-align: center;
    margin: -17px 0 0 -17px;
    border-radius: 50%;
    background: radial-gradient(circle, #fff 8%, var(--bc) 45%, transparent 75%);
    box-shadow:
      0 0 14px var(--bc),
      0 0 38px var(--bc);
    animation: orbfly 0.62s cubic-bezier(0.3, -0.3, 0.7, 0.4) both;
    z-index: 3;
    pointer-events: none;
  }
  @keyframes orbfly {
    0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
    18% { opacity: 1; transform: translate(calc(var(--tx) * 0.15), calc(var(--ty) * 0.15 - 36px)) scale(0.9); }
    60% { transform: translate(calc(var(--tx) * 0.6), calc(var(--ty) * 0.6 - 40px)) scale(1.1); }
    100% { transform: translate(var(--tx), var(--ty)) scale(1.25); opacity: 0.95; }
  }

  /* ---- stream + impact sparks ---- */
  .spark {
    position: absolute;
    margin: -8px 0 0 -8px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 3;
    opacity: 0;
    animation: sparkfly 0.6s ease-out both;
    text-align: center;
  }
  .spark.circle {
    background: radial-gradient(circle, #fff 10%, var(--bc) 50%, transparent 78%);
    box-shadow: 0 0 10px var(--bc);
  }
  .spark.imp {
    animation-duration: 0.5s;
  }
  @keyframes sparkfly {
    0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
    15% { opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; }
  }

  /* ---- lightning bolt ---- */
  .bolt {
    position: absolute;
    top: 0;
    z-index: 4;
    pointer-events: none;
    animation: boltflash 0.4s ease-out both;
  }
  .bolt polyline {
    fill: none;
    stroke: #ffec8a;
    stroke-width: 4;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 8px #ffd94a) drop-shadow(0 0 22px #ffd94a);
  }
  @keyframes boltflash {
    0% { opacity: 0; }
    10% { opacity: 1; }
    35% { opacity: 0.3; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* ---- quake rocks ---- */
  .rock {
    position: absolute;
    top: -36px;
    z-index: 3;
    pointer-events: none;
    animation: rockfall 0.7s ease-in both;
  }
  @keyframes rockfall {
    0% { transform: translateY(0) rotate(0); opacity: 0; }
    12% { opacity: 1; }
    85% { opacity: 1; }
    100% { transform: translateY(78vh) rotate(140deg); opacity: 0; }
  }

  /* ---- impact ring + flash ---- */
  .impact {
    position: absolute;
    width: 26px;
    height: 26px;
    margin: -13px 0 0 -13px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 4;
    background: radial-gradient(circle, #fff 20%, var(--bc) 55%, transparent 75%);
    animation: impactboom 0.45s ease-out both;
  }
  .impact::after {
    content: "";
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    border: 3px solid var(--bc);
    animation: impactring 0.5s ease-out both;
  }
  @keyframes impactboom {
    0% { transform: scale(0.3); opacity: 1; }
    40% { transform: scale(2.4); opacity: 0.9; }
    100% { transform: scale(3.4); opacity: 0; }
  }
  @keyframes impactring {
    0% { transform: scale(0.4); opacity: 1; }
    100% { transform: scale(3); opacity: 0; }
  }

  /* ---- damage number ---- */
  .dmg {
    position: absolute;
    transform: translateX(-50%);
    z-index: 6;
    font-weight: 800;
    font-size: 17px;
    color: #fff;
    text-shadow:
      0 2px 4px rgba(0, 0, 0, 0.8),
      0 0 12px rgba(255, 120, 80, 0.8);
    animation: dmgrise 0.85s ease-out both;
    pointer-events: none;
    white-space: nowrap;
  }
  .dmg.crit {
    font-size: 21px;
    color: #ffd94a;
  }
  @keyframes dmgrise {
    0% { transform: translateX(-50%) translateY(6px) scale(0.5); opacity: 0; }
    18% { transform: translateX(-50%) translateY(0) scale(1.2); opacity: 1; }
    30% { transform: translateX(-50%) scale(1); }
    100% { transform: translateX(-50%) translateY(-36px); opacity: 0; }
  }

  /* ---- big-hit screen flash ---- */
  .flashover {
    position: absolute;
    inset: 0;
    z-index: 8;
    pointer-events: none;
    mix-blend-mode: screen;
    animation: quickflash 0.24s ease-out both;
  }
  @keyframes quickflash {
    0% { opacity: 0; }
    25% { opacity: 0.3; }
    100% { opacity: 0; }
  }

  /* ---- big cartoon callouts (dodge / charge / comeback / crit) ---- */
  .callout {
    position: absolute;
    top: 38%;
    left: 50%;
    z-index: 9;
    transform: translate(-50%, -50%);
    font-size: 30px;
    font-weight: 900;
    letter-spacing: 0.03em;
    white-space: nowrap;
    pointer-events: none;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
    animation: calloutpop 1s cubic-bezier(0.2, 1.5, 0.4, 1) both;
  }
  .c-dodge { color: #6fe3e0; }
  .c-charge { color: #ffd94a; }
  .c-comeback { color: #ff7a5c; }
  .c-crit { color: #ffec8a; }
  @keyframes calloutpop {
    0% { transform: translate(-50%, -50%) scale(2.4) rotate(-6deg); opacity: 0; }
    18% { transform: translate(-50%, -50%) scale(1) rotate(-3deg); opacity: 1; }
    70% { transform: translate(-50%, -50%) scale(1) rotate(-3deg); opacity: 1; }
    100% { transform: translate(-50%, -64%) scale(0.9); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .callout { animation: none; }
  }

  /* ---- VS intro ---- */
  .vs {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    background: rgba(15, 12, 24, 0.55);
    pointer-events: none;
  }
  .vsname {
    font-size: 19px;
    font-weight: 800;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  }
  .vl {
    animation: slideL 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
  .vr {
    animation: slideR 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  }
  @keyframes slideL {
    from { transform: translateX(-180px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideR {
    from { transform: translateX(180px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .vsmark {
    font-size: 30px;
    font-weight: 900;
    color: #e3350d;
    text-shadow:
      0 0 18px rgba(227, 53, 13, 0.9),
      0 2px 6px rgba(0, 0, 0, 0.8);
    animation: vspop 0.45s 0.25s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }
  @keyframes vspop {
    from { transform: scale(3); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  /* ---- victory confetti ---- */
  .confetto {
    position: absolute;
    top: -12px;
    width: 7px;
    height: 11px;
    border-radius: 2px;
    z-index: 9;
    pointer-events: none;
    animation: confallz 1.7s ease-in both;
  }
  @keyframes confallz {
    0% { transform: translateY(0) translateX(0) rotate(0); opacity: 1; }
    100% { transform: translateY(85vh) translateX(var(--drift)) rotate(520deg); opacity: 0.4; }
  }

  .msg {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(20, 16, 32, 0.88);
    border: 1px solid rgba(120, 108, 160, 0.45);
    font-size: 13px;
    min-height: 18px;
    z-index: 7;
  }

  .hpbox {
    position: absolute;
    width: 200px;
    padding: 7px 10px;
    border-radius: 10px;
    background: rgba(20, 16, 32, 0.85);
    border: 1px solid rgba(120, 108, 160, 0.45);
    z-index: 5;
  }
  .boxR {
    top: 12px;
    left: 12px;
  }
  .boxL {
    bottom: 52px;
    right: 12px;
  }
  .hpname {
    font-size: 12px;
    font-weight: 700;
  }
  .hpname em {
    font-style: normal;
    font-weight: 400;
    color: #9d92bd;
    font-size: 10px;
  }
  .hpbar {
    position: relative;
    margin-top: 4px;
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }
  .ghost {
    position: absolute;
    inset: 0 auto 0 0;
    background: rgba(255, 235, 200, 0.55);
    border-radius: 4px;
    transition: width 0.45s ease 0.25s;
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 4px;
    transition: width 0.35s ease;
  }
  .fill.ok {
    background: #5fd068;
  }
  .fill.warn {
    background: #f0c053;
  }
  .fill.low {
    background: #e3554d;
  }
  .hpnum {
    font-size: 10px;
    color: #9d92bd;
    margin-top: 2px;
    text-align: right;
  }

  .overbtns {
    position: absolute;
    bottom: 52px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 10;
  }
  .overbtns button {
    padding: 7px 18px;
    border-radius: 10px;
    border: 1px solid rgba(120, 108, 160, 0.5);
    background: rgba(33, 28, 48, 0.95);
    color: #ece6f7;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
  }
  .overbtns button:hover {
    border-color: #f0b66a;
  }
</style>
