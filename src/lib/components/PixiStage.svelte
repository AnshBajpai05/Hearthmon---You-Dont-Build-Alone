<script lang="ts">
  // V2 — unified Pixi stage: ONE Application holding the biome scene AND the
  // mesh pet in a single ticker (replaces the two stacked sandbox canvases).
  // This is the shape that drops into the real widget later. Scene is Moonlit
  // Shore for now; the biome will become data-driven next.
  import { onMount } from "svelte";
  import {
    Application,
    Assets,
    Container,
    Graphics,
    MeshPlane,
    Text,
    FillGradient,
    Rectangle,
    type Texture
  } from "pixi.js";
  import { Spring } from "$lib/pixi/spring";
  import { spriteUrl, fallbackUrl } from "$lib/sprites";

  interface Props {
    dexId: number;
    shiny?: boolean;
    size?: number;
  }
  let { dexId, shiny = false, size = 230 }: Props = $props();

  let host: HTMLDivElement;
  let app: Application | null = null;

  onMount(() => {
    let destroyed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const a = new Application();
      await a.init({ background: 0x0d1422, antialias: true, resizeTo: host });
      if (destroyed) {
        a.destroy(true);
        return;
      }
      app = a;
      host.appendChild(a.canvas);

      const W = () => a.screen.width;
      const H = () => a.screen.height;
      const horizon = () => H() * 0.62;
      const groundY = () => H() * 0.84; // where the pet stands (wet sand)

      // ════ SCENE LAYERS (back → front, all in this one stage) ════
      const back = new Graphics();
      const moon = new Container();
      const glow = new Graphics();
      for (let i = 4; i >= 1; i--) glow.circle(0, 0, 10 + i * 9).fill({ color: 0xbcd2ff, alpha: 0.06 });
      const disc = new Graphics().circle(0, 0, 13).fill({ color: 0xeef4ff, alpha: 0.95 });
      moon.addChild(glow, disc);
      const reflect = new Graphics();
      const waves = new Graphics();
      const lantern = new Graphics();
      for (let i = 5; i >= 1; i--) lantern.circle(0, 0, 6 + i * 10).fill({ color: 0xffb066, alpha: 0.05 });
      lantern.circle(0, 0, 5).fill({ color: 0xffd9a0, alpha: 0.85 });

      function paintBack() {
        const w = W();
        const h = H();
        const hz = horizon();
        back.clear();
        const sky = new FillGradient(0, 0, 0, hz);
        sky.addColorStop(0, 0x243056);
        sky.addColorStop(0.6, 0x161d38);
        sky.addColorStop(1, 0x10172e);
        back.rect(0, 0, w, hz).fill(sky);
        const sea = new FillGradient(0, hz, 0, h);
        sea.addColorStop(0, 0x1b2c4a);
        sea.addColorStop(1, 0x0a1322);
        back.rect(0, hz, w, h - hz).fill(sea);
      }

      // ════ PET (mesh-warp) ════
      let tex: Texture;
      try {
        tex = await Assets.load(spriteUrl(dexId, shiny));
      } catch {
        tex = await Assets.load(fallbackUrl(dexId, shiny));
      }
      if (destroyed) return;
      tex.source.scaleMode = "nearest";

      const GX = 7;
      const GY = 8;
      const mesh = new MeshPlane({ texture: tex, verticesX: GX, verticesY: GY });
      const posBuf = mesh.geometry.getBuffer("aPosition");
      const baseV = Float32Array.from(posBuf.data as Float32Array);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < baseV.length; i += 2) {
        minX = Math.min(minX, baseV[i]);
        maxX = Math.max(maxX, baseV[i]);
        minY = Math.min(minY, baseV[i + 1]);
        maxY = Math.max(maxY, baseV[i + 1]);
      }
      const pw = maxX - minX || 1;
      const ph = maxY - minY || 1;
      const pcx = (minX + maxX) / 2;
      const uv = new Float32Array(baseV.length);
      for (let i = 0; i < baseV.length; i += 2) uv[i + 1] = (baseV[i + 1] - minY) / ph;
      const petScale = size / Math.max(pw, ph);
      mesh.pivot.set(pcx, maxY);
      mesh.scale.set(petScale);
      mesh.eventMode = "static";
      mesh.cursor = "grab";
      mesh.hitArea = new Rectangle(minX, minY, pw, ph);

      const petShadow = new Graphics();
      petShadow.ellipse(0, 0, pw * 0.46, 7).fill({ color: 0x000000, alpha: 0.34 });

      const flies = new Container();
      const FLY = Array.from({ length: 7 }, () => ({
        c: (() => {
          const c = new Container();
          c.addChild(
            new Graphics().circle(0, 0, 4).fill({ color: 0xffef9c, alpha: 0.25 }),
            new Graphics().circle(0, 0, 1.4).fill({ color: 0xfff3b0, alpha: 0.95 })
          );
          flies.addChild(c);
          return c;
        })(),
        bx: 0.12 + Math.random() * 0.76,
        by: 0.3 + Math.random() * 0.34,
        ph: Math.random() * 6.28,
        sp: 0.4 + Math.random() * 0.5,
        amp: 8 + Math.random() * 14
      }));

      const hearts = new Container();

      // stage order: sky → moon → reflection → waves → lantern → shadow → pet → fireflies → hearts
      a.stage.addChild(back, moon, reflect, waves, lantern, petShadow, mesh, flies, hearts);

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
        moon.x = W() * 0.74;
        moon.y = H() * 0.2;
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

      const data = posBuf.data as Float32Array;
      let t = 0;
      const tick = (ticker: { deltaMS: number }) => {
        const dt = Math.min(0.05, ticker.deltaMS / 1000);
        t += dt;
        const w = W();
        const h = H();
        const hz = horizon();

        // ---- scene ----
        moon.x = w * 0.74 + Math.sin(t * 0.18) * 6;
        moon.y = h * 0.2 + Math.sin(t * 0.12) * 3;
        reflect.clear();
        for (let i = 0; i < 10; i++) {
          const yy = hz + i * ((h - hz) / 10);
          const sway = Math.sin(t * 2 + i * 0.7) * (3 + i);
          const wdt = 26 - i * 1.6 + Math.sin(t * 3 + i) * 3;
          reflect.ellipse(moon.x + sway, yy, Math.max(3, wdt), 2).fill({ color: 0xcfe0ff, alpha: 0.16 - i * 0.012 });
        }
        waves.clear();
        for (let r = 0; r < 6; r++) {
          const yy = hz + 6 + r * ((h - hz - 6) / 6);
          waves.moveTo(0, yy);
          for (let x = 0; x <= w; x += 26) {
            waves.lineTo(x, yy + Math.sin(x * 0.045 + t * 1.6 + r * 0.9) * (1.6 + r * 0.5));
          }
          waves.stroke({ color: 0x9fc0ee, width: 1, alpha: Math.max(0.04, 0.14 - r * 0.015) });
        }
        for (const f of FLY) {
          f.c.x = f.bx * w + Math.sin(t * f.sp + f.ph) * f.amp;
          f.c.y = f.by * hz + Math.cos(t * f.sp * 0.8 + f.ph) * (f.amp * 0.6);
          f.c.alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * (1.6 + f.sp) + f.ph));
        }
        lantern.alpha = 0.82 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.03;
        lantern.scale.set(1 + Math.sin(t * 7) * 0.015);

        // ---- pet ----
        if (mode === "idle") {
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
        const breathe = 0.022 * Math.sin(t * 1.7) + (petFrames > 0 ? 0.02 * Math.sin(t * 26) : 0);
        const shear = lean.value * pw * 0.22;
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
        mesh.x = posX.value;
        mesh.y = posY.value;

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
    })();

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
