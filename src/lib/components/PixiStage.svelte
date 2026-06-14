<script lang="ts">
  // V2 — unified, DATA-DRIVEN Pixi stage: one Application holding a biome scene
  // (derived from biomes.ts via the pet's type) + the mesh-warp pet, in a single
  // ticker. Moonlit Shore is the gold standard; every other type renders from
  // its palette + light + particle kind. This is the shape that drops into the
  // real widget.
  import { onMount } from "svelte";
  import {
    Application, Container, Graphics, MeshPlane, Text, Rectangle, Texture
  } from "pixi.js";
  import { Spring } from "$lib/pixi/spring";
  import { spriteUrl, fallbackUrl, dexEntry } from "$lib/sprites";
  import { biomeForType } from "$lib/biomes";

  interface Props {
    dexId: number;
    shiny?: boolean;
    size?: number;
    petState?: string; // brain bridge: "idle" | "sleeping" | "happy" | …
    calm?: boolean; // comfort / deep-flow → settle (no zoomies)
    habitat?: boolean; // biome scene on/off (Classic's habitat toggle)
    bgStyle?: "orb" | "square" | "ground" | "off"; // pet backdrop (Classic's 🌿 cycle)
    opacity?: number; // widget transparency slider (--wo)
    onTap?: () => void; // bridge to the shared brain (parity with Classic)
    onStroke?: () => void;
    onBackgroundDown?: () => void; // empty-space press → drag the window
  }
  let {
    dexId,
    shiny = false,
    size = 230,
    petState = "idle",
    calm = false,
    habitat = false,
    bgStyle = "orb",
    opacity = 1,
    onTap,
    onStroke,
    onBackgroundDown
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
      const biome = biomeForType(dexEntry(dexId)?.type ?? "normal");
      const sky0 = hexNum(biome.wall[0]);
      const sky1 = hexNum(biome.wall[1]);
      const grd0 = hexNum(biome.floor[0]);
      const grd1 = hexNum(biome.floor[1]);
      const lightCol = hexNum(biome.light);
      const part = rgba(biome.particleColor);
      const hasWater = biome.ground === "water";
      const pkind = biome.particle; // firefly|ember|pollen|spark|dust|snow|star|mist

      // transparent — so the desktop shows through (parity with the see-through widget)
      await a.init({ backgroundAlpha: 0, antialias: true, resizeTo: host });
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
        if (habitat && (bgStyle === "orb" || bgStyle === "square")) {
          const gR = Math.min(w, h) * 0.42;
          return h * 0.46 - gR + gR * 2 * 0.6; // globe horizon
        }
        return h * (habitat ? 0.82 : 0.56);
      };

      // ════ SCENE LAYERS ════
      const back = new Graphics();
      const orb = new Container(); // the biome's light source (moon / sun / lamp)
      const halo = new Graphics();
      for (let i = 4; i >= 1; i--) halo.circle(0, 0, 10 + i * 9).fill({ color: lightCol, alpha: 0.06 });
      orb.addChild(halo, new Graphics().circle(0, 0, 13).fill({ color: lightCol, alpha: 0.92 }));
      const reflect = new Graphics(); // water reflection (water biomes only)
      const waves = new Graphics(); // sea (water biomes only)
      const lantern = new Graphics();
      for (let i = 5; i >= 1; i--) lantern.circle(0, 0, 6 + i * 10).fill({ color: 0xffb066, alpha: 0.05 });
      lantern.circle(0, 0, 5).fill({ color: 0xffd9a0, alpha: 0.85 });

      // gradient via stacked rects (no FillGradient — avoids Pixi-version API drift)
      const lerpCol = (c0: number, c1: number, t: number) => {
        const r = Math.round(((c0 >> 16) & 255) + (((c1 >> 16) & 255) - ((c0 >> 16) & 255)) * t);
        const g = Math.round(((c0 >> 8) & 255) + (((c1 >> 8) & 255) - ((c0 >> 8) & 255)) * t);
        const b = Math.round((c0 & 255) + ((c1 & 255) - (c0 & 255)) * t);
        return (r << 16) | (g << 8) | b;
      };
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
      const flies = new Container();
      const PSIZE = pkind === "mist" ? 7 : pkind === "star" || pkind === "spark" ? 1.5 : 2.2;
      const P = Array.from({ length: pkind === "mist" ? 7 : 14 }, () => {
        const g = new Graphics().circle(0, 0, PSIZE).fill({ color: part.color, alpha: part.alpha });
        if (pkind === "firefly" || pkind === "ember") g.circle(0, 0, PSIZE * 2).fill({ color: part.color, alpha: part.alpha * 0.25 });
        flies.addChild(g);
        return { g, bx: Math.random(), by: Math.random(), ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.6, amp: 6 + Math.random() * 16, prog: Math.random() };
      });

      // ════ PET (mesh-warp) ════
      // Showdown sprites are GIFs (no Pixi loader) — load via <img> like the DOM
      // pet does, then wrap with Texture.from (static first frame; we animate it).
      const loadTex = (url: string): Promise<Texture | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            try {
              resolve(Texture.from(img));
            } catch {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      const tex = (await loadTex(spriteUrl(dexId, shiny))) ?? (await loadTex(fallbackUrl(dexId, shiny)));
      if (destroyed) return;
      if (!tex) throw new Error("sprite load failed for dex " + dexId);
      if (tex.source) tex.source.scaleMode = "nearest";

      const GX = 7;
      const GY = 8;
      const mesh = new MeshPlane({ texture: tex, verticesX: GX, verticesY: GY });
      const texW = tex.width || 96;
      const texH = tex.height || 96;
      const pw = texW;
      const ph = texH;
      const pcx = texW / 2;
      const maxY = texH; // plane spans 0..texW, 0..texH
      const petScale = size / Math.max(pw, ph);
      mesh.pivot.set(pcx, maxY); // feet at the bottom
      mesh.scale.set(petScale);
      mesh.eventMode = "static";
      mesh.cursor = "grab";
      mesh.hitArea = new Rectangle(0, 0, texW, texH);

      // vertex deform is OPTIONAL — if the buffer API differs by Pixi version, the
      // pet still renders (scale-only breath/squash). Never let it blank the stage.
      let deformable = false;
      let posBuf: { data: Float32Array; update: () => void } | null = null;
      let baseV = new Float32Array(0);
      let uv = new Float32Array(0);
      try {
        const b = mesh.geometry.getBuffer("aPosition") as unknown as { data: Float32Array; update: () => void };
        baseV = Float32Array.from(b.data);
        if (baseV.length < 4) throw new Error("no vertices");
        uv = new Float32Array(baseV.length);
        for (let i = 0; i < baseV.length; i += 2) uv[i + 1] = baseV[i + 1] / texH;
        posBuf = b;
        deformable = true;
      } catch (err) {
        console.error("[PixiStage] mesh deform unavailable; scale-only fallback:", err);
      }

      const platform = new Graphics(); // pet backdrop (orb / ground / off)
      const petShadow = new Graphics();
      petShadow.ellipse(0, 0, pw * 0.46, 7).fill({ color: 0x000000, alpha: 0.34 });
      const hearts = new Container();
      const zzz = new Text({ text: "z  z  z", style: { fill: 0xcfc6e8, fontSize: 13 } });
      zzz.anchor.set(0.5);
      zzz.visible = false;

      // biome scene grouped so it can be CLIPPED to the backdrop (habitat-in-sphere).
      // The mask is a CHILD of scene → Pixi uses it as a clip and never draws it
      // (adding it to the stage was what rendered the stray white square).
      const scene = new Container();
      const biomeMask = new Graphics();
      scene.addChild(back, orb, reflect, waves, lantern, flies, biomeMask);
      // order: scene (maskable) → backdrop → shadow → pet → hearts/zzz
      a.stage.addChild(scene, platform, petShadow, mesh, hearts, zzz);

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
          platform.ellipse(0, 0, size * 0.5, size * 0.13).fill({ color: lightCol, alpha: 0.14 });
        }
      }

      // ════ MOTION STATE ════
      const posX = new Spring(W() / 2, 120, 16);
      const posY = new Spring(groundY(), 150, 14);
      const lean = new Spring(0, 90, 12);
      const squash = new Spring(0, 220, 16);
      let jiggle = 0;
      let mode: "idle" | "drag" | "pet" = "idle";
      let downAt: { x: number; y: number; t: number } | null = null;
      let lastPt: { x: number; y: number } | null = null;
      let strokeDist = 0;
      let petFrames = 0;
      let airborne = false;
      let nextHop = 3 + Math.random() * 5;
      let prevState = petState; // brain bridge: detect happy/sleep transitions

      const hop = (v = 300) => posY.nudge(-v);
      function spawnHeart() {
        const t = new Text({ text: "♥", style: { fill: 0xff8fb0, fontSize: 16 } });
        t.anchor.set(0.5);
        t.x = posX.value + (Math.random() * 40 - 20);
        t.y = posY.value - size * 0.6;
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
        if (downAt && Math.hypot(gx - downAt.x, gy - downAt.y) > 6) mode = "drag";
        if (mode === "drag") {
          posX.target = gx;
          posY.target = gy;
        } else if (lastPt) {
          const within =
            Math.abs(gx - posX.value) < size * 0.5 && Math.abs(gy - (posY.value - size * 0.4)) < size * 0.5;
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

      const data = posBuf ? posBuf.data : new Float32Array(0);
      let t = 0;
      let vpSig = ""; // repaint the gradient only when the viewport changes
      const tick = (ticker: { deltaMS: number }) => {
        const dt = Math.min(0.05, ticker.deltaMS / 1000);
        t += dt;
        const w = W();
        const h = H();

        // ── viewport: full widget, OR a globe centered in the widget ───────────
        const globe = habitat && (bgStyle === "orb" || bgStyle === "square");
        const gR = Math.min(w, h) * 0.42;
        const gcx = w / 2;
        const gcy = h * 0.46;
        const vpx = globe ? gcx - gR : 0;
        const vpy = globe ? gcy - gR : 0;
        const vpw = globe ? gR * 2 : w;
        const vph = globe ? gR * 2 : h;
        const HZ = vpy + vph * (globe ? 0.6 : 0.62); // horizon
        const vpBottom = vpy + vph;
        const skyH = HZ - vpy;

        // opacity · biome visibility · translucency
        a.stage.alpha = opacity;
        scene.visible = habitat;
        scene.alpha = 0.9;

        // backdrop: the globe shell (habitat-in-sphere) or a small pad around the pet
        const bx = globe ? gcx : posX.value;
        const by = globe ? gcy : posY.value - size * 0.3;
        const br = globe ? gR : size * 0.52;
        drawPlatform(br);
        platform.visible = bgStyle !== "off";
        platform.x = bgStyle === "ground" ? posX.value : bx;
        platform.y = bgStyle === "ground" ? groundY() + 4 : by;
        petShadow.visible = bgStyle !== "off" || habitat;

        // clip the biome to the backdrop shape — full vista INSIDE the globe
        biomeMask.clear();
        if (globe) {
          scene.mask = biomeMask;
          if (bgStyle === "square") biomeMask.roundRect(gcx - gR, gcy - gR, gR * 2, gR * 2, 22).fill(0xffffff);
          else biomeMask.circle(gcx, gcy, gR).fill(0xffffff);
        } else {
          scene.mask = null;
        }

        // sky + ground gradient inside the viewport (repaint on change)
        const sig = `${vpx | 0},${vpy | 0},${vpw | 0},${vph | 0}`;
        if (sig !== vpSig) {
          vpSig = sig;
          back.clear();
          band(vpx, vpy, vpw, HZ - vpy, sky0, sky1, 14);
          band(vpx, HZ, vpw, vpBottom - HZ, grd0, grd1, 8);
        }

        // light orb (moon/sun) within the viewport, parallax
        orb.x = vpx + vpw * 0.74 + Math.sin(t * 0.18) * 6;
        orb.y = vpy + vph * 0.2 + Math.sin(t * 0.12) * 3;

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
            for (let x = vpx; x <= vpx + vpw; x += 26) waves.lineTo(x, yy + Math.sin(x * 0.045 + t * 1.6 + r * 0.9) * (1.6 + r * 0.5));
            waves.stroke({ color: lightCol, width: 1, alpha: Math.max(0.04, 0.13 - r * 0.015) });
          }
        }

        // particles within the viewport
        for (const f of P) {
          if (pkind === "snow") {
            f.prog = (f.prog + dt * 0.08 * f.sp) % 1;
            f.g.x = vpx + f.bx * vpw + Math.sin(t * f.sp + f.ph) * f.amp;
            f.g.y = vpy + f.prog * vph;
            f.g.alpha = part.alpha;
          } else if (pkind === "ember") {
            f.prog = (f.prog + dt * 0.12 * f.sp) % 1;
            f.g.x = vpx + f.bx * vpw + Math.sin(t * f.sp + f.ph) * f.amp * 0.4;
            f.g.y = vpBottom - f.prog * (vph * 0.6);
            f.g.alpha = (1 - f.prog) * part.alpha;
          } else if (pkind === "star") {
            f.g.x = vpx + f.bx * vpw;
            f.g.y = vpy + f.by * skyH;
            f.g.alpha = part.alpha * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1 + f.sp) + f.ph)));
          } else if (pkind === "spark") {
            const phase = (t * f.sp + f.ph) % 1.2;
            f.g.x = vpx + f.bx * vpw + Math.sin(t * 9 + f.ph) * 2;
            f.g.y = vpy + f.by * skyH;
            f.g.alpha = phase < 0.08 ? part.alpha : phase < 0.16 ? part.alpha * 0.3 : phase < 0.24 ? part.alpha : 0;
          } else if (pkind === "mist") {
            f.g.x = vpx + ((((f.bx + t * 0.012 * f.sp) % 1) + 1) % 1) * vpw;
            f.g.y = vpy + (0.55 + f.by * 0.4) * vph;
            f.g.alpha = part.alpha * (0.5 + 0.5 * Math.sin(t * 0.6 + f.ph));
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

        // ---- pet ----
        const sleeping = petState === "sleeping";
        // brain bridge: a fresh "happy" → a joyful hop
        if (petState === "happy" && prevState !== "happy") {
          hop(330);
          squash.nudge(2);
          jiggle = Math.min(14, jiggle + 5);
        }
        prevState = petState;
        // idle hops — but not while sleeping or settled (comfort/flow)
        if (mode === "idle" && !sleeping && !calm) {
          nextHop -= dt;
          if (nextHop <= 0) {
            nextHop = 5 + Math.random() * 6;
            hop(200);
          }
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
        // sleeping → slower, deeper breath
        const breathe =
          (sleeping ? 0.032 * Math.sin(t * 1.0) : 0.022 * Math.sin(t * 1.7)) +
          (petFrames > 0 ? 0.02 * Math.sin(t * 26) : 0);
        const shear = lean.value * pw * 0.22;
        if (deformable && posBuf) {
          for (let i = 0; i < baseV.length; i += 2) {
            const bx = baseV[i];
            const by = baseV[i + 1];
            const v = uv[i + 1];
            const belly = Math.sin(v * Math.PI);
            const sy = 1 + breathe - sq * 0.16;
            const sx = 1 + sq * 0.16 * belly;
            data[i] = pcx + (bx - pcx) * sx + jiggle * Math.sin(v * 6 + t * 14) * (0.4 + 0.6 * belly) + (1 - v) * shear;
            data[i + 1] = maxY - (maxY - by) * sy;
          }
          posBuf.update();
          mesh.rotation = 0;
        } else {
          // no vertex access — breathe/squash/lean via transform only
          mesh.scale.set(petScale * (1 + sq * 0.16), petScale * (1 + breathe - sq * 0.16));
          mesh.rotation = lean.value * 0.4;
        }
        mesh.x = posX.value;
        mesh.y = posY.value;
        mesh.alpha = sleeping ? 0.84 : 1; // dim a touch while asleep

        // zzz while sleeping
        if (sleeping) {
          zzz.visible = true;
          zzz.x = posX.value + size * 0.24;
          zzz.y = posY.value - size * 0.72 + Math.sin(t * 2) * 3;
          zzz.alpha = 0.45 + 0.45 * Math.sin(t * 1.4);
        } else {
          zzz.visible = false;
        }

        const lift = Math.max(0, groundY() - posY.value);
        petShadow.x = posX.value;
        petShadow.y = groundY() + 3;
        const k = petScale * (1 - Math.min(0.45, lift / 130) + sq * 0.1);
        petShadow.scale.set(k, k);
        petShadow.alpha = 0.34 * (1 - Math.min(0.6, lift / 160));

        for (const child of [...hearts.children]) {
          const hh = child as unknown as { _life: number; y: number; alpha: number; destroy: () => void };
          hh._life -= dt * 0.9;
          hh.y -= dt * 40;
          hh.alpha = Math.max(0, hh._life);
          if (hh._life <= 0) hh.destroy();
        }
      };
      a.ticker.add(tick);

      const onVis = () => (document.hidden ? a.ticker.stop() : a.ticker.start());
      document.addEventListener("visibilitychange", onVis);
      cleanup = () => {
        document.removeEventListener("visibilitychange", onVis);
        ro.disconnect();
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
