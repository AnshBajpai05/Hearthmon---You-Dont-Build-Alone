<script lang="ts">
  // V2 — unified, DATA-DRIVEN Pixi stage: one Application holding a biome scene
  // (derived from biomes.ts via the pet's type) + the mesh-warp pet, in a single
  // ticker. Moonlit Shore is the gold standard; every other type renders from
  // its palette + light + particle kind. This is the shape that drops into the
  // real widget.
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import {
    Application, Container, Graphics, MeshPlane, Sprite, Text, Rectangle, Texture, BlurFilter
  } from "pixi.js";
  import { Spring } from "$lib/pixi/spring";
  import { spriteUrl, fallbackUrl, dexEntry, TRAINER_URL, FORM_FLAME } from "$lib/sprites";
  import { type AnimKind, FAMILY, VARIANT } from "$lib/fx";
  import { STATS } from "$lib/stats";
  import { founderMark } from "$lib/founder";
  import { biomeForType } from "$lib/biomes";

  interface Props {
    dexId: number;
    shiny?: boolean;
    size?: number;
    petState?: string; // brain bridge: "idle" | "sleeping" | "happy" | …
    bubble?: string; // the spoken line (speech bubble), parity with Classic
    calm?: boolean; // comfort / deep-flow → settle (no zoomies)
    flowContext?: "none" | "waiting" | "friction" | "focus"; // embodies context engine
    habitat?: boolean; // biome scene on/off (Classic's habitat toggle)
    habitatShape?: "full" | "sphere" | "square"; // biome SHAPE — independent of backdrop
    bgStyle?: "orb" | "square" | "ground" | "off"; // pet backdrop (Classic's 🌿 cycle)
    opacity?: number; // widget transparency slider (--wo)
    dimmed?: boolean; // Chapter Access soft pause: dim the HABITAT, keep the pet bright
    onTap?: () => void; // bridge to the shared brain (parity with Classic)
    onStroke?: () => void;
    onBackgroundDown?: () => void; // empty-space press → drag the window
    onContextLost?: () => void; // WebGL context lost (GPU sleep/reset) → ask the parent to remount
    fx?: AliveFx; // pet-attached FX bridged from the shared brain (parity with Classic)
    audioEnergy?: number; // 0..1 smoothed system-audio loudness (music awareness)
    audioBeat?: number; // increments on each detected beat
    audioStrength?: number; // 0..1 strength of the latest beat
    audioMusical?: number; // 0..1 confidence it's MUSIC (vs speech) — gates the drop eruption
    spriteOverride?: string | null; // mega/special form: a full sprite URL replacing the dex sprite
    spriteFallback?: string | null; // if spriteOverride fails, drop to THIS (the form's own static) — not the base
    typeOverride?: string | null; // mega/special form element shift → biome + ambient
    mega?: boolean; // in a special form → draw the energy aura
  }
  // every FX signal Classic renders on its DOM pet, bridged for the Pixi body
  export interface AliveFx {
    switchFx: "none" | "recall" | "ballout" | "gap" | "throw" | "release";
    attacking: boolean;
    atkKind: AnimKind | null;
    atkColor: string;
    atkEmoji: string;
    atkName: string;
    atkCls: 1 | 2 | 3;
    atkIntensity: number; // 0..1 (move power) → scales size / particles
    atkFlavor: string; // v4: move colour tinted toward the species' 2nd type → sparks + glow
    dir: 1 | -1;
    evoActive: boolean;
    evoFlash: boolean;
    visitorId: number | null;
    visitorShiny: boolean;
    visitorX: number;
    visitorFlip: boolean;
    eating: boolean;
    birthday: boolean;
    breakthrough: boolean; // triggers a brief environmental bloom
    reactionKind: string | null; // v3 poke/irritate beat (flare/phase/doze/aura/spark/shiver/bounce/turn)
    reactionN: number; // nonce — rising edge replays the beat
    reactionColor: string; // pet's primary type colour for the beat FX
  }
  const NO_FX: AliveFx = {
    switchFx: "none", attacking: false, atkKind: null, atkColor: "#ffffff", atkEmoji: "✨",
    atkName: "", atkCls: 2, atkIntensity: 0.5, atkFlavor: "#ffffff", dir: -1, evoActive: false, evoFlash: false, visitorId: null,
    visitorShiny: false, visitorX: 0, visitorFlip: false, eating: false, birthday: false, breakthrough: false,
    reactionKind: null, reactionN: 0, reactionColor: "#ffffff"
  };
  let {
    dexId,
    shiny = false,
    size = 230,
    petState = "idle",
    bubble = "",
    calm = false,
    flowContext = "none",
    habitat = false,
    habitatShape = "full",
    bgStyle = "orb",
    opacity = 1,
    dimmed = false,
    onTap,
    onStroke,
    onBackgroundDown,
    onContextLost,
    fx = NO_FX,
    audioEnergy = 0,
    audioBeat = 0,
    audioStrength = 0,
    audioMusical = 0,
    spriteOverride = null,
    spriteFallback = null,
    typeOverride = null,
    mega = false
  }: Props = $props();

  let host: HTMLDivElement;
  let app: Application | null = null;

  const hexNum = (h: string) => parseInt(h.replace("#", ""), 16);
  function rgba(s: string): { color: number; alpha: number } {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return { color: 0xffffff, alpha: 1 };
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    return { color: ((p[0] & 255) << 16) | ((p[1] & 255) << 8) | (p[2] & 255), alpha: p[3] ?? 1 };
  }

  onMount(() => {
    let destroyed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const a = new Application();
      // biome palette is MUTABLE so a form switch can change the whole world live
      // (no teardown). applyBiome() recomputes these + recolors the scene.
      let petType = typeOverride ?? dexEntry(dexId)?.type ?? "normal"; // drives type-specific idles (mega may shift it)
      // "level"/power proxy from the species base-stat total → scales ground-lightning size & impact
      // (a small early mon = small bolts; a legendary = big ones). 0 (weak) .. 1 (legendary-tier).
      const bstPower = (d: number) => {
        const st = STATS[d];
        const bst = st ? st[0] + st[1] + st[2] + st[3] + st[4] + st[5] : 320;
        return Math.max(0, Math.min(1, (bst - 300) / 320));
      };
      let petPower = bstPower(dexId);
      let biome = biomeForType(petType);
      let sky0 = hexNum(biome.wall[0]);
      let sky1 = hexNum(biome.wall[1]);
      let grd0 = hexNum(biome.floor[0]);
      let grd1 = hexNum(biome.floor[1]);
      let lightCol = hexNum(biome.light);
      let part = rgba(biome.particleColor);
      let hasWater = biome.ground === "water";
      let pkind = biome.particle; // firefly|ember|pollen|spark|dust|snow|star|mist
      let dimLerp = 0; // Chapter Access: eases 0→1 when `dimmed`, fades the habitat like Classic
      let founderSig = ""; // Founder's Mark: tracks biome so the woven signature updates on switch
      let ambKind = "none"; // type-driven premium ambient: lightning | flare | rays
      let vpSig = ""; // gradient repaint signature (cleared on biome change)

      // transparent — so the desktop shows through (parity with the see-through widget).
      // PIN WebGL (not WebGPU): the vanish-recovery below hooks `webglcontextlost` + polls
      // `gl.isContextLost()`, both WebGL-only. Left unpinned, Pixi v8 on WebView2 can pick WebGPU,
      // whose device-loss is a different (Promise) API → our recovery becomes dead code and a lost
      // canvas stays blank forever (= "the widget vanished"). `low-power` binds the always-on
      // integrated GPU rather than a discrete GPU that power-gates on idle (the usual trigger);
      // failIfMajorPerformanceCaveat:false lets it fall back to software instead of going blank.
      await a.init({
        backgroundAlpha: 0, antialias: true, resizeTo: host,
        preference: "webgl", powerPreference: "low-power", failIfMajorPerformanceCaveat: false
      });
      if (destroyed) {
        a.destroy(true);
        return;
      }
      app = a;
      host.appendChild(a.canvas);

      const W = () => a.screen.width;
      const H = () => a.screen.height;
      const horizon = () => H() * 0.62;
      // pet feet baseline: globe → the sphere's shoreline; full landscape → low;
      // no biome → centered (parity with Classic)
      const groundY = () => {
        const w = W();
        const h = H();
        if (habitat && habitatShape !== "full") {
          const gR = Math.min(w, h) * 0.42;
          return h * 0.88 - gR * 0.8; // globe horizon — matches the bottom-anchored gcy (0.88h - gR) + 0.2gR
        }
        return h * (habitat ? 0.82 : 0.82);
      };

      // ════ SCENE LAYERS ════
      const back = new Graphics();
      const orb = new Container(); // the biome's light source (moon / sun / lamp)
      const halo = new Graphics();
      const orbCore = new Graphics();
      orb.addChild(halo, orbCore); // colored in applyBiome()
      const reflect = new Graphics(); // water reflection (water biomes only)
      const waves = new Graphics(); // sea (water biomes only)
      const lantern = new Graphics();
      for (let i = 5; i >= 1; i--) lantern.circle(0, 0, 6 + i * 10).fill({ color: 0xffb066, alpha: 0.05 });
      lantern.circle(0, 0, 5).fill({ color: 0xffd9a0, alpha: 0.85 });
      const flies = new Container(); // particle field (rebuilt per biome)
      let P: { g: Graphics; bx: number; by: number; ph: number; sp: number; amp: number; prog: number }[] = [];

      // gradient via stacked rects (no FillGradient — avoids Pixi-version API drift)
      const lerpCol = (c0: number, c1: number, t: number) => {
        const r = Math.round(((c0 >> 16) & 255) + (((c1 >> 16) & 255) - ((c0 >> 16) & 255)) * t);
        const g = Math.round(((c0 >> 8) & 255) + (((c1 >> 8) & 255) - ((c0 >> 8) & 255)) * t);
        const b = Math.round((c0 & 255) + ((c1 & 255) - (c0 & 255)) * t);
        return (r << 16) | (g << 8) | b;
      };
      // Rich, saturated flame colours for special forms (the biome `light` is a pale ambient tint
      // that washes out as fire). ONE source — FORM_FLAME (shared with the attack/irritate FX so a
      // form's whole presence reads in one colour); converted to ints once for the render hot-path.
      const MEGA_FLAME: Record<string, number> = {};
      for (const [k, v] of Object.entries(FORM_FLAME)) MEGA_FLAME[k] = hexNum(v);
      function band(x: number, y: number, w: number, h: number, c0: number, c1: number, n: number) {
        for (let i = 0; i < n; i++) back.rect(x, y + (h * i) / n, w, h / n + 1).fill({ color: lerpCol(c0, c1, i / n) });
      }
      function paintBack() {
        const w = W();
        const h = H();
        const hz = horizon();
        back.clear();
        band(0, 0, w, hz, sky0, sky1, 14);
        band(0, hz, w, h - hz, grd0, grd1, 8);
      }

      // ════ PARTICLES (kind-driven) ════

      const applyBiome = (newDex: number) => {
        petType = typeOverride ?? dexEntry(newDex)?.type ?? "normal";
        petPower = bstPower(newDex);
        biome = biomeForType(petType);
        sky0 = hexNum(biome.wall[0]);
        sky1 = hexNum(biome.wall[1]);
        grd0 = hexNum(biome.floor[0]);
        grd1 = hexNum(biome.floor[1]);
        lightCol = hexNum(biome.light);
        part = rgba(biome.particleColor);
        hasWater = biome.ground === "water";
        pkind = biome.particle;
        ambKind =
          petType === "electric" ? "lightning"
          : petType === "fire" ? "hearth"
          : ["water", "ice", "fairy"].includes(petType) ? "aurora"
          : ["psychic", "dragon"].includes(petType) ? "constellation"
          : ["ghost", "dark", "poison"].includes(petType) ? "whispers"
          : ["grass", "bug"].includes(petType) ? "canopy"
          : ["flying"].includes(petType) ? "current"
          : ["rock", "ground"].includes(petType) ? "earth"
          : ["steel"].includes(petType) ? "industrial"
          : "warmth"; // normal, fighting
        vpSig = ""; // force gradient repaint
        
        flies.removeChildren();
        const PSIZE = pkind === "mist" ? 7 : pkind === "star" || pkind === "spark" ? 1.5 : 2.2;
        P = Array.from({ length: pkind === "mist" ? 7 : 14 }, () => {
          const g = new Graphics().circle(0, 0, PSIZE).fill({ color: part.color, alpha: part.alpha });
          if (pkind === "firefly" || pkind === "ember") g.circle(0, 0, PSIZE * 2).fill({ color: part.color, alpha: part.alpha * 0.25 });
          flies.addChild(g);
          return { g, bx: Math.random(), by: Math.random(), ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.6, amp: 6 + Math.random() * 16, prog: Math.random() };
        });
      };
      
      const loadImg = (url: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });

      interface GifFrame { bmp: ImageBitmap; dur: number }
      const frames: GifFrame[] = [];
      let natW = 96, natH = 96;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ImageDecoderCtor = (globalThis as unknown as { ImageDecoder?: any }).ImageDecoder;
      let reloadSeq = 0; // supersede token — a newer switch cancels an in-flight load
      let petReady = true; // false while a sprite loads → the OLD pet is hidden (no mismatch)

      // NOTE: a FRESH canvas is made per reload (below). Reusing one canvas made
      // Texture.from return Pixi's CACHED CanvasSource at the OLD size → the pet came
      // out too wide / too shrunk after a form switch until a manual refresh.
      let petCanvas = document.createElement("canvas");
      let petCtx = petCanvas.getContext("2d", { willReadFrequently: true });
      let visCX = 48, visCY = 48, contentW = 96, contentH = 96;
      
      let tex: Texture = Texture.EMPTY;
      const GX = 7;
      const GY = 8;
      let mesh: MeshPlane = new MeshPlane({ texture: Texture.EMPTY, verticesX: GX, verticesY: GY });
      let pw = 96, ph = 96, pcx = 48, maxY = 96, petScale = 1;
      let deformable = false;
      let posBuf: { data: Float32Array; update: () => void } | null = null;
      let baseV = new Float32Array(0);
      let uv = new Float32Array(0);
      
      let drawShadow = () => {};
      let gifAcc = 0; // time accumulator for GIF frame advance
      let frameIdx = 0; // current decoded GIF frame

      // Build the mesh from whatever's been decoded so far (frame 0, or a static img),
      // swap it in, and mark the pet ready. The rest of the GIF frames stream in after.
      const buildPet = (newDex: number, animated: boolean, staticImg: HTMLImageElement | null) => {
        petCanvas = document.createElement("canvas"); // fresh canvas → fresh-sized source
        petCanvas.width = natW;
        petCanvas.height = natH;
        petCtx = petCanvas.getContext("2d", { willReadFrequently: true });
        visCX = natW / 2; visCY = natH / 2; contentW = natW; contentH = natH;
        if (petCtx) {
          petCtx.clearRect(0, 0, natW, natH);
          if (animated && frames[0]) petCtx.drawImage(frames[0].bmp, 0, 0);
          else if (staticImg) petCtx.drawImage(staticImg, 0, 0, natW, natH);
          try {
            const dd = petCtx.getImageData(0, 0, natW, natH).data;
            let top = natH, bot = -1, left = natW, right = -1;
            for (let y = 0; y < natH; y++) {
              for (let x = 0; x < natW; x++) {
                if (dd[(y * natW + x) * 4 + 3] > 20) {
                  if (y < top) top = y;
                  if (y > bot) bot = y;
                  if (x < left) left = x;
                  if (x > right) right = x;
                }
              }
            }
            if (bot > top && right > left) {
              visCX = (left + right) / 2; visCY = (top + bot) / 2; contentW = right - left; contentH = bot - top;
            }
          } catch {}
        }
        const oldTex = tex;
        try {
          tex = Texture.from(animated && petCtx ? petCanvas : (staticImg as HTMLImageElement));
        } catch { return; }
        if (tex.source) tex.source.scaleMode = "nearest";
        const oldMesh = mesh;
        mesh = new MeshPlane({ texture: tex, verticesX: GX, verticesY: GY });
        const texW = tex.width || 96;
        const texH = tex.height || 96;
        pw = texW; ph = texH; pcx = texW / 2; maxY = texH;
        petScale = size / Math.max(pw, ph);
        mesh.pivot.set(pcx, maxY);
        mesh.scale.set(petScale);
        mesh.eventMode = "static";
        mesh.cursor = "grab";
        mesh.hitArea = new Rectangle(0, 0, texW, texH);
        try {
          const b = mesh.geometry.getBuffer("aPosition") as unknown as { data: Float32Array; update: () => void };
          baseV = Float32Array.from(b.data);
          uv = new Float32Array(baseV.length);
          for (let i = 0; i < baseV.length; i += 2) uv[i + 1] = baseV[i + 1] / texH;
          posBuf = b;
          deformable = true;
        } catch {
          deformable = false;
        }
        if (oldMesh && a.stage.children.includes(oldMesh)) {
          const idx = a.stage.getChildIndex(oldMesh);
          a.stage.addChildAt(mesh, idx);
          oldMesh.destroy({ children: true });
        }
        if (oldTex && oldTex !== Texture.EMPTY && oldTex !== tex) {
          try { oldTex.destroy(true); } catch { /* freed with its source */ }
        }
        drawShadow();
        applyBiome(newDex);
        petReady = true; // new pet on screen — reveal it
      };

      const reloadPet = async (newDex: number, newShiny: boolean) => {
        const seq = ++reloadSeq;
        petReady = false; // hide the old pet until the new one is built (no mismatch)
        for (const f of frames) f.bmp.close();
        frames.length = 0;
        gifAcc = 0;
        frameIdx = 0;
        const live = () => seq === reloadSeq && !destroyed; // a newer switch supersedes us

        // ── animated path: decode FRAME 0, show it immediately, stream the rest ──
        if (ImageDecoderCtor) {
          try {
            const resp = await fetch(spriteOverride || spriteUrl(newDex, newShiny), { mode: "cors" });
            if (!live()) return;
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              if (!live()) return;
              const dec = new ImageDecoderCtor({ data: buf, type: "image/gif" });
              await dec.tracks.ready;
              if (!live()) return;
              const count: number = dec.tracks.selectedTrack?.frameCount ?? 1;
              const f0 = await dec.decode({ frameIndex: 0 });
              if (!live()) { f0.image.close(); return; }
              natW = f0.image.displayWidth || f0.image.codedWidth || natW;
              natH = f0.image.displayHeight || f0.image.codedHeight || natH;
              frames.push({ bmp: await createImageBitmap(f0.image), dur: (f0.image.duration ?? 90000) / 1e6 });
              f0.image.close();
              buildPet(newDex, true, null); // ← pet visible NOW (static first frame)
              // stream the remaining frames in the background; the tick animates as they arrive
              void (async () => {
                for (let i = 1; i < count; i++) {
                  if (!live()) return;
                  try {
                    const { image } = await dec.decode({ frameIndex: i });
                    frames.push({ bmp: await createImageBitmap(image), dur: (image.duration ?? 90000) / 1e6 });
                    image.close();
                  } catch { break; }
                }
              })();
              return;
            }
          } catch { /* fall through to a static sprite */ }
        }

        // ── fallback: a single static image (no WebCodecs / decode failed) ──
        const staticImg = (await loadImg(spriteOverride || spriteUrl(newDex, newShiny))) ?? (await loadImg((spriteOverride && spriteFallback) || fallbackUrl(newDex, newShiny)));
        if (!live()) return;
        if (!staticImg) { petReady = true; return; }
        natW = staticImg.naturalWidth || 96;
        natH = staticImg.naturalHeight || 96;
        buildPet(newDex, false, staticImg);
      };

      await reloadPet(dexId, shiny);
      if (destroyed) return;

      const platform = new Graphics(); // pet backdrop (orb / ground / off) — incl. the shelf ring-glow
      // Energy Ring Ecosystem: the globe's ground is an ENERGIZED orbital plane, not a pad. Many tiny
      // type-tinted stars orbit in concentric elliptic rings around the base (front bright, back fades
      // behind the sphere), with occasional energy arcs leaping between them — "the globe powers the
      // floor". Sprites are batched (like the galaxy) so hundreds stay cheap; arcs are a thin Graphics.
      const groundRings = new Container();
      const groundArcs = new Graphics(); // brief energy filaments between neighbouring stars
      groundArcs.blendMode = "add";
      type RingStar = { sprite: Sprite; ringR: number; ang: number; speed: number; baseA: number; sz: number; mix: number };
      let ringStars: RingStar[] = [];
      let ringsBuilt = false;
      let ringSig = -1; // retint when the type light colour changes
      let ringTex: Texture | null = null;
      let arcT = 6 + Math.random() * 8; // first arc ~6-14s in, then ~once every 30s
      const liveArcs: { pts: number[]; max: number; life: number; pow: number }[] = [];
      // ground-plane params, refreshed each frame so a GLOBE strike can fire a reactionary chain
      let gpCx = 0, gpCy = 0, gpR = 1;
      let ringFlash = 0; // whole-field brightness spike on a strike, decays fast
      // Build one chain-lightning bolt that travels around the ring, hopping + zig-zagging. `power`
      // (1 = ambient, ~1.5–2 = reaction to a globe strike) makes it longer, thicker and brighter.
      function spawnGroundChain(power: number) {
        if (!ringStars.length) return;
        const cx = gpCx, cy = gpCy, gR = gpR, ASPECT = 0.3;
        const proj = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r * gR, cy + Math.sin(a) * r * gR * ASPECT];
        let ang = Math.random() * Math.PI * 2;
        let rr = 0.42 + Math.random() * 0.84;
        const dirSign = Math.random() < 0.5 ? -1 : 1;
        const nodes = Math.round((5 + Math.random() * 3) * power); // stronger strike → longer chain
        let [px, py] = proj(ang, rr);
        const pts: number[] = [px, py];
        for (let n = 0; n < nodes; n++) {
          ang += dirSign * (0.13 + Math.random() * 0.17);
          rr = Math.max(0.4, Math.min(1.3, rr + (Math.random() - 0.5) * 0.3));
          const [nx, ny] = proj(ang, rr);
          const SEG = 3 + Math.floor(Math.random() * 3);
          for (let k = 1; k < SEG; k++) {
            const f = k / SEG;
            pts.push(px + (nx - px) * f + (Math.random() - 0.5) * 13, py + (ny - py) * f + (Math.random() - 0.5) * 9);
          }
          pts.push(nx, ny);
          px = nx; py = ny;
        }
        liveArcs.push({ pts, max: 0.3 + 0.1 * power, life: 0.3 + 0.1 * power, pow: power });
      }
      function buildGroundRings() {
        if (!app) return;
        if (!ringTex) ringTex = app.renderer.generateTexture(new Graphics().circle(0, 0, 1.5).fill({ color: 0xffffff }));
        groundRings.removeChildren();
        ringStars = [];
        const RINGS = 7;
        for (let ri = 0; ri < RINGS; ri++) {
          const t01 = ri / (RINGS - 1);             // 0 inner → 1 outer
          const ringR = 0.42 + t01 * 0.84;           // ×gR at render time
          const count = Math.round(130 + t01 * 160); // dense field; outer rings hold more (~1500 total)
          for (let i = 0; i < count; i++) {
            const bright = Math.random() < 0.12;
            const sp = Sprite.from(ringTex);
            sp.anchor.set(0.5);
            ringStars.push({
              sprite: sp,
              ringR: ringR + (Math.random() - 0.5) * 0.05, // band jitter → reads as a band, not a wire
              ang: Math.random() * Math.PI * 2,
              speed: 0.05 + (1 - t01) * 0.05,              // inner rings orbit a touch faster (parallax)
              baseA: bright ? 0.85 + Math.random() * 0.15 : 0.4 + Math.random() * 0.4,
              sz: bright ? 0.7 + Math.random() * 0.8 : 0.22 + Math.random() * 0.34,
              mix: bright ? 0.7 + Math.random() * 0.3 : Math.random() * 0.5 // white ↔ type-colour blend
            });
            groundRings.addChild(sp);
          }
        }
        ringsBuilt = true;
        ringSig = -1;
      }
      const rimGlow = new Graphics(); // soft light-colored glow on the habitat boundary
      rimGlow.filters = [new BlurFilter({ strength: 8, quality: 3 })];
      rimGlow.blendMode = "add";
      rimGlow.visible = false;
      const petSep = new Graphics(); // soft dark halo behind the pet → silhouette reads first
      petSep.filters = [new BlurFilter({ strength: 20, quality: 3 })];
      petSep.visible = false;
      const megaAura = new Graphics(); // mega/special-form energy aura — additive, pulsing
      megaAura.blendMode = "add";
      megaAura.visible = false;
      const petShadow = new Graphics();
      drawShadow = () => {
        petShadow.clear();
        petShadow.ellipse(0, 0, pw * 0.46, 7).fill({ color: 0x000000, alpha: 0.34 });
      };
      drawShadow();
      const hearts = new Container();
      const zzz = new Text({ text: "z  z  z", style: { fill: 0xcfc6e8, fontSize: 13 } });
      zzz.anchor.set(0.5);
      zzz.visible = false;

      // speech bubble (parity with Classic's <Bubble>)
      const bubbleC = new Container();
      const bubbleBg = new Graphics();
      const bubbleTxt = new Text({
        text: "",
        style: { fill: 0xece6f7, fontSize: 12.5, fontFamily: "system-ui, sans-serif", wordWrap: true, wordWrapWidth: 200, align: "center" }
      });
      bubbleTxt.anchor.set(0.5, 0);
      bubbleC.addChild(bubbleBg, bubbleTxt);
      bubbleC.visible = false;

      // ════ PET-ATTACHED FX (parity with everything Classic draws in .stage) ════
      const visitorSprite = new Sprite(); // wild visitor wandering through (behind pet)
      visitorSprite.anchor.set(0.5, 1);
      visitorSprite.visible = false;
      let visitorTexId = -1; // which dex sprite is currently loaded for the visitor
      const visX = new Spring(0, 90, 16); // smooth walk-in / walk-off

      const trainer = new Sprite(); // Ash, recalling/throwing during the switch ceremony
      trainer.anchor.set(0.5, 1);
      trainer.visible = false;
      let trainerTex: Texture | null = null;
      // Showdown's trainer png has no CORS header → WebGL can't upload it. Use the
      // bundled same-origin copy (static/ash.png); fall back to the remote for <img>.
      void (loadImg("/ash.png").then((i) => i ?? loadImg(TRAINER_URL))).then((img) => {
        if (!img || destroyed) return;
        try {
          const tt = Texture.from(img);
          if (tt.source) tt.source.scaleMode = "nearest";
          trainerTex = tt;
          trainer.texture = tt;
        } catch { /* trainer is best-effort flavor — ceremony still works without it */ }
      });

      const ball = new Graphics(); // Pokéball for the switch ceremony
      ball.visible = false;
      const burst = new Graphics(); // release flash + ring
      burst.visible = false;
      const evoGlow = new Graphics(); // evolution white pulse around the pet
      evoGlow.visible = false;

      const fxC = new Container(); // attack beams/orbs/slash/aura + sparks (pet-anchored)
      const beamG = new Graphics();
      const proj = new Text({ text: "", style: { fontSize: 24 } });
      proj.anchor.set(0.5);
      proj.visible = false;
      const callout = new Text({
        text: "", style: { fill: 0xffffff, fontSize: 13, fontFamily: "system-ui, sans-serif", fontWeight: "700" }
      });
      callout.anchor.set(0.5);
      callout.visible = false;
      const sparks = new Container();
      fxC.addChild(beamG, sparks, proj, callout);

      const hat = new Graphics(); // birthday party hat
      hat.visible = false;

      // biome scene grouped so it can be CLIPPED to the backdrop (habitat-in-sphere).
      // The mask is a CHILD of scene → Pixi uses it as a clip and never draws it
      // (adding it to the stage was what rendered the stray white square).
      const scene = new Container();
      const biomeMask = new Graphics();
      // type-driven premium ambient (lightning / fire flare / light shafts) — additive
      // glow, lives INSIDE the scene so it clips to the sphere + only shows with a habitat
      const ambient = new Graphics();
      const flash = new Graphics(); // lightning sky-flash
      const rareG = new Graphics(); // rare-event shapes (normal blend → silhouettes + glows)
      const hazeG = new Graphics(); // atmospheric depth layer
      const vignetteG = new Graphics(); // soft globe boundary overlay
      const glass = new Graphics(); // glass-dome reflections (globe only): highlight + drifting sheen + glint
      const glassMask = new Graphics(); // clips those reflections to the sphere
      const galaxyMask = new Graphics(); // clips the galaxy bowl to the sphere — prevents glow bleeding outside
      const floorGlow = new Graphics(); // warm atmospheric spill from the globe base → bleeds the inner floor into the shelf rings
      floorGlow.blendMode = "add"; // shares the rings' additive light system
      glass.blendMode = "add"; // reflections only ever brighten
      glass.visible = false;
      ambient.blendMode = "add";
      flash.blendMode = "add";
      scene.addChild(back, floorGlow, orb, reflect, waves, hazeG, lantern, flies, ambient, flash, rareG, biomeMask);

      // ── rotating "universe" for the sphere-habitat ground ──────────────────────
      // A flat spiral galaxy on the ground disc that slowly turns (same cadence as the
      // glass sheen), tinted by the biome/ground colour. Drawn ONCE in unit space (radius
      // ~1) and only re-tinted when the colour changes; each frame we just move, flatten
      // (perspective squash) and rotate the container — so resize / reload / new-Pokémon
      // never need a geometry redraw. Two nested containers: the INNER one rotates in the
      // disc plane, the OUTER one squashes it flat (scale order: squash must be outermost).
      const galaxy = new Container();
      const galaxyBack = new Container();
      const galaxyMid = new Container();
      const galaxyFront = new Container();
      const galaxyBackGfx = new Graphics();
      const galaxyMidGfx = new Graphics();
      const galaxyFrontGfx = new Graphics();
      const galaxyParticles = new Container();
      
      galaxyBackGfx.blendMode = "add";
      galaxyMidGfx.blendMode = "add";
      galaxyFrontGfx.blendMode = "add"; // a galaxy only adds light

      galaxyBack.addChild(galaxyBackGfx);
      galaxyMid.addChild(galaxyMidGfx);
      galaxyFront.addChild(galaxyFrontGfx, galaxyParticles);

      galaxy.addChild(galaxyBack);
      galaxy.addChild(galaxyMid);
      galaxy.addChild(galaxyFront);
      galaxy.visible = false;
      let galaxyLightSig = -1; // redraw the spiral only when the ground colour changes
      
      type GalaxyParticle = {
        sprite: Sprite; arm: number; radius: number; angle: number;
        speed: number; depth: number; size: number; baseAlpha: number; wobble: number;
      };
      let galaxyP: GalaxyParticle[] = [];
      let starTex: Texture | null = null;

      const drawGalaxy = () => {
        galaxyBackGfx.clear();
        galaxyMidGfx.clear();
        galaxyFrontGfx.clear();
        galaxyParticles.removeChildren();
        galaxyP = [];

        const rnd = (n: number) => { const s = Math.sin(n * 127.1 + 0.3) * 43758.5453; return s - Math.floor(s); };

        // Bowl coordinate system (no tilt, no squash):
        //   unit_x = cos(angle) * r          — horizontal spread
        //   unit_y = (1 - r²) * BD           — bowl depth: 0 at rim, BD at centre/bottom
        // Rotating around the bowl axis only updates unit_x (y is fixed per star), so
        // stars trace horizontal circles at their bowl height → the concentric-oval silhouette.
        const BD = 0.40; // bowl depth in unit space (0 = rim, 0.40 = bowl centre/bottom)

        // ── derive the WHOLE galaxy palette from the type's light colour ──
        // nebula, stars and core all share one hue family so the bowl reads as a single object
        // (a fire pet → warm reds/golds; a water pet → blues/teals; psychic → purples/pinks).
        const toHsl = (c: number) => {
          const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
          let h = 0;
          if (d) {
            if (mx === r) h = ((g - b) / d) % 6;
            else if (mx === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60; if (h < 0) h += 360;
          }
          const l = (mx + mn) / 2;
          const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
          return [h, s, l] as const;
        };
        const hsl = (h: number, s: number, l: number) => {
          h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
          const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
          let r = 0, g = 0, b = 0;
          if (h < 60)       { r = c; g = x; }
          else if (h < 120) { r = x; g = c; }
          else if (h < 180) { g = c; b = x; }
          else if (h < 240) { g = x; b = c; }
          else if (h < 300) { r = x; b = c; }
          else              { r = c; b = x; }
          return ((Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255));
        };

        const [baseH, baseS] = toHsl(lightCol);
        const sat = Math.max(0.55, baseS); // floor so even muted types still read as colourful
        // core glow: the type hue pushed bright (replaces the old hand-mixed coreCol)
        const coreCol = hsl(baseH, sat * 0.7, 0.78);

        // ── BACK: intentionally empty — no nebula clouds. The flat-filled haze circles had
        // crisp edges that showed as an unwanted arc inside the sphere ("semi circle"). Colour
        // now comes purely from the type-tinted star palette + the central core glow below.

        // ── MID: type-coloured core glow only (no small circles — small radius = hexagonal in Pixi) ──
        galaxyMidGfx.circle(0, BD, 0.16).fill({ color: coreCol, alpha: 0.18 });
        galaxyMidGfx.circle(0, BD, 0.08).fill({ color: lerpCol(coreCol, 0xffffff, 0.4), alpha: 0.20 });

        // ── FRONT: compact blazing core ──
        galaxyFrontGfx.circle(0, BD, 0.038).fill({ color: lerpCol(coreCol, 0xffffff, 0.5), alpha: 0.44 });
        galaxyFrontGfx.circle(0, BD, 0.013).fill({ color: 0xffffff, alpha: 0.88 });
        for (let sp = 0; sp < 4; sp++) {
          const sa = sp * Math.PI * 0.5;
          galaxyFrontGfx.moveTo(0, BD)
            .lineTo(Math.cos(sa) * 0.052, BD + Math.sin(sa) * 0.019)
            .stroke({ color: 0xffffff, width: 0.004, alpha: 0.32 });
        }

        if (!starTex && app) {
          const g = new Graphics().circle(0, 0, 1.5).fill({ color: 0xffffff });
          starTex = app.renderer.generateTexture(g);
        }

        // 10-color palette in the SAME hue family as the nebula/core (indices 0-2 = white
        // highlights the colIdx logic relies on; 3-9 = colours fanned around the type hue)
        const palette = [
          0xffffff,                                          // pure white
          lerpCol(0xffffff, hsl(baseH, sat, 0.85), 0.35),    // cool white, faintly tinted
          hsl(baseH,       sat * 0.55, 0.86),                // tint-white
          hsl(baseH,       sat,        0.74),                // core hue
          hsl(baseH - 32,  sat,        0.70),                // analogous −
          hsl(baseH + 32,  sat,        0.72),                // analogous +
          hsl(baseH + 52,  sat * 0.90, 0.68),                // wider +
          hsl(baseH - 52,  sat * 0.90, 0.70),                // wider −
          hsl(baseH,       sat * 0.85, 0.62),                // deeper hue
          hsl(baseH + 18,  sat,        0.80),                // light hue
        ];

        const N_STARS = 3500;
        for (let i = 0; i < N_STARS; i++) {
          const isBright = rnd(i + 500) < 0.05;
          // centre-concentrated (exp > 1): dense at the bowl bottom, thinning toward the rim,
          // so stars DON'T pile into a bright ring at the edge (the old "semi circle")
          const radius = Math.min(0.97, Math.pow(rnd(i + 501), 1.4));
          const angle  = rnd(i + 502) * Math.PI * 2;
          const r2     = radius * radius;

          // sub-pixel particles: rendered diameter = 3px × size, so 0.12–0.74 → ≈0.4–2.2px
          const size = isBright ? 0.34 + rnd(i + 503) * 0.40 : 0.12 + rnd(i + 504) * 0.20;
          // alpha pushed high so tiny dots are actually visible (floors lifted for a brighter field)
          const baseAlpha = isBright
            ? 3.95 + rnd(i + 505) * 0.15
            : 2.85 + rnd(i + 506) * 0.35;

          // bright stars lean cool-white; dim stars spread across all 10 palette hues
          const colIdx = isBright
            ? (rnd(i + 507) < 0.5 ? Math.floor(rnd(i + 515) * 3) : 3 + Math.floor(rnd(i + 516) * 4))
            : Math.floor(rnd(i + 508) * palette.length);

          // inner stars orbit slightly faster (differential bowl rotation)
          const speed = 0.06 + (1 - radius) * 0.04;

          if (starTex) {
            const sprite = Sprite.from(starTex);
            sprite.anchor.set(0.5);
            sprite.tint  = palette[Math.min(colIdx, palette.length - 1)];
            const ca0    = Math.cos(angle);
            sprite.x     = ca0 * radius * 1.25;                          // vessel ASPECT: wide boat-hull
            sprite.y     = (1 - r2) * BD - r2 * 0.30 * ca0 * ca0;       // vessel RISE: sides arc up
            sprite.alpha = baseAlpha;
            galaxyParticles.addChild(sprite);

            // depth stores r² so the tick can apply the vessel RISE formula without extra squaring
            galaxyP.push({ sprite, arm: 0, radius, angle, speed,
              depth: r2, size, baseAlpha, wobble: rnd(i + 510) * Math.PI * 2 });
          }
        }
      };

      // Founder's Mark: faint signature woven into the world (parity with Classic's .roombg mark).
      // Lives in `scene` → clips to the globe, dims with the habitat. Real protection is the
      // embedded provenance (Rust founder_mark); this is the discoverable visible touch.
      const founderText = new Text({
        text: "",
        style: { fill: lightCol, fontSize: 8, fontStyle: "italic", fontFamily: "system-ui, sans-serif" }
      });
      founderText.alpha = 0;
      scene.addChild(founderText);

      // a jagged lightning polyline: wide soft glow pass + a bright thin core
      function strokeBolt(pts: number[], alpha: number) {
        if (pts.length < 4) return;
        ambient.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ambient.lineTo(pts[i], pts[i + 1]);
        // glow follows the biome light (white-gold for electric) so the arcs match the new vibe; core stays white
        ambient.stroke({ color: lerpCol(lightCol, 0xffffff, 0.35), width: 5, alpha: alpha * 0.22 });
        ambient.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ambient.lineTo(pts[i], pts[i + 1]);
        ambient.stroke({ color: 0xffffff, width: 1.6, alpha });
      }
      function genBolt(x0: number, y0: number, y1: number, spread: number): number[] {
        const pts = [x0, y0];
        let x = x0;
        for (let i = 1; i <= 7; i++) {
          x += (Math.random() - 0.5) * spread;
          pts.push(x, y0 + ((y1 - y0) * i) / 7);
        }
        return pts;
      }

      // the rare cinematic moment for the current type → [kind, durationSeconds]
      const pickRare = (): [string, number] => {
        switch (petType) {
          case "electric": return ["superstrike", 0.85];
          case "fire": return ["plume", 2.6];
          case "water": return ["swell", 3.2];
          case "grass": case "bug": return ["passerby", 4.6];
          case "ghost": case "dark": return ["watcher", 3.4];
          case "psychic": return ["vision", 0.9];
          case "dragon": case "flying": return ["flyover", 3.6];
          case "ice": return ["aurora", 4.6];
          default: return ["shootingstar", 1.4];
        }
      };
      // draw one rare event at progress p∈[0,1] within the viewport (x,y,w2,h2,hz)
      function drawRare(kind: string, p: number, x: number, y: number, w2: number, h2: number, hz: number) {
        const env = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI); // 0→1→0 fade
        const cx = x + w2 / 2;
        if (kind === "superstrike") {
          const a = p < 0.18 ? p / 0.18 : Math.max(0, 1 - (p - 0.18) / 0.82);
          flash.rect(x, y, w2, h2).fill({ color: 0xeaf4ff, alpha: a * 0.55 });
          if (p < 0.4) {
            for (let b = 0; b < 3; b++)
              strokeBolt(genBolt(x + w2 * (0.22 + 0.28 * b + Math.random() * 0.08), y, y + (hz - y) * 0.96, w2 * 0.08), 0.6 + 0.4 * Math.random());
          }
          petLight = Math.max(petLight, a);
        } else if (kind === "plume") {
          const hgt = (hz - y) * 0.55 * env;
          const wd = w2 * 0.13;
          const tip = cx + Math.sin(t * 3) * wd * 0.25;
          rareG.moveTo(cx - wd, hz);
          rareG.quadraticCurveTo(cx - wd * 0.4, hz - hgt * 0.55, tip, hz - hgt);
          rareG.quadraticCurveTo(cx + wd * 0.4, hz - hgt * 0.55, cx + wd, hz);
          rareG.fill({ color: 0xff5a14, alpha: 0.32 * env });
          rareG.moveTo(cx - wd * 0.5, hz);
          rareG.quadraticCurveTo(cx, hz - hgt * 0.7, tip, hz - hgt * 0.82);
          rareG.quadraticCurveTo(cx + wd * 0.5, hz - hgt * 0.7, cx + wd * 0.5, hz);
          rareG.fill({ color: 0xffc25a, alpha: 0.3 * env });
        } else if (kind === "swell") {
          const sx = x - w2 * 0.2 + p * w2 * 1.4;
          const amp = (hz - y) * 0.12 * env;
          rareG.moveTo(x, hz + 4);
          for (let i = 0; i <= 16; i++) {
            const xx = x + (w2 * i) / 16;
            const d = (xx - sx) / (w2 * 0.18);
            rareG.lineTo(xx, hz - amp * Math.exp(-d * d));
          }
          rareG.lineTo(x + w2, hz + 4);
          rareG.fill({ color: lightCol, alpha: 0.12 * env });
          rareG.circle(sx, hz - amp, Math.max(1.5, w2 * 0.01)).fill({ color: 0xffffff, alpha: 0.4 * env });
        } else if (kind === "passerby") {
          const px = x + p * w2;
          const s = (hz - y) * 0.1;
          const a = 0.5 * env;
          const gait = Math.sin(p * 40) * s * 0.25;
          rareG.ellipse(px, hz - s * 0.7, s * 0.85, s * 0.45).fill({ color: 0x0b0b14, alpha: a });
          rareG.ellipse(px + s * 0.7, hz - s * 1.05, s * 0.3, s * 0.32).fill({ color: 0x0b0b14, alpha: a });
          rareG.rect(px - s * 0.5, hz - s * 0.35, s * 0.12, s * 0.4 + gait).fill({ color: 0x0b0b14, alpha: a });
          rareG.rect(px + s * 0.4, hz - s * 0.35, s * 0.12, s * 0.4 - gait).fill({ color: 0x0b0b14, alpha: a });
        } else if (kind === "watcher") {
          const ex = x + w2 * 0.72, ey = y + h2 * 0.34;
          const blink = Math.sin(p * 26) > -0.4 ? 1 : 0.15;
          const a = 0.7 * env * blink;
          rareG.circle(ex, ey, 2.6).fill({ color: 0xff5252, alpha: a });
          rareG.circle(ex + 13, ey, 2.6).fill({ color: 0xff5252, alpha: a });
          rareG.circle(ex, ey, 5).fill({ color: 0xff2a2a, alpha: a * 0.25 });
          rareG.circle(ex + 13, ey, 5).fill({ color: 0xff2a2a, alpha: a * 0.25 });
        } else if (kind === "vision") {
          flash.rect(x, y, w2, h2).fill({ color: 0xb98cff, alpha: 0.22 * env });
          for (let r = 1; r <= 3; r++)
            rareG.circle(cx, y + h2 * 0.45, (hz - y) * 0.5 * p * r * 0.4).stroke({ color: 0xd9c2ff, width: 1.4, alpha: 0.3 * env });
        } else if (kind === "flyover") {
          const fx2 = x + w2 * 1.25 - p * w2 * 1.5;
          const fy = y + h2 * 0.2;
          const a = 0.5 * env;
          const flap = Math.sin(t * 6) * h2 * 0.03;
          rareG.ellipse(fx2, fy, w2 * 0.07, h2 * 0.018).fill({ color: 0x05050a, alpha: a });
          rareG.moveTo(fx2, fy);
          rareG.lineTo(fx2 - w2 * 0.1, fy - h2 * 0.05 + flap);
          rareG.lineTo(fx2 - w2 * 0.03, fy + h2 * 0.01);
          rareG.fill({ color: 0x05050a, alpha: a });
          rareG.moveTo(fx2, fy);
          rareG.lineTo(fx2 + w2 * 0.1, fy - h2 * 0.05 + flap);
          rareG.lineTo(fx2 + w2 * 0.03, fy + h2 * 0.01);
          rareG.fill({ color: 0x05050a, alpha: a });
        } else if (kind === "aurora") {
          for (let bandI = 0; bandI < 3; bandI++) {
            const yy = y + h2 * (0.18 + bandI * 0.07);
            rareG.moveTo(x, yy);
            for (let i = 0; i <= 16; i++)
              rareG.lineTo(x + (w2 * i) / 16, yy + Math.sin((x + (w2 * i) / 16) * 0.02 + t * 0.6 + bandI) * 8);
            rareG.stroke({ color: bandI === 1 ? 0x7affc0 : 0x8ad6ff, width: 6 - bandI, alpha: 0.12 * env });
          }
        } else if (kind === "shootingstar") {
          const sx = x + p * w2;
          const sy = y + h2 * 0.14 + p * h2 * 0.18;
          rareG.moveTo(sx, sy);
          rareG.lineTo(sx - 34, sy - 13);
          rareG.stroke({ color: 0xffffff, width: 2, alpha: env });
          rareG.circle(sx, sy, 2).fill({ color: 0xffffff, alpha: env });
        }
      }
      // order: scene → backdrop → vignette → visitor → shadow → pet → fx/hat → hearts/zzz → bubble
      a.stage.addChild(
        groundRings, groundArcs, scene, platform, galaxy, galaxyMask, vignetteG, rimGlow, visitorSprite, trainer, petShadow, petSep, megaAura, mesh, evoGlow, ball, fxC, hat, hearts, zzz, burst, glass, glassMask, bubbleC
      );


      // backdrop (orb sphere / square card / ground platform / off) — radius driven
      function drawPlatform(br: number) {
        platform.clear();
        if (bgStyle === "orb") {
          platform.circle(0, 0, br).fill({ color: lightCol, alpha: 0.1 });
          platform.circle(0, 0, br * 0.7).fill({ color: lightCol, alpha: 0.08 });
        } else if (bgStyle === "square") {
          platform.roundRect(-br, -br, br * 2, br * 2, 22).fill({ color: lightCol, alpha: 0.1 });
          platform.roundRect(-br * 0.72, -br * 0.72, br * 1.44, br * 1.44, 16).fill({ color: lightCol, alpha: 0.07 });
        } else if (bgStyle === "ground") {
          // ONE flat ground disc at the feet (Classic typebg-ground parity): type-tinted
          // rim + a soft dark contact center so the pet reads as standing ON it — no
          // separate shadow ellipse (that doubling read as "two grounds")
          platform.ellipse(0, 0, br * 1.2, br * 0.34).fill({ color: lightCol, alpha: 0.16 });
          platform.ellipse(0, 0, br * 0.85, br * 0.24).fill({ color: lightCol, alpha: 0.1 });
          platform.ellipse(0, 0, br * 0.5, br * 0.13).fill({ color: 0x000000, alpha: 0.22 });
        }
      }

      // a clean Pokéball for the switch ceremony (arc fills avoid square corners)
      function drawBall(g: Graphics, r: number) {
        g.clear();
        g.moveTo(-r, 0).arc(0, 0, r, Math.PI, 0, true).fill({ color: 0xee4a45 }); // top red
        g.moveTo(-r, 0).arc(0, 0, r, Math.PI, 0, false).fill({ color: 0xf4f4f4 }); // bottom white
        g.rect(-r, -r * 0.15, r * 2, r * 0.3).fill({ color: 0x202024 }); // band
        g.circle(0, 0, r * 0.32).fill({ color: 0x202024 });
        g.circle(0, 0, r * 0.2).fill({ color: 0xf4f4f4 });
      }
      // a small party hat (cone + pompom), base centered on the head top
      function drawHat(g: Graphics, s: number) {
        g.clear();
        g.moveTo(-s * 0.5, 0).lineTo(s * 0.5, 0).lineTo(0, -s * 1.15).fill({ color: 0xff5aa0 });
        g.moveTo(-s * 0.34, -s * 0.28).lineTo(s * 0.22, -s * 0.34).stroke({ color: 0xffe08a, width: 2 });
        g.moveTo(-s * 0.18, -s * 0.62).lineTo(s * 0.12, -s * 0.66).stroke({ color: 0xffe08a, width: 2 });
        g.circle(0, -s * 1.15, s * 0.16).fill({ color: 0xffe08a }); // pompom
      }
      // lazily load a wild-visitor sprite when one appears (separate from the pet)
      const loadVisitor = async (id: number, sh: boolean) => {
        const img = (await loadImg(spriteUrl(id, sh))) ?? (await loadImg(fallbackUrl(id, sh)));
        if (!img || destroyed) return;
        try {
          const vt = Texture.from(img);
          if (vt.source) vt.source.scaleMode = "nearest";
          visitorSprite.texture = vt;
          visitorTexId = id;
        } catch { /* ignore a bad visitor sprite */ }
      };
      // a burst of energy motes for an attack (radial for status, directional otherwise)
      const sparkList: { g: Graphics; vx: number; vy: number; life: number }[] = [];
      function spawnSparks(color: string, kind: string, dir: number) {
        const col = hexNum(color);
        const radial = kind === "status" || kind === "burst";
        const n = radial ? 14 : 16;
        for (let i = 0; i < n; i++) {
          const g = new Graphics().circle(0, 0, 1.5 + Math.random() * 3).fill({ color: col, alpha: 0.95 });
          const ang = radial
            ? Math.random() * Math.PI * 2
            : (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.1;
          const sp = 70 + Math.random() * 150;
          sparks.addChild(g);
          sparkList.push({ g, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30, life: 0.45 + Math.random() * 0.45 });
        }
      }

      // ════ MOTION STATE ════
      const posX = new Spring(W() / 2, 120, 16);
      const posY = new Spring(groundY(), 150, 14);
      const lean = new Spring(0, 90, 12);
      const squash = new Spring(0, 220, 16);
      let jiggle = 0;
      let petEnergy = 1; // smoothed environmental coupling parameter
      let hoverTarget = 0; // 1 while the pointer hovers the creature, else 0
      let hoverE = 0; // smoothed hover (eases toward hoverTarget) → stokes the mega atmosphere
      let hopBurstT = 0; // tiny burst when jumping
      let prevBreakthrough = false;
      let mode: "idle" | "drag" | "pet" = "idle";
      let downAt: { x: number; y: number; t: number } | null = null;
      let lastPt: { x: number; y: number } | null = null;
      let strokeDist = 0;
      let petFrames = 0;
      let airborne = false;
      let nextHop = 3 + Math.random() * 5;
      let prevState = petState; // brain bridge: detect happy/sleep transitions
      let prevBubble = ""; // redraw the bubble bg only when the text changes
      let bubbleH = 0; // current bubble height (for on-screen clamping)
      let petPxRef = size; // rendered pet height (shrinks to fit the globe)
      // ── FX bookkeeping (rising-edge detection for the bridged brain signals) ──
      let prevAttacking = false;
      let atkT = 0; // seconds into the current attack
      let prevReactionN = 0; // v3 reaction rising-edge
      let rxPhaseT = 0; // ghostly "phase" alpha-dip timer (seconds)
      let prevSwitch = "none"; // last switchFx value
      let ceremonyT = 0; // seconds into the current ceremony phase
      let prevVisitorId: number | null = null;
      let evoT = 0; // evolution flicker clock
      let prevEating = false;
      let face = -1; // pet facing: -1 default (sprite faces left), +1 flipped
      // ── ambient FX state ──
      let boltT = 3 + Math.random() * 5; // seconds to the next lightning strike
      let strikeT = 0; // remaining strike-visible time
      let boltPts: number[] = [];
      let boltBranch: number[] = [];
      let petLight = 0; // momentary scene→pet illumination (lightning lights the body)
      const flames = Array.from({ length: 5 }, () => ({
        x: Math.random(), ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 0.7, h: 0.55 + Math.random() * 0.5
      }));
      // ── rare-event system: unexpected, memorable, per-type cinematic one-shots ──
      // first rare moment: electric (superstrike) ~1.5–3 min, other types 1.5–4 min
      let rareT = petType === "electric" ? 90 + Math.random() * 90 : 90 + Math.random() * 150;
      let rareKind = "";
      let rareProg = 0;
      let rareDur = 1;
      // ── music-awareness state ──
      let prevAudioBeat = 0;
      let beatT = 0; // remaining beat-pulse visibility
      let beatS = 0; // strength of the current beat pulse
      let beatStrike = false; // a strong beat asked for a GLOBE lightning strike (stays music-reactive)
      let groundErupt = false; // a real MUSIC drop armed the rare ground eruption (separate, stricter)
      let superCd = 0;        // cooldown between ground eruptions so they stay special

      const hop = (v = 300) => posY.nudge(-v);
      function spawnHeart() {
        const t = new Text({ text: "♥", style: { fill: 0xff8fb0, fontSize: 16 } });
        t.anchor.set(0.5);
        t.x = posX.value + (Math.random() * 40 - 20);
        t.y = posY.value - petPxRef * 0.6;
        (t as unknown as { _life: number })._life = 1;
        hearts.addChild(t);
      }

      mesh.on("pointerdown", (e) => {
        downAt = { x: e.global.x, y: e.global.y, t: performance.now() };
        lastPt = { x: e.global.x, y: e.global.y };
        strokeDist = 0;
        mesh.cursor = "grabbing";
      });
      a.stage.eventMode = "static";
      a.stage.hitArea = a.screen;
      // empty-space press → drag the window (parity with Classic's draglayer)
      a.stage.on("pointerdown", (e) => {
        if (e.target !== mesh) onBackgroundDown?.();
      });
      a.stage.on("pointermove", (e) => {
        const gx = e.global.x;
        const gy = e.global.y;
        if (mode !== "drag") lean.target = Math.max(-0.16, Math.min(0.16, (gx - posX.value) / a.screen.width));
        // hover = pointer near the creature's body (a touch wider than the petting box) → stokes mega FX
        hoverTarget = mode !== "drag" && Math.abs(gx - posX.value) < petPxRef * 0.75 && Math.abs(gy - (posY.value - petPxRef * 0.45)) < petPxRef * 0.7 ? 1 : 0;
        if (downAt && Math.hypot(gx - downAt.x, gy - downAt.y) > 6) mode = "drag";
        if (mode === "drag") {
          posX.target = gx;
          posY.target = gy;
        } else if (lastPt) {
          const within =
            Math.abs(gx - posX.value) < petPxRef * 0.5 && Math.abs(gy - (posY.value - petPxRef * 0.4)) < petPxRef * 0.5;
          if (within) {
            strokeDist += Math.hypot(gx - lastPt.x, gy - lastPt.y);
            if (strokeDist > 46) {
              strokeDist = 0;
              spawnHeart();
              mode = "pet";
              petFrames = 30;
              squash.nudge(1.6);
              jiggle = Math.min(14, jiggle + 4);
              onStroke?.(); // shared brain: affection / drift / lines (parity)
            }
          }
        }
        lastPt = { x: gx, y: gy };
      });
      const release = (tap: boolean) => {
        if (tap && downAt && mode !== "drag") {
          const moved = lastPt ? Math.hypot(lastPt.x - downAt.x, lastPt.y - downAt.y) : 0;
          if (moved < 6 && performance.now() - downAt.t < 400) {
            hop(360);
            jiggle = Math.min(14, jiggle + 5);
            onTap?.(); // shared brain: same tap reaction as Classic
          }
        }
        if (mode === "drag") {
          posX.target = W() / 2;
          posY.target = groundY();
          jiggle = Math.min(14, jiggle + 6);
        }
        mode = "idle";
        downAt = null;
        lastPt = null;
        mesh.cursor = "grab";
      };
      a.stage.on("pointerup", () => release(true));
      a.stage.on("pointerupoutside", () => release(false));
      a.stage.on("pointerleave", () => { hoverTarget = 0; }); // pointer left the canvas → drop hover

      const layout = () => {
        paintBack();
        orb.x = W() * 0.74;
        orb.y = H() * 0.2;
        lantern.x = W() * 0.14;
        lantern.y = groundY() - 6;
        if (mode !== "drag") {
          posX.target = W() / 2;
          posY.target = groundY();
        }
      };
      layout();
      const ro = new ResizeObserver(layout);
      ro.observe(host);

      let t = 0;
      let prevDexId = dexId;
      let prevShiny = shiny;
      let prevSpriteOverride = spriteOverride; // mega/form swap → reload the sprite
      
      // §8.4 — throttle the heavy globe FX (galaxy ~3500 + ring stars ~1500 sprites) to ~30fps
      // rather than every animation frame. Slow orbital/twinkle motion is imperceptible at 30fps,
      // but it roughly halves the dominant per-frame sprite work for an always-on desktop widget.
      // (DPR/resolution is intentionally NOT capped here — that resizes the transparent WebGL
      // backing store and risks re-triggering the WebView2 "washed globe" recomposite issue.)
      let heavyAcc = 0;
      const HEAVY_STEP = 1 / 30;
      const tick = (ticker: { deltaMS: number }) => {
        if (dexId !== prevDexId || shiny !== prevShiny || spriteOverride !== prevSpriteOverride) {
          prevDexId = dexId;
          prevShiny = shiny;
          prevSpriteOverride = spriteOverride;
          void reloadPet(dexId, shiny);
        }
      
        const dt = Math.min(0.05, ticker.deltaMS / 1000);
        t += dt;
        // §8.4: gate the heavy galaxy/ring sprite loops to ~30fps; carry the accumulated dt so
        // angular motion advances at the correct speed even though it updates on fewer frames.
        heavyAcc += dt;
        let heavyDt = 0;
        if (heavyAcc >= HEAVY_STEP) { heavyDt = heavyAcc; heavyAcc = 0; }
        const heavyStep = heavyDt > 0;
        const w = W();
        const h = H();
        const F = fx ?? NO_FX;
        const sleeping = petState === "sleeping";

        // music: a beat → a WEIGHTED tiny reaction (most pass as influence; some delight)
        if (audioBeat !== prevAudioBeat) {
          prevAudioBeat = audioBeat;
          const s = audioStrength;
          const busy = F.switchFx !== "none" || F.evoActive || F.attacking;
          if (!busy && !sleeping && (Math.random() < 0.08 + s * 0.5 || s > 0.85)) {
            squash.nudge(0.5 + s * 1.6); // a little body bounce on the beat
            beatT = 0.32;
            beatS = s;
            petLight = Math.max(petLight, 0.2 + 0.4 * s); // the beat lights the body (every type now)
            if (petType === "electric" && s > 0.82) beatStrike = true; // electric: a GLOBE strike (its signature)
            // A real MUSICAL DROP: a very strong onset + sustained energy + CONFIRMED music (regular
            // onsets + bass, not speech — audioMusical) + a long cooldown. Now fires for EVERY type,
            // flavoured by lightCol (the ground discharge is already type-tinted), not just electric.
            if (s > 0.9 && audioEnergy > 0.45 && audioMusical > 0.5 && superCd <= 0) {
              groundErupt = true; // globe ground discharge (type-tinted, when the globe is on)
              superCd = 16 + Math.random() * 10; // ≥16s between drops
              squash.nudge(2.2); // a big body pop on the drop
              petLight = Math.max(petLight, 0.6);
              spawnSparks("#" + lightCol.toString(16).padStart(6, "0"), "burst", 1); // type-coloured burst
            }
          }
        }
        beatT = Math.max(0, beatT - dt);
        superCd = Math.max(0, superCd - dt);

        // replay the Showdown GIF by cycling decoded frames onto the canvas texture
        if (frames.length > 1 && petCtx) {
          gifAcc += dt;
          let advanced = false;
          let guard = 0;
          while (gifAcc >= (frames[frameIdx].dur || 0.08) && guard++ < frames.length) {
            gifAcc -= frames[frameIdx].dur || 0.08;
            frameIdx = (frameIdx + 1) % frames.length;
            advanced = true;
          }
          if (advanced) {
            petCtx.clearRect(0, 0, petCanvas.width, petCanvas.height);
            petCtx.drawImage(frames[frameIdx].bmp, 0, 0);
            tex.source.update();
          }
        }

        // ── viewport: full widget, OR a globe (habitat SHAPE, not the backdrop) ──
        const globe = habitat && habitatShape !== "full";
        const gR = Math.min(w, h) * 0.42;
        const gcx = w / 2;
        // Anchor the globe's BOTTOM (not its center) to a fixed fraction of height.
        // gR follows min(w,h); when the box is dragged taller-than-wide the globe gets
        // width-limited, and a height-based center (0.46h) let its bottom — and the ground
        // shelf riding on it — drift UPWARD. Pinning the bottom keeps the shelf locked low
        // at every aspect. Identical to h*0.46 whenever min(w,h) === h (the normal case).
        const gcy = h * 0.88 - gR;
        const vpx = globe ? gcx - gR : 0;
        const vpy = globe ? gcy - gR : 0;
        const vpw = globe ? gR * 2 : w;
        const vph = globe ? gR * 2 : h;
        const HZ = vpy + vph * (globe ? 0.6 : 0.62); // horizon
        const vpBottom = vpy + vph;
        const skyH = HZ - vpy;

        // pet render scale: full screen → fixed size; globe → shrink to fit the sphere
        // (clamp height to the room above the shoreline AND width to the sphere — keeps the head in)
        // size is read live so the scale slider resizes the Alive pet too (parity)
        const curScale = globe ? Math.min((gR * 1.1) / ph, (gR * 1.7) / pw) : size / Math.max(pw, ph);
        const petPx = curScale * ph; // rendered pet height (drives every vertical offset)
        petPxRef = petPx;

        // opacity · biome visibility · translucency
        a.stage.alpha = opacity;
        scene.visible = habitat;
        // Chapter Access soft pause: ease the habitat down (~0.45×), pet untouched.
        dimLerp += ((dimmed ? 1 : 0) - dimLerp) * 0.06;
        const dimMul = 1 - 0.55 * dimLerp;
        // globe = lightly glassy; full landscape solid. Pet is NOT in `scene` so it
        // stays fully opaque. Brightness is mostly the gradient lift `L` + vignette below.
        scene.alpha = (globe ? 0.78 : 0.9) * dimMul;

        // Founder's Mark: refresh on biome switch, place (low in the globe / bottom-left of a
        // full vista), and reveal very faintly after ~12s — discovered, not announced.
        if (founderSig !== biome.scene) {
          founderSig = biome.scene;
          founderText.text = founderMark(biome.scene);
          founderText.style.fill = lightCol;
        }
        founderText.visible = habitat;
        founderText.anchor.set(globe ? 0.5 : 0, globe ? 0.5 : 1);
        founderText.position.set(globe ? gcx : vpx + 9, globe ? gcy + gR * 0.62 : vpBottom - 8);
        founderText.alpha += ((habitat && t > 12 ? 0.1 : 0) - founderText.alpha) * 0.03;

        // backdrop. SPECIAL: globe habitat + ground bg → a ground SHELF UNDER the sphere
        // (premium "snow-globe resting on a surface"). Otherwise the pad is hidden under
        // a habitat (avoids a double-bubble).
        const shelf = globe && bgStyle === "ground";
        platform.visible = shelf || (bgStyle !== "off" && !habitat);
        platform.blendMode = shelf ? "add" : "normal";
        // The rotating starfield/nebula is part of the GLOBE's interior, not the external ground
        // pad — so it stays even when the backdrop (ground) is toggled off. (Was locked to `shelf`.)
        galaxy.visible = globe;
        // The energy ring plane IS the globe's ground; show it whenever the sphere is up and the
        // backdrop isn't explicitly OFF (off = clean float, just globe + interior stars).
        const ringsOn = globe && bgStyle !== "off";
        groundRings.visible = ringsOn;
        groundArcs.visible = ringsOn;
        if (globe) {
          // rotating galaxy floor inside the sphere — retint only when the ground colour changes,
          // then just move/flatten/spin the container (resize- and reload-proof).
          if (galaxyLightSig !== lightCol) { galaxyLightSig = lightCol; drawGalaxy(); }

          // gal = bowl container scale AND star-size normaliser (rendered diameter = 3px × p.size)
          // At y = gcy + 0.62·gR the sphere is 0.785·gR wide; 0.72·gR puts the rim at ~92% → boundary
          const gal = gR * 0.72;

          if (heavyStep) for (const p of galaxyP) {
            p.angle += p.speed * heavyDt;
            const ca   = Math.cos(p.angle);
            p.sprite.x = ca * p.radius * 1.25;                        // vessel ASPECT
            p.sprite.y = (1 - p.depth) * 0.40 - p.depth * 0.30 * ca * ca; // vessel RISE

            // bright stars (size > 0.35) get a gentle twinkle; tiny ones flicker subtly
            const twinkle = p.size > 0.35
              ? 0.18 * Math.sin(t * (3.5 + p.wobble * 2) + p.wobble * 6)
              : 0.06 * Math.sin(t * (1.8 + p.wobble) + p.wobble * 4);
            p.sprite.alpha = Math.max(0, Math.min(1, p.baseAlpha + twinkle));

            p.sprite.scale.set(p.size / gal); // rendered px = 3 × p.size (texture diameter = 3px)
          }

          // rim at 62% down the sphere, wide enough (0.72·gR) to sit on the sphere boundary
          galaxy.position.set(gcx, gcy + gR * 0.62);
          galaxy.scale.set(gal, gal);

          // container rotations are 0 — each star's angle drives its own motion
          galaxyBack.rotation  = 0;
          galaxyMid.rotation   = 0;
          galaxyFront.rotation = 0;

          // ── Energy Ring Ecosystem ────────────────────────────────────────
          // Stars orbiting the base in concentric elliptic rings + occasional energy arcs. Front
          // half (toward the viewer) is bright; the back half fades as it passes behind the sphere
          // (rings live at the BACK of the z-order, so the globe overlays it). dimMul folds in the
          // chapter-pause so the floor dims with the habitat.
          if (ringsOn) {
            if (!ringsBuilt) buildGroundRings();
            const cx = gcx;
            const cy = gcy + gR;          // contact line — the plane the globe rests on
            const ASPECT = 0.3;           // flatten the orbit into a ground plane (perspective)
            const breath = (0.85 + 0.15 * Math.sin(t * 1.5)) * dimMul;
            // expose the plane params so a globe strike (in the lightning block below) can fire a chain
            gpCx = cx; gpCy = cy; gpR = gR;
            ringFlash *= Math.exp(-dt / 0.18); // strike flash fades fast
            if (ringSig !== lightCol) {   // retint the whole field when the type colour changes
              ringSig = lightCol;
              for (const s of ringStars) s.sprite.tint = lerpCol(lightCol, 0xffffff, s.mix);
            }
            if (heavyStep) for (const s of ringStars) {
              s.ang += s.speed * heavyDt;
              const sa = Math.sin(s.ang), R = s.ringR * gR;
              const front = sa * 0.5 + 0.5;             // 0 behind the globe → 1 toward the viewer
              s.sprite.x = cx + Math.cos(s.ang) * R;
              s.sprite.y = cy + sa * R * ASPECT;
              const tw = 0.75 + 0.25 * Math.sin(t * 2.5 + s.ang * 3);
              // a strike flashes the whole field (ringFlash), brightest toward the viewer
              s.sprite.alpha = s.baseA * (0.16 + 0.84 * front) * breath * tw + ringFlash * (0.3 + 0.7 * front);
              s.sprite.scale.set(s.sz * (0.55 + 0.6 * front)); // nearer stars read larger
            }
            // ambient chain lightning. Electric ground is livelier (shorter gap); other types calmer.
            // Bolt SIZE/IMPACT scales with the species' power ("level") — small mon = small bolts.
            arcT -= dt;
            if (arcT <= 0) {
              arcT = petType === "electric" ? 12 + Math.random() * 9 : 26 + Math.random() * 16;
              spawnGroundChain(0.8 + petPower * 0.7);
            }
            // a real MUSIC drop (armed above, cooldown-gated) → the ground ERUPTS: full-field flash +
            // a couple of long chains, all scaled up by the pet's power. Rare → keeps its impact.
            if (groundErupt) {
              groundErupt = false;
              ringFlash = Math.max(ringFlash, 0.9 + petPower * 0.5);
              spawnGroundChain(1.7 + petPower * 1.1);
              spawnGroundChain(1.3 + petPower * 0.8);
            }
            groundArcs.clear();
            for (let k = liveArcs.length - 1; k >= 0; k--) {
              const arc = liveArcs[k];
              arc.life -= dt;
              if (arc.life <= 0) { liveArcs.splice(k, 1); continue; }
              const f = arc.life / arc.max;
              const p = arc.pow;
              const trace = () => {
                groundArcs.moveTo(arc.pts[0], arc.pts[1]);
                for (let j = 2; j < arc.pts.length; j += 2) groundArcs.lineTo(arc.pts[j], arc.pts[j + 1]);
              };
              // wide coloured glow → mid → thin white-hot core. Stronger bolts (higher pow) read thicker/brighter.
              trace();
              groundArcs.stroke({ color: lerpCol(lightCol, 0xffffff, 0.2), width: 5 * p, alpha: Math.min(1, 0.4 * f * breath * p) });
              trace();
              groundArcs.stroke({ color: lerpCol(lightCol, 0xffffff, 0.6), width: 2.4 * p, alpha: Math.min(1, 0.8 * f * breath * p) });
              trace();
              groundArcs.stroke({ color: 0xffffff, width: 1.1 * Math.min(p, 1.6), alpha: Math.min(1, 0.98 * f * breath) });
            }
          }
        }
        if (shelf) {
          // Tuck the ground into the sphere's BASE so it stays LOW — the layout that read well
          // when enlarged. It sits 0.15·gR inside the bottom edge; because gcy is bottom-anchored
          // (sphereBottom is a constant 0.88·h), this stays low at EVERY size instead of riding
          // up when the box is small.
          const sw = gR;
          const sphereBottom = gcy + gR;        // sphere's bottom edge (bottom-anchored at 0.88h)
          const sy = sphereBottom - gR * 0.15;  // tucked just inside the base
          const gl = 0.85 + 0.15 * Math.sin(t * 1.5);
          platform.clear();
          platform.x = 0;
          platform.y = 0;
          // faint grounding glow only — the rotating galaxy is the main visual, so the platform
          // no longer paints a bright bullseye that drowns it out.
          platform.ellipse(gcx, sy, sw * 0.86, gR * 0.16).fill({ color: lightCol, alpha: 0.06 });
          platform.ellipse(gcx, sy, sw * 0.58, gR * 0.11).fill({ color: lightCol, alpha: 0.09 });
          platform.ellipse(gcx, sy, sw * 0.34, gR * 0.07).fill({ color: lightCol, alpha: 0.11 * gl });
        } else if (bgStyle === "ground") {
          const br = petPx * 0.6;
          drawPlatform(br);
          platform.x = posX.value;
          // keep the whole disc inside the window: its lower rim is br*0.34 below centre,
          // so never let the centre drop past (window bottom − that rim − a small margin).
          platform.y = Math.min(groundY() + 4, H() - 6 - br * 0.34);
        } else {
          // orb/square centered on the VISIBLE content box → equal top/bottom gap
          drawPlatform(0.5 * Math.hypot(contentW, contentH) * curScale * 1.08);
          platform.x = posX.value + (visCX - pcx) * curScale;
          platform.y = posY.value - (maxY - visCY) * curScale;
        }
        // ground bg bakes its own contact shadow into the disc → no separate shadow there
        petShadow.visible = shelf || ((bgStyle === "orb" || bgStyle === "square" || habitat) && bgStyle !== "ground");

        // clip the biome to the habitat SHAPE — full vista INSIDE the globe
        biomeMask.clear();
        vignetteG.clear();
        rimGlow.clear();
        if (globe) {
          scene.mask = biomeMask;
          const rimA = 0.35 + 0.12 * Math.sin(t * 1.1); // brightness kept; pulse calmer (subconscious)
          if (habitatShape === "square") {
            biomeMask.roundRect(gcx - gR, gcy - gR, gR * 2, gR * 2, 22).fill(0xffffff);
            for (let i = 1; i <= 12; i++) {
              vignetteG.roundRect(gcx - gR, gcy - gR, gR * 2, gR * 2, 22).stroke({ color: 0x0f0b14, alpha: 0.045 - i * 0.0035, width: i * 16, alignment: 1 });
            }
            rimGlow.roundRect(gcx - gR, gcy - gR, gR * 2, gR * 2, 22).stroke({ color: lightCol, width: 3, alpha: rimA });
          } else {
            biomeMask.circle(gcx, gcy, gR).fill(0xffffff);
            for (let i = 1; i <= 12; i++) {
              vignetteG.circle(gcx, gcy, gR).stroke({ color: 0x0f0b14, alpha: 0.045 - i * 0.0035, width: i * 16, alignment: 1 });
            }
            rimGlow.circle(gcx, gcy, gR).stroke({ color: lightCol, width: 3, alpha: rimA });
          }
        } else {
          scene.mask = null;
        }
        vignetteG.visible = globe;
        rimGlow.visible = globe;

        // Warm atmospheric spill rising from the globe's base — bleeds the inner habitat floor
        // INTO the external shelf rings (shared lightCol + additive light system) and softens the
        // hard horizon so the floor reads as a glowing plane, not a stage platform. Lives in `scene`
        // → clipped to the sphere by biomeMask. Brightest at the base (≈ ring glow), fading upward.
        floorGlow.clear();
        if (globe) {
          const baseY = gcy + gR;        // sphere bottom — where the shelf rings sit
          const topY  = HZ - gR * 0.12;  // just ABOVE the horizon so the seam glows across, not cuts
          const span  = baseY - topY;
          const fgl   = 0.85 + 0.15 * Math.sin(t * 1.5); // same slow breath as the rings
          const STEPS = 8;
          for (let i = 0; i < STEPS; i++) {
            const f  = i / (STEPS - 1);            // 0 at base → 1 near horizon
            const yy = baseY - f * span;
            const rx = gR * (0.95 - 0.34 * f);     // widest at the base, narrowing upward
            const ry = gR * (0.34 - 0.20 * f);
            const a  = (0.065 - 0.060 * f) * fgl;  // brightest at base, fading up over the seam
            floorGlow.ellipse(gcx, yy, rx, ry).fill({ color: lightCol, alpha: Math.max(0, a) });
          }
        }

        // clip galaxy to sphere so its haze/glow never bleeds outside the globe boundary
        galaxyMask.clear();
        if (globe) {
          if (habitatShape === "square") {
            galaxyMask.roundRect(gcx - gR, gcy - gR, gR * 2, gR * 2, 22).fill(0xffffff);
          } else {
            galaxyMask.circle(gcx, gcy, gR).fill(0xffffff);
          }
        }
        galaxy.mask = globe ? galaxyMask : null;

        // ── glass dome (globe ONLY) ── a curved specular highlight + a slow drifting
        // sheen + an occasional diagonal glint, so the sphere reads as real glass that's
        // gently turning rather than a flat picture with a pet pasted inside. Clipped to
        // the sphere; additive so it only ever brightens.
        glass.clear();
        glass.visible = globe;
        glass.mask = globe ? glassMask : null;
        glassMask.clear();
        if (globe) {
          glassMask.circle(gcx, gcy, gR).fill(0xffffff);
          // curved-glass specular highlight, upper-left — static, sells the 3D dome
          glass.ellipse(gcx - gR * 0.33, gcy - gR * 0.40, gR * 0.36, gR * 0.22).fill({ color: 0xffffff, alpha: 0.05 });
          glass.ellipse(gcx - gR * 0.30, gcy - gR * 0.45, gR * 0.17, gR * 0.10).fill({ color: 0xffffff, alpha: 0.07 });
          // a faint vertical sheen drifting across (~26s) → the glass slowly rotating.
          // It wraps just off the edge so the loop never visibly jumps.
          const turn = ((t * 0.038) % 1) * 2 - 1; // -1 → 1
          glass.ellipse(gcx + turn * gR * 1.05, gcy, gR * 0.12, gR * 0.96).fill({ color: lightCol, alpha: 0.05 });
          // occasional bright diagonal glint streaking across the dome (~every 13s)
          // very occasional slow diagonal glint (~once per minute)
          const glintCycle = 60; // seconds
          const glintDuration = 10.0; // glint lasts 5s (slow sweep)

          const gp = (t % glintCycle) / glintCycle;

          if (gp < glintDuration / glintCycle) {
            const k = gp / (glintDuration / glintCycle); // 0 → 1 over 5s

            // slower, gentler sweep across the dome
            const cxg = gcx + (k * 2 - 1) * gR * 1.05;

            // softer fade in/out
            const a = Math.sin(k * Math.PI) * 0.16;

            const sl = gR * 0.28; // diagonal slant

            glass.poly([
              cxg - gR * 0.05 + sl, gcy - gR,
              cxg + gR * 0.05 + sl, gcy - gR,
              cxg + gR * 0.05 - sl, gcy + gR,
              cxg - gR * 0.05 - sl, gcy + gR,
            ]).fill({
              color: 0xffffff,
              alpha: a
            });
          }
        }

        // sky + ground gradient inside the viewport (repaint on change)
        const sig = `${vpx | 0},${vpy | 0},${vpw | 0},${vph | 0}`;
        if (sig !== vpSig) {
          vpSig = sig;
          back.clear();
          // lift the globe interior toward light so the sphere isn't murky/dark
          const L = globe ? 0.28 : 0;
          band(vpx, vpy, vpw, HZ - vpy, lerpCol(sky0, 0xffffff, L), lerpCol(sky1, 0xffffff, L), 14);
          band(vpx, HZ, vpw, vpBottom - HZ, lerpCol(grd0, 0xffffff, L), lerpCol(grd1, 0xffffff, L), 8);
        }

        // light orb (moon/sun) within the viewport, parallax
        orb.x = vpx + vpw * 0.74 + Math.sin(t * 0.18) * 6;
        orb.y = vpy + vph * 0.2 + Math.sin(t * 0.12) * 3;

        // ── environmental coupling & inertia ──
        let targetEnergy = (sleeping ? 0.2 : 1) + (petState === "happy" ? 0.8 : 0) + Math.min(1.5, jiggle * 0.15 + Math.abs(squash.value) * 0.05);
        if (flowContext === "focus") targetEnergy *= 0.5; // deeply calm
        else if (flowContext === "waiting") targetEnergy *= 0.7; // slower watch
        else if (flowContext === "friction") targetEnergy *= 1.15; // slightly warmer/more active
        
        if (fx.breakthrough && !prevBreakthrough) {
          hopBurstT = 1.0;
          petEnergy = 2.5; // immediate spike
        }
        prevBreakthrough = fx.breakthrough;

        if (targetEnergy - petEnergy > 0.5) hopBurstT = 0.5; // Trigger tiny response burst
        hopBurstT = Math.max(0, hopBurstT - dt);
        petEnergy += (targetEnergy - petEnergy) * (dt / 0.4); // momentum / delayed response
        hoverE += (hoverTarget - hoverE) * (dt / 0.18); // ease toward hover state (~180ms)
        // normalized breathing sine (-1 to +1) that strictly matches the pet's lung speed
        const petBreath = Math.sin(t * (sleeping ? 1.0 : 1.7));
        const envBreath = (petBreath * 0.45 + 0.5) * petEnergy; // pulse amp trimmed ~10% → subconscious, not a visible effect

        ambient.clear();
        flash.clear();
        rareG.clear();
        hazeG.clear();
        // +air: faint volumetric band lifting off the horizon → depth, not opacity
        if (globe) {
          hazeG.rect(vpx, HZ - vph * 0.22, vpw, vph * 0.34).fill({ color: lightCol, alpha: 0.028 });
          hazeG.rect(vpx, HZ - vph * 0.1, vpw, vph * 0.2).fill({ color: lightCol, alpha: 0.022 });
        }
        petLight *= Math.exp(-dt / 0.13); // illumination from a strike/beat fades fast

        // creature-first: a soft dark halo behind the pet so the environment recedes and
        // the silhouette reads cleanly (subtle; only when a habitat competes for attention)
        petSep.clear();
        petSep.visible = habitat;
        if (habitat) {
          petSep.ellipse(posX.value, posY.value - petPx * 0.45, petPx * 0.46, petPx * 0.6).fill({ color: 0x05040a, alpha: 0.16 });
        }

        // mega/special-form FIRE aura — rising flame tongues + hot core + embers, tinted by the
        // form's element via lightCol (blue for Charizard X's dragon, orange for a fire mega, …).
        // Additive, so the layers stack into living fire. Replaces the old flat ellipse glow —
        // signals "this is more than a recolour" even when the form sprite is static.
        // fire-typed forms borrow the richer hearth-flame orange; other elements keep their light
        // tint (Charizard X's dragon → blue). Embers ride a hot, near-white tint of that colour.
        // Hoisted to the tick scope so the mega room-atmosphere below shares the same fire colour.
        const flameCol = MEGA_FLAME[petType] ?? lightCol;
        const emberCol = lerpCol(flameCol, 0xffffff, 0.55);
        megaAura.clear();
        megaAura.visible = mega;
        if (mega) {
          const ax = posX.value;
          const baseY = posY.value + petPx * 0.06; // flame roots near the feet
          const baseW = petPx * 0.46; // fire spreads to roughly the body's width
          const pul = (0.85 + 0.15 * Math.sin(t * 3)) * (1 + hoverE * 0.4); // hover stokes the fire

          // hot core bloom behind the body — the replacement for the flat ellipse "disc"
          megaAura.ellipse(ax, posY.value - petPx * 0.4, petPx * 0.48 * pul, petPx * 0.7 * pul).fill({ color: flameCol, alpha: 0.1 * pul });
          megaAura.circle(ax, posY.value - petPx * 0.3, petPx * 0.2 * pul).fill({ color: 0xffffff, alpha: 0.05 });

          // one smooth flame tongue (teardrop): base width w, height h, swaying tip
          const tongue = (x0: number, w: number, h: number, sway: number, col: number, a: number) => {
            megaAura.moveTo(x0 - w, baseY);
            megaAura.quadraticCurveTo(x0 - w * 0.5, baseY - h * 0.55, x0 + sway, baseY - h);
            megaAura.quadraticCurveTo(x0 + w * 0.5, baseY - h * 0.55, x0 + w, baseY);
            megaAura.closePath();
            megaAura.fill({ color: col, alpha: a });
          };

          // tongues licking around the silhouette — taller in the middle, shorter at the edges, flickering
          const N = 11;
          for (let i = 0; i < N; i++) {
            const u = i / (N - 1);
            const x0 = ax + (u - 0.5) * 2 * baseW;
            const seed = i * 1.7;
            const edge = 1 - Math.abs(u - 0.5) * 1.05; // ~0 at the edges → 1 at the centre
            const flick = 0.55 + 0.45 * Math.sin(t * 7 + seed * 2.3);
            const h = petPx * (0.42 + 0.78 * edge) * flick * pul; // centre licks up past the head
            const w = petPx * 0.085 * (0.7 + 0.6 * edge);
            const sway = Math.sin(t * 2.6 + seed) * petPx * 0.07;
            tongue(x0, w, h, sway, flameCol, 0.16); // outer flame (rich fire tint)
            tongue(x0, w * 0.5, h * 0.62, sway * 0.6, 0xffffff, 0.1); // white-hot inner core
          }

          // embers peeling off the top, drifting up and fading
          for (let i = 0; i < 10; i++) {
            const ph = (t * 0.5 + i * 0.1) % 1;
            const ex = ax + Math.sin(i * 2.1 + t * 1.3) * baseW * (0.4 + ph * 0.7);
            const ey = baseY - ph * petPx * 1.15;
            megaAura.circle(ex, ey, 1.4 * (1 - ph)).fill({ color: emberCol, alpha: 0.9 * (1 - ph) });
          }
        }

        // water-only: reflection + rolling waves
        if (hasWater) {
          reflect.clear();
          for (let i = 0; i < 10; i++) {
            const yy = HZ + i * ((vpBottom - HZ) / 10);
            const sway = Math.sin(t * 2 + i * 0.7) * (3 + i);
            const wdt = 26 - i * 1.6 + Math.sin(t * 3 + i) * 3;
            reflect.ellipse(orb.x + sway, yy, Math.max(3, wdt), 2).fill({ color: lightCol, alpha: 0.16 - i * 0.012 });
          }
          waves.clear();
          for (let r = 0; r < 6; r++) {
            const yy = HZ + 6 + r * ((vpBottom - HZ - 6) / 6);
            waves.moveTo(vpx, yy);
            const distToPet = Math.max(0, 1 - Math.abs(yy - (vpBottom - vph * 0.2)) / (vph * 0.3));
            const localTurbulence = distToPet * (jiggle * 1.5 + Math.sin(t * 3.4) * envBreath * 0.5);
            for (let x = vpx; x <= vpx + vpw; x += 26) waves.lineTo(x, yy + Math.sin(x * 0.045 + t * 1.6 + r * 0.9 + localTurbulence) * (1.6 + r * 0.5 + distToPet * Math.abs(jiggle)));
            waves.stroke({ color: lightCol, width: 1, alpha: Math.max(0.04, 0.13 - r * 0.015) });
          }
        }

        // particles within the viewport
        for (const f of P) {
          const distToPet = Math.max(0, 1 - Math.abs(vpx + f.bx * vpw - posX.value) / 100);
          const surgeX = distToPet * jiggle * 0.3;
          const surgeY = distToPet * Math.abs(jiggle) * 0.2;

          if (pkind === "snow") {
            f.prog = (f.prog + dt * 0.08 * f.sp) % 1;
            f.g.x = vpx + f.bx * vpw + Math.sin(t * f.sp + f.ph) * f.amp + surgeX * 2;
            f.g.y = vpy + f.prog * vph - surgeY * 10;
            f.g.alpha = part.alpha;
          } else if (pkind === "ember") {
            f.prog = (f.prog + dt * 0.12 * f.sp) % 1;
            f.g.x = vpx + f.bx * vpw + Math.sin(t * f.sp + f.ph) * f.amp * 0.4 + surgeX * 3;
            f.g.y = vpBottom - f.prog * (vph * 0.6) - surgeY * 15;
            f.g.alpha = (1 - f.prog) * part.alpha * (1 + distToPet * Math.abs(jiggle) * 0.5);
          } else if (pkind === "star") {
            f.g.x = vpx + f.bx * vpw;
            f.g.y = vpy + f.by * skyH;
            f.g.alpha = part.alpha * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1 + f.sp) + f.ph)));
          } else if (pkind === "spark") {
            const phase = (t * f.sp + f.ph) % 1.2;
            f.g.x = vpx + f.bx * vpw + Math.sin(t * 9 + f.ph) * 2 + surgeX;
            f.g.y = vpy + f.by * skyH - surgeY * 5;
            f.g.alpha = phase < 0.08 ? part.alpha : phase < 0.16 ? part.alpha * 0.3 : phase < 0.24 ? part.alpha : 0;
          } else if (pkind === "mist") {
            f.g.x = vpx + ((((f.bx + t * 0.012 * f.sp) % 1) + 1) % 1) * vpw + surgeX * 4;
            f.g.y = vpy + (0.55 + f.by * 0.4) * vph - surgeY * 5;
            f.g.alpha = part.alpha * (0.5 + 0.5 * Math.sin(t * 0.6 + f.ph)) * (1 + distToPet * envBreath * 0.5);
          } else {
            // firefly / pollen / dust — gentle drift (+ blink for firefly)
            f.g.x = vpx + f.bx * vpw + Math.sin(t * f.sp + f.ph) * f.amp;
            f.g.y = vpy + f.by * skyH * 1.05 + Math.cos(t * f.sp * 0.8 + f.ph) * f.amp * 0.6;
            f.g.alpha = pkind === "firefly" ? 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * (1.6 + f.sp) + f.ph)) : part.alpha;
          }
        }

        // lantern within the viewport
        lantern.x = vpx + vpw * 0.14;
        lantern.y = vpBottom - vph * 0.08;
        lantern.alpha = 0.82 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.03;
        lantern.scale.set((globe ? 0.7 : 1) * (1 + Math.sin(t * 7) * 0.015));

        // ── type-driven premium ambient within the viewport ──
        // Music pulse + Pet influence (breathing and energy)
        const pulse = audioEnergy * 0.8 + (beatT > 0 ? (beatT / 0.32) * 0.4 : 0);

        if (mega) {
          // A mega dictates the room like a hearth mon — its element-fire breathes into the whole
          // viewport, replacing the base element ambient. HOVERING the creature stokes it: the
          // atmosphere swells, the floor glows hotter and heat motes climb faster toward you.
          const stoke = 0.45 + 0.4 * petEnergy + hoverE * 0.9;
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: flameCol, alpha: Math.min(0.2, 0.045 * stoke) });
          ambient.ellipse(posX.value, groundY() + 4, pw * (0.7 + hoverE * 0.5) + envBreath * pw * 0.2, pw * 0.16).fill({ color: flameCol, alpha: Math.min(0.3, 0.12 * stoke) });
          const motes = 5 + Math.round(hoverE * 5); // denser heat-shimmer on hover
          for (let i = 0; i < motes; i++) {
            const ph = (t * 0.4 + i / motes) % 1;
            const mx = posX.value + Math.sin(i * 2.3 + t) * pw * (0.4 + ph * 0.5);
            const my = groundY() - ph * petPx * (1 + hoverE * 0.4);
            ambient.circle(mx, my, (1 + hoverE) * (1 - ph)).fill({ color: emberCol, alpha: (0.3 + 0.4 * hoverE) * (1 - ph) });
          }
          flash.rect(vpx, vpy, vpw, vph).fill({ color: flameCol, alpha: 0.015 + pulse * 0.04 + envBreath * 0.02 + hoverE * 0.05 });
          petLight = Math.max(petLight, pulse * 0.18 + envBreath * 0.06 + hoverE * 0.28);
        } else if (ambKind === "lightning") {
          // Energetic chaos — the only explosive music-sync effect
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0x001133, alpha: 0.05 });
          if (beatStrike && strikeT <= 0) {
            beatStrike = false;
            strikeT = 0.4;
            const x0 = vpx + vpw * (0.25 + Math.random() * 0.5);
            boltPts = genBolt(x0, vpy, vpy + (HZ - vpy) * 0.95, vpw * 0.07);
            boltBranch = genBolt(boltPts[6], boltPts[7], boltPts[7] + (HZ - vpy) * 0.4, vpw * 0.06);
            // (ground eruption is handled separately via groundErupt — only on a real music drop)
          }
          if (strikeT > 0) {
            strikeT -= dt;
            const life = Math.max(0, strikeT / 0.4);
            flash.rect(vpx, vpy, vpw, vph).fill({ color: 0xcfe6ff, alpha: 0.05 + life * 0.3 });
            if (life > 0.55) {
              strokeBolt(boltPts, 0.6 + 0.4 * Math.random());
              strokeBolt(boltBranch, 0.3);
              petLight = Math.max(petLight, life * 0.7); // bolt illuminates the pet
            }
          } else {
            boltT -= dt * (1 + audioEnergy * 1.5);
            if (boltT <= 0) {
              boltT = 4 + Math.random() * 7;
              strikeT = 0.4;
              const x0 = vpx + vpw * (0.25 + Math.random() * 0.5);
              boltPts = genBolt(x0, vpy, vpy + (HZ - vpy) * 0.95, vpw * 0.07);
              const mi = 6;
              boltBranch = genBolt(boltPts[mi], boltPts[mi + 1], boltPts[mi + 1] + (HZ - vpy) * 0.4, vpw * 0.06);
              // NOTE: ordinary ambient strikes do NOT touch the ground — only the SUPER strike
              // (music drop, above) gets the ground reaction, so it stays a rare, high-impact moment.
            }
          }
        } else if (ambKind === "hearth") {
          // Hearth-fire energy: warm, alive, responds to pet breath and movement.
          // (Megas never reach here — the mega-atmosphere branch above owns the room for them.)
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0xff6600, alpha: 0.08 * petEnergy });
          for (let i = 0; i < 5; i++) {
            // Micro-variation: dark pockets and slight density changes
            const darkPocket = Math.sin(t * 0.6 + i * 2) > 0.8 ? 0.4 : 1.0;
            const fl = (0.5 + 0.35 * Math.sin(t * (0.8 + i*0.2) * 3 + i) + 0.2 * Math.sin(t * (0.8 + i*0.2) * 7 + i)) * darkPocket;
            const fx2 = vpx + vpw * (0.2 + i * 0.15);
            const fhg = (HZ - vpy) * 0.12 * (0.6 + 0.4 * fl + pulse * 0.25) * (0.5 + 0.5 * petEnergy) * (1 + envBreath * 0.3);
            const fwd = vpw * 0.04 * (0.8 + 0.3 * fl + pulse * 0.1) * petEnergy;
            const tip = fx2 + Math.sin(t * 3 + i) * fwd * 0.5;
            ambient.moveTo(fx2 - fwd, HZ);
            ambient.quadraticCurveTo(fx2 - fwd * 0.5, HZ - fhg * 0.6, tip, HZ - fhg);
            ambient.quadraticCurveTo(fx2 + fwd * 0.5, HZ - fhg * 0.6, fx2 + fwd, HZ);
            ambient.fill({ color: 0xff7a2a, alpha: Math.min(1, (0.15 + 0.1 * fl + pulse * 0.1) * petEnergy) });
          }
          // Floor warmth pulse radiating out with breath
          ambient.ellipse(posX.value, groundY() + 4, pw * 0.6 + envBreath * pw * 0.2, pw * 0.15).fill({ color: 0xff4400, alpha: 0.15 * envBreath * petEnergy });
          // Tiny spark burst on hop
          if (hopBurstT > 0) {
            const hbp = hopBurstT / 0.5;
            for (let i = 0; i < 6; i++) {
               const sx = posX.value + Math.sin(i * 2 + t * 4) * pw * 0.5 * (1 - hbp);
               const sy = groundY() - (1 - hbp) * pw * 0.4 - Math.abs(Math.cos(i)) * pw * 0.2;
               ambient.circle(sx, sy, 1.5 + hbp).fill({ color: 0xffcc44, alpha: hbp * 0.8 });
            }
          }
          // Room reaction: campfire breathing with pet + beat
          flash.rect(vpx, vpy, vpw, vph).fill({ color: 0xff8c42, alpha: 0.01 + pulse * 0.04 + envBreath * 0.02 });
          petLight = Math.max(petLight, pulse * 0.18 + envBreath * 0.05);
        } else if (ambKind === "aurora") {
          // Gentle, reflective, dreamlike
          const baseColor = petType === "fairy" ? 0xf0a8d8 : petType === "ice" ? 0x9fe8f0 : 0x58a8f0;
          const altColor  = petType === "fairy" ? 0xffd1f0 : petType === "ice" ? 0xd1f7ff : 0x8ce0ff;
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: baseColor, alpha: 0.09 });
          for (let i = 0; i < 4; i++) {
            const sway = Math.sin(t * 0.3 + i * 1.5) * vpw * 0.15;
            const cx = vpx + vpw * (0.2 + i * 0.2) + sway;
            ambient.moveTo(cx - vpw * 0.1, vpy);
            ambient.bezierCurveTo(cx + vpw * 0.1, vpy + vph * 0.3, cx - vpw * 0.1, vpy + vph * 0.6, cx + vpw * 0.1, HZ);
            ambient.lineTo(cx - vpw * 0.05, HZ);
            ambient.bezierCurveTo(cx - vpw * 0.25, vpy + vph * 0.6, cx + vpw * 0.05, vpy + vph * 0.3, cx - vpw * 0.25, vpy);
            ambient.fill({ color: i % 2 === 0 ? baseColor : altColor, alpha: Math.min(1, (0.13 + 0.07 * Math.sin(t * 0.5 + i) + pulse * 0.06) * (0.6 + 0.4 * petEnergy)) });
          }
          // drifting shimmer sparkles riding the curtains (the "alive" glints)
          for (let i = 0; i < 6; i++) {
            const sx = vpx + vpw * (0.18 + i * 0.13) + Math.sin(t * 0.3 + i * 1.5) * vpw * 0.12;
            const sy = vpy + (HZ - vpy) * (0.2 + 0.55 * ((Math.sin(t * 0.4 + i * 2) + 1) / 2));
            const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 3);
            ambient.circle(sx, sy, 0.9 + tw).fill({ color: altColor, alpha: Math.min(1, (0.1 + 0.2 * tw) * petEnergy) });
          }
          // Room reaction: color wash synced with breath
          flash.rect(vpx, vpy, vpw, vph).fill({ color: baseColor, alpha: 0.03 + pulse * 0.04 + envBreath * 0.025 });
          petLight = Math.max(petLight, pulse * 0.14 + envBreath * 0.07);
        } else if (ambKind === "constellation") {
          // Ancient rotating cosmic geometry — brighter stars with glow halos + white cores
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0x0a0a1a, alpha: 0.12 });
          const cx = vpx + vpw * 0.5, cy = vpy + (HZ - vpy) * 0.4;
          const r1 = vpw * 0.3, r2 = vpw * 0.45;
          const starGlow = Math.min(1, (0.18 + pulse * 0.18) * petEnergy);
          for (let i = 0; i < 5; i++) {
            const ang = t * 0.05 + i * Math.PI * 0.4;
            const x1 = cx + Math.cos(ang) * r1, y1 = cy + Math.sin(ang) * r1 * 0.5;
            const x2 = cx + Math.cos(ang + 0.8) * r2, y2 = cy + Math.sin(ang + 0.8) * r2 * 0.5;
            ambient.moveTo(x1, y1).lineTo(x2, y2);
            ambient.stroke({ color: lightCol, width: 1.4, alpha: Math.min(1, (0.16 + pulse * 0.1) * petEnergy) });
            ambient.circle(x1, y1, 5).fill({ color: lightCol, alpha: starGlow * 0.4 });   // soft halo
            ambient.circle(x1, y1, 2).fill({ color: 0xffffff, alpha: starGlow });          // bright core
            ambient.circle(x2, y2, 4).fill({ color: lightCol, alpha: starGlow * 0.35 });
            ambient.circle(x2, y2, 1.5).fill({ color: 0xffffff, alpha: starGlow * 0.85 });
          }
          // Inner connecting triangle
          const a1 = -t * 0.03, a2 = a1 + 2.1, a3 = a1 + 4.2;
          ambient.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * 0.5)
                 .lineTo(cx + Math.cos(a2) * r1, cy + Math.sin(a2) * r1 * 0.5)
                 .lineTo(cx + Math.cos(a3) * r1, cy + Math.sin(a3) * r1 * 0.5)
                 .lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * 0.5);
          ambient.stroke({ color: lightCol, width: 1, alpha: Math.min(1, (0.1 + pulse * 0.06) * petEnergy) });
          // Room reaction: deep starry glow + the pet catches it
          flash.rect(vpx, vpy, vpw, vph).fill({ color: 0x9fd0ff, alpha: 0.025 + pulse * 0.03 + envBreath * 0.015 });
          petLight = Math.max(petLight, pulse * 0.12 + envBreath * 0.05);
        } else if (ambKind === "whispers") {
          // Eerie fog + shadow — creeping wisps that actually read, plus a low ground mist
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0x050508, alpha: 0.14 });
          const shadowAlpha = Math.min(1, (0.28 + pulse * 0.15) * petEnergy);
          // Corner darkening
          flash.moveTo(vpx, vpy).lineTo(vpx + vpw * 0.3, vpy).lineTo(vpx, vpy + vph * 0.3).fill({ color: 0x000000, alpha: shadowAlpha });
          flash.moveTo(vpx + vpw, vpy).lineTo(vpx + vpw * 0.7, vpy).lineTo(vpx + vpw, vpy + vph * 0.3).fill({ color: 0x000000, alpha: shadowAlpha });
          // Drifting wisps — brighter and more of them
          for (let i = 0; i < 5; i++) {
            const wx = vpx + (((t * 0.04 + i * 0.21) % 1.1) * vpw);
            const wy = vpy + (HZ - vpy) * (0.3 + 0.4 * Math.sin(t * 0.2 + i));
            ambient.ellipse(wx, wy, vpw * 0.16, vph * 0.09).fill({ color: lightCol, alpha: Math.min(1, (0.1 + 0.05 * Math.sin(t * 1.1 + i) + pulse * 0.04) * petEnergy) });
          }
          // Low creeping ground mist
          ambient.ellipse(vpx + vpw * 0.5 + Math.sin(t * 0.3) * vpw * 0.1, HZ + (vpBottom - HZ) * 0.25, vpw * 0.5, vph * 0.1)
                 .fill({ color: lightCol, alpha: Math.min(1, (0.08 + pulse * 0.03) * petEnergy) });
          // Eye-like glow in the dark — with a soft halo, a touch more present
          if (Math.sin(t * 0.8) > 0.94) {
             const ex = vpx + vpw * 0.15, ey = vpy + vph * 0.2;
             ambient.circle(ex, ey, 4).fill({ color: 0x9060ff, alpha: Math.min(1, 0.25 * petEnergy) });
             ambient.circle(ex, ey, 1.5).fill({ color: 0xc0a0ff, alpha: Math.min(1, 0.6 * petEnergy) });
             ambient.circle(ex + 10, ey, 4).fill({ color: 0x9060ff, alpha: Math.min(1, 0.25 * petEnergy) });
             ambient.circle(ex + 10, ey, 1.5).fill({ color: 0xc0a0ff, alpha: Math.min(1, 0.6 * petEnergy) });
          }
          petLight = Math.max(petLight, pulse * 0.1);
        } else if (ambKind === "canopy") {
          // Dappled sunlight through leaves. WARM GOLD on purpose — green beams merged into the
          // green biome and vanished; gold reads against foliage (parity with hearth/lightning).
          const sun = 0xfff1b0;    // warm sunlight shaft
          const sunHot = 0xfffbe0; // bright beam core / motes
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0xfff4c0, alpha: 0.06 });
          for (let i = 0; i < 4; i++) {
            const ang = 1.1 + Math.sin(t * 0.12 + i) * 0.06;
            const shimmer = 0.6 + 0.4 * Math.sin(t * (1.1 + i * 0.3) + i); // visible breathing
            const w0 = (vpw * 0.07 + pulse * vpw * 0.03) * (0.5 + 0.5 * petEnergy);
            const ox = vpx + vpw * (0.12 + i * 0.24);
            const oy = vpy - vph * 0.1;
            const len = vph * 1.25;
            const dx = Math.cos(ang), dy = Math.sin(ang);
            const px = -dy, py = dx;
            const ex = ox + dx * len, ey = oy + dy * len;
            // soft wide shaft (3x the old alpha so it actually reads)
            ambient.moveTo(ox + px * w0, oy + py * w0)
                   .lineTo(ex + px * w0 * 1.6, ey + py * w0 * 1.6)
                   .lineTo(ex - px * w0 * 1.6, ey - py * w0 * 1.6)
                   .lineTo(ox - px * w0, oy - py * w0);
            ambient.fill({ color: sun, alpha: Math.min(1, (0.10 + 0.05 * shimmer + pulse * 0.05) * (0.5 + 0.5 * petEnergy)) });
            // bright thin core → the "god-ray" definition
            ambient.moveTo(ox + px * w0 * 0.35, oy + py * w0 * 0.35)
                   .lineTo(ex + px * w0 * 0.6, ey + py * w0 * 0.6)
                   .lineTo(ex - px * w0 * 0.6, ey - py * w0 * 0.6)
                   .lineTo(ox - px * w0 * 0.35, oy - py * w0 * 0.35);
            ambient.fill({ color: sunHot, alpha: Math.min(1, (0.06 + 0.05 * shimmer) * (0.5 + 0.5 * petEnergy)) });
          }
          // Drifting pollen motes catching the light — grass's answer to fire's sparks (the life)
          for (let i = 0; i < 7; i++) {
            const mx = vpx + (((t * 0.03 + i * 0.14) % 1) * vpw);
            const my = vpy + (HZ - vpy) * (0.15 + 0.7 * ((Math.sin(t * 0.3 + i * 1.7) + 1) / 2));
            const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 3); // twinkle
            ambient.circle(mx, my, 1.1 + tw).fill({ color: sunHot, alpha: Math.min(1, (0.12 + 0.18 * tw) * petEnergy) });
          }
          // Leaf-shadow play on the floor — darker green for real contrast
          for (let i = 0; i < 5; i++) {
            const lx = vpx + (((t * 0.012 + i * 0.2) % 1) * vpw);
            const ly = HZ + (vpBottom - HZ) * (0.2 + 0.15 * (i % 3));
            ambient.circle(lx, ly, 16 + 6 * Math.sin(i)).fill({ color: 0x0a2a0a, alpha: Math.min(1, (0.1 + pulse * 0.02) * petEnergy) });
          }
          // Room reaction: warm sun wash + the pet catches the sunbeam
          flash.rect(vpx, vpy, vpw, vph).fill({ color: 0xfff0c0, alpha: 0.015 + pulse * 0.03 + envBreath * 0.02 });
          petLight = Math.max(petLight, pulse * 0.14 + envBreath * 0.06);
        } else if (ambKind === "current") {
          // Sky current: drifting clouds + wind streaks over a soft sky.
          // (Was white-on-white → invisible. Sky tint gives the white clouds something to read on.)
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0xbfe0ff, alpha: 0.06 });
          for (let i = 0; i < 4; i++) {
            const spd = 0.015 + i * 0.006 + pulse * 0.02;
            const cxp = vpx + (((t * spd + i * 0.27) % 1.2 - 0.1) * vpw);
            const cyp = vpy + (HZ - vpy) * (0.15 + 0.16 * i);
            const cw = vpw * (0.18 + 0.05 * i);
            ambient.ellipse(cxp, cyp, cw, cw * 0.34).fill({ color: 0xffffff, alpha: Math.min(1, (0.09 + pulse * 0.03) * (0.6 + 0.4 * petEnergy)) });
            ambient.ellipse(cxp + cw * 0.5, cyp + cw * 0.1, cw * 0.6, cw * 0.28).fill({ color: 0xffffff, alpha: Math.min(1, (0.07 + pulse * 0.03) * (0.6 + 0.4 * petEnergy)) });
          }
          for (let i = 0; i < 6; i++) {
            const spd = (0.2 + i * 0.05 + pulse * 0.2) * (0.5 + 0.5 * petEnergy);
            const wx = vpx + (((t * spd + i * 0.16) % 1) * vpw);
            const wy = vpy + (HZ - vpy) * (0.2 + 0.12 * i);
            const wlen = vpw * (0.14 + 0.12 * Math.sin(t * 0.5 + i));
            ambient.moveTo(wx, wy).lineTo(wx + wlen, wy).stroke({ color: 0xeaf6ff, width: 2.4, alpha: Math.min(1, (0.16 + pulse * 0.08) * petEnergy) });
          }
          // Room reaction: airy brightening + the pet catches the light
          flash.rect(vpx, vpy, vpw, vph).fill({ color: 0xdcefff, alpha: 0.02 + pulse * 0.03 + envBreath * 0.015 });
          petLight = Math.max(petLight, pulse * 0.12 + envBreath * 0.05);
        } else if (ambKind === "earth") {
          // Earth pulse: warm stone glow, rising dust, glowing ore glints — grounded but alive
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0x665544, alpha: 0.08 });
          // Stone glow from below (stronger)
          flash.rect(vpx, HZ, vpw, vpBottom - HZ).fill({ color: 0xd8b96a, alpha: Math.min(1, (0.07 + pulse * 0.07) * petEnergy) });
          // Rising dust — brighter, bigger
          for (let i = 0; i < 8; i++) {
            const dx = vpx + (((t * 0.02 + i * 0.12) % 1) * vpw);
            const dy = vpBottom - (((t * 0.05 + i * 0.2) % 1) * (vpBottom - vpy));
            const sx = pulse > 0.5 ? Math.sin(t * 40 + i) * 1.5 * pulse : 0; // seismic shimmer on heavy beat
            ambient.circle(dx + sx, dy, 2.5 + i % 2).fill({ color: 0xe0c478, alpha: Math.min(1, (0.2 + pulse * 0.08) * petEnergy) });
          }
          // Glowing ore/crystal glints near the floor (the warm "wow")
          for (let i = 0; i < 3; i++) {
            const gx = vpx + vpw * (0.25 + i * 0.25) + Math.sin(t * 0.4 + i) * vpw * 0.03;
            const gy = HZ + (vpBottom - HZ) * (0.35 + 0.2 * (i % 2));
            const gl = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 2);
            ambient.circle(gx, gy, 5).fill({ color: 0xffcf6a, alpha: Math.min(1, 0.18 * gl * petEnergy) });
            ambient.circle(gx, gy, 1.8).fill({ color: 0xfff0c0, alpha: Math.min(1, (0.25 + 0.3 * gl) * petEnergy) });
          }
          petLight = Math.max(petLight, pulse * 0.12 + envBreath * 0.04);
        } else if (ambKind === "industrial") {
          // Industrial: cold reflected light shafts + periodic welding-spark bursts (the steel "wow")
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0x334455, alpha: 0.07 });
          for (let i = 0; i < 3; i++) {
            const rx = vpx + vpw * (0.2 + i * 0.3);
            ambient.moveTo(rx - vpw * 0.1, vpy).lineTo(rx + vpw * 0.1, vpy).lineTo(rx + vpw * 0.15, vpBottom).lineTo(rx - vpw * 0.05, vpBottom);
            ambient.fill({ color: 0x7fd9ff, alpha: Math.min(1, (0.12 + 0.04 * Math.sin(t * 0.5 + i) + pulse * 0.05) * (0.6 + 0.4 * petEnergy)) });
          }
          // Welding spark burst every ~3s (t-based, no extra state)
          const sparkPhase = (t * 0.3 + 0.5) % 1;
          const burst = sparkPhase < 0.12 ? (0.12 - sparkPhase) / 0.12 : 0;
          if (burst > 0) {
            const wxp = vpx + vpw * 0.7, wyp = vpy + vph * 0.35;
            for (let i = 0; i < 8; i++) {
              const a = i * 0.8 + t;
              const d = (1 - burst) * vpw * 0.18;
              ambient.circle(wxp + Math.cos(a) * d, wyp + Math.abs(Math.sin(a)) * d, 1 + burst).fill({ color: 0xeaffff, alpha: Math.min(1, burst * 0.9) });
            }
            flash.rect(vpx, vpy, vpw, vph).fill({ color: 0xbfecff, alpha: burst * 0.12 });
            petLight = Math.max(petLight, burst * 0.4);
          }
          // Room reaction: sharp cold rim light
          flash.rect(vpx, vpy, vpw, vph).fill({ color: 0x7fd9ff, alpha: Math.min(1, 0.02 + pulse * 0.03 + envBreath * 0.015) });
          petLight = Math.max(petLight, pulse * 0.2 + envBreath * 0.03);
        } else if (ambKind === "warmth") {
          // Warm home: a soft window beam, a comfort pool on the floor, dust drifting in the light
          hazeG.rect(vpx, vpy, vpw, vph).fill({ color: 0xffe8ba, alpha: 0.09 });
          const cx = vpx + vpw * 0.5;
          ambient.moveTo(cx - vpw * 0.2, vpy).lineTo(cx + vpw * 0.2, vpy)
                 .lineTo(cx + vpw * 0.4, HZ + vph * 0.2).lineTo(cx - vpw * 0.2, HZ + vph * 0.2);
          ambient.fill({ color: 0xffe8ba, alpha: Math.min(1, (0.13 + 0.04 * Math.sin(t * 0.5) + pulse * 0.04) * (0.6 + 0.4 * petEnergy)) });
          // Floor comfort pool (stronger)
          ambient.ellipse(cx + vpw * 0.1, HZ + vph * 0.1, vpw * 0.32, vph * 0.09).fill({ color: 0xffe8ba, alpha: Math.min(1, (0.13 + pulse * 0.05) * petEnergy) });
          // Warm dust drifting in the beam (the cozy "wow")
          for (let i = 0; i < 6; i++) {
            const dx = cx - vpw * 0.18 + ((t * 0.02 + i * 0.17) % 1) * vpw * 0.45;
            const dy = vpy + (HZ + vph * 0.2 - vpy) * ((Math.sin(t * 0.25 + i * 1.7) + 1) / 2);
            const tw = 0.5 + 0.5 * Math.sin(t * 1.8 + i * 3);
            ambient.circle(dx, dy, 1 + tw).fill({ color: 0xfff3d0, alpha: Math.min(1, (0.1 + 0.16 * tw) * petEnergy) });
          }
          // Room reaction: soft breathing warmth
          flash.rect(vpx, vpy, vpw, vph).fill({ color: 0xffe8ba, alpha: Math.min(1, 0.02 + pulse * 0.03 + envBreath * 0.025) });
          petLight = Math.max(petLight, pulse * 0.14 + envBreath * 0.05);
        }

        // music beat pulse: a quick type-flavored burst on a reacting beat (additive)
        if (beatT > 0) {
          const bp = beatT / 0.32; // 1→0
          const cx = posX.value;
          const cy = posY.value - petPxRef * 0.55;
          if (petType === "electric") {
            ambient.circle(cx - petPxRef * 0.13, cy, 2 + 3 * bp).fill({ color: 0xfff3a0, alpha: bp * 0.9 });
            ambient.circle(cx + petPxRef * 0.13, cy, 2 + 3 * bp).fill({ color: 0xfff3a0, alpha: bp * 0.9 });
          } else if (petType === "fire") {
            for (let i = 0; i < 3; i++)
              ambient.circle(cx + (i - 1) * petPxRef * 0.18, cy + petPxRef * 0.25 - (1 - bp) * 22, 1.6 + 1.6 * bp).fill({ color: 0xffb061, alpha: bp * 0.85 });
          } else if (hasWater) {
            const rr = petPxRef * 0.5 * (1 - bp) + 8;
            ambient.ellipse(cx, posY.value, rr, rr * 0.3).stroke({ color: lightCol, width: 2, alpha: bp * 0.5 });
          } else if (petType === "psychic" || petType === "fairy") {
            ambient.circle(cx, cy, petPxRef * 0.55 * (1 - bp) + 6).stroke({ color: 0xd9c2ff, width: 2, alpha: bp * 0.55 });
          } else {
            ambient.circle(cx, cy, petPxRef * 0.45 * (1 - bp) + 6).stroke({ color: lightCol, width: 1.5, alpha: bp * 0.4 });
          }
        }

        // water caustics: drifting shimmer cells on the sea (additive), any water biome
        if (hasWater) {
          for (let i = 0; i < 7; i++) {
            const cxw = vpx + (((i * 0.16 + t * 0.03 * (1 + (i % 2))) % 1) + 1) % 1 * vpw;
            const cyw = HZ + ((((i * 0.13 + t * 0.05) % 1) + 1) % 1) * (vpBottom - HZ);
            const r = 8 + 6 * Math.sin(t * 1.3 + i);
            ambient.ellipse(cxw, cyw, Math.max(3, r), Math.max(1.5, r * 0.3))
              .fill({ color: lightCol, alpha: 0.05 + 0.035 * (0.5 + 0.5 * Math.sin(t * 2 + i)) });
          }
        }

        // ── rare-event system: unexpected, memorable, per-type cinematic moments ──
        if (rareKind) {
          rareProg += dt / rareDur;
          if (rareProg >= 1) { rareKind = ""; rareProg = 0; }
          else drawRare(rareKind, rareProg, vpx, vpy, vpw, vph, HZ);
        } else if (habitat) {
          // mood-gated cadence: sleeping calms the world, happy/excited heightens it
          rareT -= dt * (sleeping ? 0.35 : petState === "happy" ? 1.7 : 1);
          if (rareT <= 0) {
            const busy = F.switchFx !== "none" || F.evoActive || F.attacking;
            if (!busy && !sleeping) {
              const r = pickRare();
              rareKind = r[0];
              rareDur = r[1];
              rareProg = 0;
              // electric's superstrike is the headline event → more often (~1.5–3 min); other types
              // keep the rarer 2.5–6.5 min cadence. (Mood still modulates: happy faster, sleeping slower.)
              rareT = petType === "electric" ? 90 + Math.random() * 90 : 150 + Math.random() * 240;
              // LEGENDARY electric moment: the rare superstrike throws 2–3 globe bolts at once →
              // the ground answers with a multi-strike BARRAGE + a hard full-field flash, all scaled
              // by the pet's power. (gp* were refreshed earlier this frame by the ring block.)
              if (rareKind === "superstrike" && ringsOn) {
                ringFlash = Math.max(ringFlash, 1.3 + petPower * 0.5);
                const burst = 3 + Math.round(petPower * 2); // 3..5 simultaneous ground chains
                for (let i = 0; i < burst; i++) spawnGroundChain(1.6 + petPower * 1.0);
              }
            } else {
              rareT = 25 + Math.random() * 25; // busy/asleep → retry shortly
            }
          }
        }

        // ---- pet ----
        // brain bridge: a fresh "happy" → a joyful hop
        if (petState === "happy" && prevState !== "happy") {
          hop(330);
          squash.nudge(2);
          jiggle = Math.min(14, jiggle + 5);
        }
        prevState = petState;
        face = F.dir === 1 ? -1 : 1; // facing follows the brain (parity with Classic flip)
        if (F.eating && !prevEating) squash.nudge(2.4); // a bite → quick chomp
        prevEating = F.eating;
        // idle hops — but not while sleeping, settled, or mid-ceremony/attack
        const busyFx = F.switchFx !== "none" || F.evoActive || F.attacking;
        if (mode === "idle" && !sleeping && !calm && !busyFx) {
          nextHop -= dt * (1 + audioEnergy * 0.8); // livelier music → a touch more spring
          if (nextHop <= 0) {
            nextHop = 5 + Math.random() * 6;
            hop(200);
          }
        }
        // keep the pet anchored to its aligned home every frame (auto-corrects after a
        // drag-release or a window resize — no need to toggle V to realign). Hops only
        // nudge velocity, so the target staying at home is safe.
        if (mode !== "drag") {
          posX.target = w / 2;
          posY.target = groundY();
        }
        posX.step(dt);
        posY.step(dt);
        lean.step(dt);
        squash.step(dt);
        jiggle *= Math.exp(-dt / 0.16);
        if (jiggle < 0.05) jiggle = 0;
        if (petFrames > 0) petFrames--;
        if (mode !== "drag") {
          if (posY.value < groundY() - 8) airborne = true;
          else if (airborne && posY.value >= groundY() - 2) {
            airborne = false;
            squash.nudge(3.2);
            jiggle = Math.min(16, jiggle + 8);
          }
        }
        const sq = squash.value;
        const chomp = F.eating ? 0.07 * Math.abs(Math.sin(t * 18)) : 0; // mouth open/close
        // sleeping → slower, deeper breath
        const breathe =
          (sleeping ? 0.032 * Math.sin(t * 1.0) : 0.022 * Math.sin(t * 1.7)) +
          (petFrames > 0 ? 0.02 * Math.sin(t * 26) : 0);
        const shear = lean.value * pw * 0.22;

        // type-specific idle flavor (parity with Classic's per-type idles)
        const isSway = petType === "grass" || petType === "bug" || petType === "water" || petType === "ice";
        const swayAmp = petType === "grass" || petType === "bug" ? 0.05 : petType === "water" || petType === "ice" ? 0.03 : 0;
        const swaySpd = petType === "water" || petType === "ice" ? 1.1 : 1.6;
        const isFire = petType === "fire";
        const fireFlick = isFire ? 0.92 + 0.05 * Math.sin(t * 30) + 0.03 * Math.sin(t * 53) : 1;
        const isFloat = petType === "ghost" || petType === "psychic" || petType === "flying" || petType === "dragon" || petType === "fairy";
        const floatBob = isFloat ? Math.sin(t * 1.4) * petPx * 0.04 : 0;
        const elJit = petType === "electric" && Math.sin(t * 1.7) > 0.94 ? (Math.random() - 0.5) * pw * 0.03 : 0;

        if (deformable && posBuf) {
          const data = posBuf.data; // current buffer (reloadPet swaps it on form change)
          for (let i = 0; i < baseV.length; i += 2) {
            const bx = baseV[i];
            const by = baseV[i + 1];
            const v = uv[i + 1];
            const belly = Math.sin(v * Math.PI);
            const sy = 1 + breathe - sq * 0.16 - chomp;
            const sx = 1 + sq * 0.16 * belly + chomp * 0.5;
            const sway = isSway ? (1 - v) * swayAmp * Math.sin(t * swaySpd) * pw : 0;
            data[i] =
              pcx + (bx - pcx) * sx + jiggle * Math.sin(v * 6 + t * 14) * (0.4 + 0.6 * belly) + (1 - v) * shear + sway + elJit;
            data[i + 1] = maxY - (maxY - by) * sy;
          }
          posBuf.update();
          mesh.rotation = 0;
        } else {
          mesh.rotation = lean.value * 0.4;
        }

        // ── ceremony / evolution: scale · tint · visibility layered on the body ──
        let petScaleMul = 1;
        let tint = 0xffffff;
        let petVisible = true;
        const bodyCY = posY.value - (maxY - visCY) * curScale; // visible-content center
        ball.visible = false;
        burst.visible = false;
        evoGlow.visible = false;

        const sw = F.switchFx;
        if (sw !== prevSwitch) { prevSwitch = sw; ceremonyT = 0; }
        if (sw !== "none") ceremonyT += dt;
        // Ash stands at the left and throws (parity with Classic's trainer). The ball
        // leaves/returns to his hand; the pet recalls into it and the new form bursts out.
        trainer.visible = false;
        const trX = w * 0.18;
        const trGY = groundY() + 4;
        const handX = trX + size * 0.24;
        const handY = trGY - size * 0.6;
        const showTrainer = (x: number, rot: number) => {
          if (!trainerTex) return;
          trainer.visible = true;
          trainer.x = x;
          trainer.y = trGY;
          trainer.rotation = rot;
          const ts = (size * 0.95) / Math.max(trainerTex.width || 1, trainerTex.height || 1);
          trainer.scale.set(ts);
        };
        if (sw === "recall") {
          const p = Math.min(1, ceremonyT / 0.48);
          petScaleMul = 1 - p * 0.85;
          tint = 0xff5a4d;
          mesh.alpha = 1 - p * 0.55;
          showTrainer(-w * 0.2 + (trX + w * 0.2) * p, 0); // Ash walks in
        } else if (sw === "ballout" || sw === "gap" || sw === "throw") {
          petVisible = false;
          if (sw === "ballout") {
            showTrainer(trX, 0);
            drawBall(ball, size * 0.16);
            const arc = Math.min(1, ceremonyT / 0.44); // pet → hand
            ball.x = posX.value + (handX - posX.value) * arc;
            ball.y = bodyCY + (handY - bodyCY) * arc;
            ball.rotation = arc * 9;
            ball.visible = true;
          } else if (sw === "gap") {
            showTrainer(trX, -0.18); // wind up (lean back)
          } else {
            showTrainer(trX, 0.18); // lean into the throw
            drawBall(ball, size * 0.16);
            const arc = Math.min(1, ceremonyT / 0.68); // hand → pet, with an arc
            ball.x = handX + (posX.value - handX) * arc;
            ball.y = handY + (bodyCY - handY) * arc - Math.sin(arc * Math.PI) * 70;
            ball.rotation = arc * 16;
            ball.visible = true;
          }
        } else if (sw === "release") {
          const p = Math.min(1, ceremonyT / 0.62);
          petScaleMul = Math.min(1, p * 1.5); // new form grows out
          showTrainer(trX - w * 0.4 * p, 0.18 * (1 - p)); // Ash heads off
          if (p < 0.55) {
            const rr = size * (0.2 + p);
            burst.clear();
            burst.circle(0, 0, rr).stroke({ color: lightCol, width: 4, alpha: Math.max(0, 0.6 - p) });
            burst.circle(0, 0, rr * 0.55).fill({ color: 0xffffff, alpha: Math.max(0, 0.5 - p) });
            burst.x = posX.value;
            burst.y = bodyCY;
            burst.visible = true;
          }
        }
        // evolution: a white silhouette pulse (the form itself swaps at the end via remount)
        if (F.evoActive) {
          evoT += dt;
          const fl = 0.5 + 0.5 * Math.sin(evoT * 22);
          tint = lerpCol(0xc9beff, 0xffffff, fl);
          petScaleMul *= 1 + 0.05 * Math.sin(evoT * 22);
          evoGlow.clear();
          evoGlow.circle(0, 0, petPx * 0.62).fill({ color: 0xffffff, alpha: 0.12 + 0.22 * fl });
          evoGlow.x = posX.value;
          evoGlow.y = bodyCY;
          evoGlow.visible = true;
        } else {
          evoT = 0;
        }
        if (isFire) tint = lerpCol(tint, 0xffcf8a, 0.25); // warm flicker tint
        if (petLight > 0.01) tint = lerpCol(tint, 0xe6f2ff, Math.min(0.85, petLight)); // lightning lights the body

        const fScale = curScale * petScaleMul;
        if (deformable && posBuf) mesh.scale.set(fScale * face, fScale);
        else mesh.scale.set(fScale * (1 + sq * 0.16) * face, fScale * (1 + breathe - sq * 0.16));
        mesh.tint = tint;
        mesh.visible = petVisible && petReady; // hide the old pet while a new one loads
        mesh.x = posX.value;
        // a tiny energy "vibe" bob — subtle (max ~2.5px), only with audible music
        const vibe = audioEnergy > 0.12 && !sleeping ? Math.sin(t * 9) * audioEnergy * 2.5 : 0;
        mesh.y = posY.value + floatBob - vibe;
        if (sw !== "recall") {
          // v3 "phase" reaction (ghostly mons): a quick alpha flicker → vanish + reappear.
          const rxAlpha = rxPhaseT > 0 ? 0.18 + 0.82 * Math.abs(Math.sin(rxPhaseT * 11)) : 1;
          mesh.alpha = (F.evoActive ? 1 : (sleeping ? 0.84 : 1) * fireFlick) * rxAlpha;
        }

        // zzz while sleeping
        if (sleeping) {
          zzz.visible = true;
          zzz.x = posX.value + petPx * 0.24;
          zzz.y = posY.value - petPx * 0.72 + Math.sin(t * 2) * 3;
          zzz.alpha = 0.45 + 0.45 * Math.sin(t * 1.4);
        } else {
          zzz.visible = false;
        }

        // speech bubble above the head
        const bub = (bubble || "").trim();
        if (bub) {
          if (bub !== prevBubble) {
            prevBubble = bub;
            bubbleTxt.text = bub;
            const pad = 9;
            const bw = Math.min(bubbleTxt.width, 200) + pad * 2;
            const bh = bubbleTxt.height + pad * 2;
            bubbleH = bh;
            bubbleBg.clear();
            bubbleBg
              .roundRect(-bw / 2, -bh, bw, bh, 10)
              .fill({ color: 0x160f24, alpha: 0.95 })
              .stroke({ color: lightCol, width: 1, alpha: 0.5 });
            bubbleBg.moveTo(-6, -1).lineTo(0, 8).lineTo(6, -1).fill({ color: 0x160f24, alpha: 0.95 });
            bubbleTxt.y = -bh + pad;
          }
          bubbleC.visible = true;
          bubbleC.x = Math.max(bubbleH, Math.min(w - bubbleH, posX.value));
          bubbleC.y = Math.max(bubbleH + 10, posY.value - petPx * 0.95) + Math.sin(t * 2) * 1.5;
        } else {
          bubbleC.visible = false;
          prevBubble = "";
        }

        const lift = Math.max(0, groundY() - posY.value);
        petShadow.x = posX.value - (lean.value * 0.3);
        petShadow.y = groundY() + 3;
        // Grounding polish: shadow softens with breath/flare, settles when sleeping
        const sqN = squash.value / 220;
        const k = curScale * (1 - Math.min(0.45, lift / 130) + sqN * 0.1) * (1 + envBreath * 0.05);
        const shadowStretchX = 1 + Math.abs(sqN) * 0.2 + Math.abs(jiggle) * 0.08;
        const shadowStretchY = 1 - Math.abs(sqN) * 0.1;
        petShadow.scale.set(k * shadowStretchX, k * shadowStretchY);
        petShadow.alpha = 0.34 * (1 - Math.min(0.6, lift / 160)) * (sleeping ? 1.2 : 1) * (1 - envBreath * 0.15) * (1 + sqN * 0.2);

        for (const child of [...hearts.children]) {
          const hh = child as unknown as { _life: number; y: number; alpha: number; destroy: () => void };
          hh._life -= dt * 0.9;
          hh.y -= dt * 40;
          hh.alpha = Math.max(0, hh._life);
          if (hh._life <= 0) hh.destroy();
        }

        // ════ pet-attached FX: attacks · move callout · birthday hat · visitor ════
        fxC.x = posX.value;
        fxC.y = bodyCY;
        const dirx = F.dir > 0 ? 1 : -1;

        // attack: rising edge → spawn directional/burst sparks; render the move archetype
        if (F.attacking && !prevAttacking) {
          atkT = 0;
          spawnSparks(F.atkFlavor, F.atkKind ?? "stream", dirx); // v4: sparks carry the species tint
        }
        prevAttacking = F.attacking;
        if (F.attacking) atkT += dt;

        // v3 Reaction Identity: each poke (new reactionN) plays a species beat, reusing the
        // engine's own springs/sparks/light so it feels native, not bolted on.
        if (F.reactionN !== prevReactionN) {
          prevReactionN = F.reactionN;
          const rc = F.reactionColor;
          switch (F.reactionKind) {
            case "flare":  squash.nudge(1.5); spawnSparks(rc, "burst", dirx); break;
            case "bounce": squash.nudge(1.3); spawnSparks(rc, "burst", dirx); break;
            case "spark":  squash.nudge(0.8); spawnSparks(rc, "dir", dirx); petLight = Math.max(petLight, 0.45); break;
            case "aura":   spawnSparks(rc, "burst", dirx); petLight = Math.max(petLight, 0.3); break;
            case "shiver": jiggle = Math.min(14, jiggle + 7); break;
            case "doze":   squash.nudge(-0.7); break;
            case "turn":   lean.nudge(dirx * 1.2); break;
            case "phase":  rxPhaseT = 0.6; break;
          }
        }
        if (rxPhaseT > 0) rxPhaseT = Math.max(0, rxPhaseT - dt);

        beamG.clear();
        proj.visible = false;
        callout.visible = false;
        if (F.attacking) {
          const col = hexNum(F.atkColor);
          const flav = hexNum(F.atkFlavor); // v4: species secondary-type tint for the outer layer
          const k = F.atkKind ? FAMILY[F.atkKind] : null; // the 8 render families
          const vr = F.atkKind ? VARIANT[F.atkKind] : null; // per-kind modulation (spread/speed/shape/…)
          const kn = F.atkKind; // the specific ~24 kind, for sub-dispatch within a family
          const I = 0.6 + 0.55 * F.atkIntensity; // power → size multiplier
          if (k === "beam") {
            // focused ray — thick-beam (wide), thin-ray (narrow + long), sky-strike (a bolt from above)
            if (kn === "sky-strike") {
              // a jagged bolt striking down onto the pet — Thunder / Thunderbolt
              let bx = dirx * size * 0.1, by = -size * 1.4;
              beamG.moveTo(bx, by);
              for (let i = 1; i <= 5; i++) {
                bx = dirx * size * 0.1 + (Math.random() - 0.5) * size * 0.3;
                by = -size * 1.4 + ((size * 1.5) / 5) * i;
                beamG.lineTo(bx, by);
              }
              beamG.stroke({ color: 0xffffff, width: 3 * I, alpha: 0.9 });
              beamG.circle(dirx * size * 0.1, size * 0.05, size * 0.3 * I).fill({ color: col, alpha: 0.4 });
            } else {
              const wd = vr?.spread ?? 1;
              const len = size * 1.1 * I * (vr?.len ?? 1);
              const x0 = dirx > 0 ? size * 0.3 : -size * 0.3 - len;
              beamG.roundRect(x0, -6 * I * wd, len, 12 * I * wd, 6).fill({ color: col, alpha: 0.55 + Math.random() * 0.3 });
              beamG.roundRect(x0, -2.5 * I * wd, len, 5 * I * wd, 2.5).fill({ color: 0xffffff, alpha: 0.7 });
            }
          } else if (k === "breath") {
            // a widening cone exhaled from the mouth — modulated per kind (vr): flame-cone (soft hot
            // gradient), spray (droplets), wind (thin streaks), gas (slow faint cloud).
            const wv = vr?.waver ?? 1;
            const aMul = vr?.alpha ?? 1;
            const x0 = dirx * size * 0.28, y0 = -size * 0.05;
            const len = size * (0.9 + I * 0.5) * (vr?.len ?? 1);
            const spread = size * (0.26 + I * 0.18) * (vr?.spread ?? 1);
            const tip = x0 + dirx * len;
            if (vr?.shape === "cloud") {
              // gas: a slow, wide, diffuse cloud of puffs — not a sharp cone
              for (let i = 0; i < 7; i++) {
                const u = i / 6;
                beamG.circle(x0 + dirx * len * u, y0 + (Math.random() - 0.5) * spread * (0.6 + u), spread * (0.4 + u * 0.5)).fill({ color: i % 2 ? col : flav, alpha: 0.1 * aMul });
              }
            } else {
              const fan = (a: number, c: number, am: number) => {
                beamG.moveTo(x0, y0);
                beamG.lineTo(tip, y0 - spread * a * (0.7 + Math.random() * 0.5 * wv));
                beamG.lineTo(tip, y0 + spread * a * (0.7 + Math.random() * 0.5 * wv));
                beamG.closePath();
                beamG.fill({ color: c, alpha: am * aMul });
              };
              fan(1, flav, 0.32); // widest fan = species-flavour edge
              fan(0.6, col, 0.4); // saturated type-colour body
              fan(0.32, lerpCol(col, 0xffffff, 0.6), 0.4); // hot near-white inner
              fan(0.16, 0xffffff, 0.42); // white-hot core at the mouth
              if (vr?.shape === "droplet") {
                // spray: scattered droplets riding the cone — Bubble Beam / Hydro Pump
                for (let i = 0; i < 9; i++) {
                  const u = 0.2 + Math.random() * 0.8;
                  beamG.circle(x0 + dirx * len * u, y0 + (Math.random() - 0.5) * spread * u * 1.6, size * 0.03 * (1 - u * 0.5)).fill({ color: lerpCol(col, 0xffffff, 0.4), alpha: 0.6 * aMul });
                }
              } else if (vr?.shape === "streak") {
                // wind: thin fast streaks instead of a solid body — Gust / Air Slash
                for (let i = 0; i < 6; i++) {
                  const yo = (Math.random() - 0.5) * spread * 1.6;
                  beamG.moveTo(x0 + dirx * size * 0.1, y0 + yo * 0.3);
                  beamG.lineTo(tip + dirx * size * 0.1, y0 + yo).stroke({ color: lerpCol(col, 0xffffff, 0.3), width: 1.5, alpha: 0.5 * aMul });
                }
              }
            }
          } else if (k === "claw") {
            // slashes — rake (3-arc), blade (one clean long cut), multi-slash (a fast flurry)
            if (kn === "blade") {
              const p = Math.min(1, atkT * 4);
              const L = size * 0.9 * I * (vr?.len ?? 1);
              beamG.moveTo(dirx * size * 0.1 - dirx * L * 0.5 * p, -L * 0.5 * p);
              beamG.lineTo(dirx * size * 0.1 + dirx * L * 0.5 * p, L * 0.5 * p).stroke({ color: 0xffffff, width: 4 * I, alpha: 0.9 * (1 - p * 0.4) });
            } else {
              const n2 = kn === "multi-slash" ? 5 : 3;
              const off = (atkT * 8) % 0.5;
              for (let i = 0; i < n2; i++) {
                const yo = (i - (n2 - 1) / 2) * size * (kn === "multi-slash" ? 0.14 : 0.2);
                const a0 = -0.8 + off + (kn === "multi-slash" ? i * 0.15 : 0);
                beamG.arc(dirx * size * 0.18, yo, size * 0.45 * I, a0, a0 + 1.6).stroke({ color: i % 2 === 1 ? 0xffffff : col, width: 3.5, alpha: 0.88 - i * 0.08 });
              }
            }
          } else if (k === "bite") {
            // chomp (jaws snap shut) or throw (a grab-and-slam swing) — Crunch / Seismic Toss
            if (kn === "throw") {
              const p = Math.min(1, atkT * 2.5);
              const ang = -Math.PI * 0.8 + Math.PI * 1.2 * p;
              beamG.arc(dirx * size * 0.3, -size * 0.1, size * 0.4 * I, -Math.PI * 0.8, ang).stroke({ color: col, width: 4, alpha: 0.7 });
              beamG.circle(dirx * size * 0.3 + Math.cos(ang) * size * 0.4 * I, -size * 0.1 + Math.sin(ang) * size * 0.4 * I, size * 0.1 * I).fill({ color: col, alpha: 0.6 });
            } else {
              const snap = Math.min(1, atkT * 5);
              const gap = size * 0.28 * (1 - snap);
              const cx2 = dirx * size * 0.5;
              beamG.arc(cx2, -gap, size * 0.3 * I, 0.5, Math.PI - 0.5).stroke({ color: col, width: 5, alpha: 0.85 });
              beamG.arc(cx2, gap, size * 0.3 * I, Math.PI + 0.5, -0.5).stroke({ color: col, width: 5, alpha: 0.85 });
            }
          } else if (k === "dash") {
            // charge — quick-dash (clean streaks), heavy-slam (big impact ring), blitz (elemental trail)
            const sp = vr?.speed ?? 1;
            const nL = kn === "blitz" ? 6 : 4;
            for (let i = 0; i < nL; i++) {
              const yy = (Math.random() - 0.5) * size * 0.5;
              beamG.moveTo(-dirx * size * (0.1 + i * 0.12), yy);
              beamG.lineTo(-dirx * size * (0.42 + i * 0.12) * sp, yy).stroke({ color: kn === "blitz" ? lerpCol(col, 0xffffff, 0.3) : col, width: kn === "blitz" ? 3 : 2.5, alpha: 0.5 });
            }
            const p = Math.min(1, atkT * 3);
            beamG.circle(dirx * size * 0.5, -size * 0.05, size * (kn === "heavy-slam" ? 0.32 : 0.2) * I * p).fill({ color: 0xffffff, alpha: 0.45 * (1 - p) + 0.15 });
            if (kn === "heavy-slam" && p > 0.6) {
              beamG.circle(dirx * size * 0.5, size * 0.18, (size * 0.4 * I * (p - 0.6)) / 0.4).stroke({ color: col, width: 4 * (1 - p), alpha: 0.5 * (1 - p) });
            }
          } else if (k === "burst") {
            // area — quake (ground rings + rising shards), nova (radial bloom), wave (sweeping crest),
            // storm (streaks raining from above).
            const sprd = vr?.spread ?? 1;
            if (kn === "storm") {
              for (let i = 0; i < 10; i++) {
                const sx = (Math.random() - 0.5) * size * 2.2 * sprd;
                const sy = -size * (0.6 + Math.random() * 0.9);
                beamG.moveTo(sx, sy);
                beamG.lineTo(sx - dirx * size * 0.18, sy + size * 0.5).stroke({ color: i % 2 ? col : lerpCol(col, 0xffffff, 0.5), width: 2, alpha: 0.55 });
              }
            } else if (kn === "nova") {
              const p = Math.min(1, atkT * 2.2);
              beamG.circle(0, -size * 0.05, size * 0.75 * I * p * sprd).fill({ color: col, alpha: 0.4 * (1 - p) });
              beamG.circle(0, -size * 0.05, size * 0.42 * I * p).fill({ color: 0xffffff, alpha: 0.35 * (1 - p) });
            } else if (kn === "wave") {
              const p = (atkT * 1.2) % 1;
              for (let i = 0; i < 2; i++) {
                const pp = (p + i * 0.5) % 1;
                beamG.ellipse(dirx * size * pp * 1.3, size * 0.16, size * (0.3 + pp * 0.7) * sprd, size * (0.18 + pp * 0.3)).stroke({ color: lerpCol(col, 0xffffff, 0.3), width: 6 * (1 - pp), alpha: 0.55 * (1 - pp) });
              }
            } else {
              const p = (atkT * 1.5) % 1;
              for (let i = 0; i < 2; i++) {
                const pp = (p + i * 0.4) % 1;
                beamG.ellipse(0, size * 0.2, size * (0.2 + pp) * I * sprd, size * (0.08 + pp * 0.4) * I).stroke({ color: col, width: 5 * (1 - pp), alpha: 0.6 * (1 - pp) });
              }
              for (let i = 0; i < 4; i++) {
                const rp = Math.min(1, atkT * 2.5);
                const rx = (i - 1.5) * size * 0.22;
                beamG.rect(rx, size * 0.2 - rp * size * 0.25, size * 0.06, rp * size * 0.25).fill({ color: lerpCol(col, 0x000000, 0.2), alpha: 0.6 * (1 - rp) });
              }
            }
          } else if (k === "status") {
            // self FX — buff (pulsing aura), guard (shield arc), heal (rising motes)
            if (kn === "guard") {
              const rr = size * 0.5 * I;
              beamG.arc(dirx * size * 0.2, -size * 0.1, rr, -1.2, 1.2).stroke({ color: lerpCol(col, 0xffffff, 0.4), width: 4, alpha: 0.6 + 0.2 * Math.sin(atkT * 10) });
              beamG.arc(dirx * size * 0.2, -size * 0.1, rr * 0.8, -1, 1).stroke({ color: col, width: 2, alpha: 0.4 });
            } else if (kn === "heal") {
              for (let i = 0; i < 7; i++) {
                const ph = (atkT * 0.8 + i / 7) % 1;
                beamG.circle((Math.random() - 0.5) * size * 0.5, size * 0.2 - ph * size * 0.7, size * 0.03 * (1 - ph)).fill({ color: lerpCol(col, 0xffffff, 0.5), alpha: 0.7 * (1 - ph) });
              }
            } else {
              const rr = size * (0.42 + 0.12 * Math.sin(atkT * 12));
              beamG.circle(0, -size * 0.1, rr).stroke({ color: col, width: 3, alpha: 0.5 });
              beamG.circle(0, -size * 0.1, rr * 0.66).stroke({ color: col, width: 2, alpha: 0.35 });
            }
          } else {
            // projectile — a flying energy emoji; modulated: orb-lob (high arc), fast-shot (flat + fast),
            // multi-shot (a trailing volley), bomb (high lob + a big splat).
            const sp = vr?.speed ?? 1;
            const arc = vr?.arc ?? 0.3;
            proj.visible = true;
            proj.text = F.atkEmoji;
            const p = Math.min(1, atkT * 2.4 * sp);
            proj.x = dirx * size * (0.2 + p * 0.9);
            proj.y = -Math.sin(p * Math.PI) * (26 + arc * 40) - size * 0.1;
            if (kn === "multi-shot") {
              for (let i = 1; i <= 3; i++) {
                const pp = p - i * 0.18;
                if (pp > 0) beamG.circle(dirx * size * (0.2 + pp * 0.9), -Math.sin(pp * Math.PI) * (26 + arc * 40) - size * 0.1, size * 0.05 * I).fill({ color: col, alpha: 0.7 });
              }
            }
            if (p > 0.85) {
              const r = size * (kn === "bomb" ? 0.34 : 0.22) * I * ((p - 0.85) / 0.15);
              beamG.circle(proj.x, proj.y, r).fill({ color: col, alpha: 0.5 });
            }
          }
          if (F.atkName) {
            callout.visible = true;
            callout.text = F.atkName + "!";
            callout.style.fill = col;
            callout.x = 0;
            callout.y = -petPx * 0.95;
          }
        }
        // advance + cull attack sparks
        for (const s of [...sparkList]) {
          s.life -= dt;
          s.g.x += s.vx * dt;
          s.g.y += s.vy * dt;
          s.vy += 140 * dt;
          s.g.alpha = Math.max(0, s.life * 1.6);
          if (s.life <= 0) {
            s.g.destroy();
            sparkList.splice(sparkList.indexOf(s), 1);
          }
        }

        // birthday hat perched on the head (parity with Classic's 🎉)
        hat.visible = F.birthday && petVisible && sw === "none" && !F.evoActive;
        if (hat.visible) {
          drawHat(hat, petPx * 0.3);
          hat.x = posX.value + (visCX - pcx) * curScale + dirx * petPx * 0.12;
          hat.y = bodyCY - contentH * 0.5 * curScale + petPx * 0.06;
        }

        // wild visitor wandering through (own sprite, walks via a spring)
        const vid = F.visitorId;
        if (vid !== prevVisitorId) {
          prevVisitorId = vid;
          if (vid != null) {
            visX.set(F.visitorX);
            void loadVisitor(vid, F.visitorShiny);
          }
        }
        if (vid != null && vid === visitorTexId) {
          visitorSprite.visible = true;
          visX.target = F.visitorX;
          visX.step(dt);
          visitorSprite.x = w / 2 + visX.value;
          visitorSprite.y = groundY() + 6;
          const vt = visitorSprite.texture;
          const vScale = (size * 0.8) / Math.max(vt.width || 1, vt.height || 1);
          visitorSprite.scale.set((F.visitorFlip ? -1 : 1) * vScale, vScale);
          visitorSprite.alpha = 0.96;
        } else {
          visitorSprite.visible = false;
        }
      };
      a.ticker.add(tick);

      const onVis = () => (document.hidden ? a.ticker.stop() : a.ticker.start());
      document.addEventListener("visibilitychange", onVis);
      // WebGL CONTEXT LOSS recovery. On a laptop the GPU can power down during long idle (or a
      // driver TDR reset), which loses the WebGL context. Pixi does NOT auto-redraw after that, so
      // on a TRANSPARENT window the canvas goes blank → the widget appears to "vanish". preventDefault
      // lets the browser restore the context; we ask the parent to fully remount a fresh canvas.
      const canvas = a.canvas as HTMLCanvasElement;
      const onCtxLost = (e: Event) => { e.preventDefault(); onContextLost?.(); };
      const onCtxRestored = () => onContextLost?.(); // remount on restore too (Pixi state is stale)
      canvas.addEventListener("webglcontextlost", onCtxLost as EventListener);
      canvas.addEventListener("webglcontextrestored", onCtxRestored as EventListener);
      // BACKSTOP for when the EVENT never fires. On a WebView2 GPU-process recycle the canvas can go
      // blank with no `webglcontextlost` at all — exactly the "vanishes after long idle" report. Poll
      // the live GL context so a silently-lost canvas still triggers a remount. The console.warn is
      // also the confirmation breadcrumb: if this logs when the widget disappears, the cause IS the
      // Pixi/WebGL context (not the window). Cheap (4s) and torn down with the component.
      const ctxWatch = setInterval(() => {
        const gl = (a.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
        if (gl?.isContextLost?.()) {
          console.warn("[PixiStage] WebGL context lost (watchdog) → remount");
          onContextLost?.();
        }
      }, 4000);
      // Tray-hide doesn't flip document.hidden (only minimize does), so the rAF kept rendering
      // for a hidden-to-tray widget — burning GPU/CPU for hours while "not noticed". Stop the
      // ticker on hm-visible:false too (Rust emits it on every hide/show). Fulfils the project's
      // "pause the rAF loop when hidden-to-tray" rule and trims long-idle webview pressure.
      let unlistenVis: (() => void) | null = null;
      listen<boolean>("hm-visible", (e) => (e.payload ? a.ticker.start() : a.ticker.stop()))
        .then((un) => {
          if (destroyed) un();
          else unlistenVis = un;
        })
        .catch(() => {}); // not under Tauri (web preview) — fine
      cleanup = () => {
        document.removeEventListener("visibilitychange", onVis);
        canvas.removeEventListener("webglcontextlost", onCtxLost as EventListener);
        canvas.removeEventListener("webglcontextrestored", onCtxRestored as EventListener);
        clearInterval(ctxWatch);
        unlistenVis?.();
        ro.disconnect();
        for (const f of frames) f.bmp.close(); // free decoded GIF frames
      };
    })().catch((e) => {
      console.error("[PixiStage] init failed:", e);
      // surface the error ON SCREEN so it's diagnosable without devtools
      try {
        if (host) {
          const pre = document.createElement("pre");
          pre.textContent = "PixiStage error:\n" + ((e && (e.stack || e.message)) || String(e));
          pre.style.cssText =
            "position:absolute;inset:0;margin:0;padding:10px;color:#ff9d9d;background:#1a1020;" +
            "font:11px/1.4 monospace;white-space:pre-wrap;overflow:auto;z-index:99;pointer-events:auto";
          host.appendChild(pre);
        }
      } catch {
        /* ignore */
      }
    });

    return () => {
      destroyed = true;
      cleanup?.();
      app?.destroy(true);
      app = null;
    };
  });
</script>

<div class="stage" bind:this={host}></div>

<style>
  .stage {
    position: absolute;
    inset: 0;
  }
</style>
