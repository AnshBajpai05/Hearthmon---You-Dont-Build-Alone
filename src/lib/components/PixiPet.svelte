<script lang="ts">
  // V2 Phase 1 — the motion language. The pet is a MeshPlane whose VERTICES are
  // deformed each frame (squash/stretch, a jelly belly bulge, a travelling
  // jiggle, a lean shear) — "soft toy with weight", no per-mon rig, scales to all
  // 1025 sprites. Everything is driven by the Spring engine; a tiny state seed
  // (idle / drag / pet) gates behaviour. Interaction parity carried over from P0.
  import { onMount } from "svelte";
  import { Application, Assets, MeshPlane, Graphics, Text, Container, Rectangle, type Texture } from "pixi.js";
  import { Spring } from "$lib/pixi/spring";
  import { spriteUrl, fallbackUrl } from "$lib/sprites";

  interface Props {
    dexId: number;
    shiny?: boolean;
    size?: number;
  }
  let { dexId, shiny = false, size = 200 }: Props = $props();

  let host: HTMLDivElement;
  let app: Application | null = null;

  onMount(() => {
    let destroyed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const a = new Application();
      await a.init({ backgroundAlpha: 0, antialias: true, resizeTo: host });
      if (destroyed) {
        a.destroy(true);
        return;
      }
      app = a;
      host.appendChild(a.canvas);

      let tex: Texture;
      try {
        tex = await Assets.load(spriteUrl(dexId, shiny));
      } catch {
        tex = await Assets.load(fallbackUrl(dexId, shiny));
      }
      if (destroyed) return;
      tex.source.scaleMode = "nearest";

      // ── deformable mesh ────────────────────────────────────────────────────
      const GX = 7;
      const GY = 8;
      const mesh = new MeshPlane({ texture: tex, verticesX: GX, verticesY: GY });
      const posBuf = mesh.geometry.getBuffer("aPosition");
      const base = Float32Array.from(posBuf.data as Float32Array);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < base.length; i += 2) {
        minX = Math.min(minX, base[i]);
        maxX = Math.max(maxX, base[i]);
        minY = Math.min(minY, base[i + 1]);
        maxY = Math.max(maxY, base[i + 1]);
      }
      const width = maxX - minX || 1;
      const height = maxY - minY || 1;
      const cx = (minX + maxX) / 2;
      const uv = new Float32Array(base.length); // normalized (u,v) per vertex from base
      for (let i = 0; i < base.length; i += 2) {
        uv[i] = (base[i] - minX) / width;
        uv[i + 1] = (base[i + 1] - minY) / height;
      }
      const baseScale = size / Math.max(width, height);
      mesh.pivot.set(cx, maxY); // pivot at the feet → squash/scale from the ground
      mesh.scale.set(baseScale);
      mesh.eventMode = "static";
      mesh.cursor = "grab";
      mesh.hitArea = new Rectangle(minX, minY, width, height); // stable hit box despite warping

      // contact shadow (grounds the pet; reacts to squash + hop height)
      const shadow = new Graphics();
      shadow.ellipse(0, 0, width * 0.46, 7).fill({ color: 0x000000, alpha: 0.34 });
      a.stage.addChild(shadow);
      a.stage.addChild(mesh);
      const hearts = new Container();
      a.stage.addChild(hearts);

      const baseY = () => a.screen.height * 0.8;
      const centerX = () => a.screen.width / 2;

      // springs
      const posX = new Spring(centerX(), 120, 16);
      const posY = new Spring(baseY(), 150, 14);
      const lean = new Spring(0, 90, 12);
      const squash = new Spring(0, 220, 16); // + = squashed (shorter + belly bulge)
      let jiggle = 0; // decaying wobble energy (base px)

      // tiny state seed (Phase-1 FSM): idle | drag | pet
      let mode: "idle" | "drag" | "pet" = "idle";
      let downAt: { x: number; y: number; t: number } | null = null;
      let lastPt: { x: number; y: number } | null = null;
      let strokeDist = 0;
      let petFrames = 0;
      let airborne = false;
      let clock = 0;
      let nextHop = 3 + Math.random() * 5;

      const hop = (v = 300) => posY.nudge(-v);
      function spawnHeart() {
        const h = new Text({ text: "♥", style: { fill: 0xff8fb0, fontSize: 16 } });
        h.anchor.set(0.5);
        h.x = posX.value + (Math.random() * 40 - 20);
        h.y = posY.value - size * 0.6;
        (h as unknown as { _life: number })._life = 1;
        hearts.addChild(h);
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
          posY.target = gy; // mesh lags the cursor via the spring → weight
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
          posX.target = centerX();
          posY.target = baseY();
          jiggle = Math.min(14, jiggle + 6); // a wobble when you let go
        }
        mode = "idle";
        downAt = null;
        lastPt = null;
        mesh.cursor = "grab";
      };
      a.stage.on("pointerup", () => release(true));
      a.stage.on("pointerupoutside", () => release(false));

      const data = posBuf.data as Float32Array;
      const tick = (ticker: { deltaMS: number }) => {
        const dt = Math.min(0.05, ticker.deltaMS / 1000);
        clock += dt;

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
        jiggle *= Math.exp(-dt / 0.16); // decay the wobble
        if (jiggle < 0.05) jiggle = 0;
        if (petFrames > 0) petFrames--;

        // landing squash: crossing the baseline downward after a hop
        if (mode !== "drag") {
          if (posY.value < baseY() - 8) airborne = true;
          else if (airborne && posY.value >= baseY() - 2) {
            airborne = false;
            squash.nudge(3.2);
            jiggle = Math.min(16, jiggle + 8);
          }
        }

        // ── per-vertex deform ────────────────────────────────────────────────
        const sq = squash.value;
        const breathe = 0.022 * Math.sin(clock * 1.7) + (petFrames > 0 ? 0.02 * Math.sin(clock * 26) : 0);
        const shear = lean.value * width * 0.22;
        for (let i = 0; i < base.length; i += 2) {
          const bx = base[i];
          const by = base[i + 1];
          const v = uv[i + 1];
          const belly = Math.sin(v * Math.PI); // 0 at head/feet, 1 mid-body
          const sy = 1 + breathe - sq * 0.16; // taller/shorter, anchored at the feet
          const sx = 1 + sq * 0.16 * belly; // squash → belly bulges out
          const ny = maxY - (maxY - by) * sy;
          const wob = jiggle * Math.sin(v * 6 + clock * 14) * (0.4 + 0.6 * belly);
          const nx = cx + (bx - cx) * sx + wob + (1 - v) * shear;
          data[i] = nx;
          data[i + 1] = ny;
        }
        posBuf.update();

        mesh.x = posX.value;
        mesh.y = posY.value;

        // shadow tracks the ground; shrinks/fades with hop height, widens on squash
        const ground = baseY();
        const lift = Math.max(0, ground - posY.value);
        shadow.x = posX.value;
        shadow.y = ground + 3;
        const k = baseScale * (1 - Math.min(0.45, lift / 130) + sq * 0.1);
        shadow.scale.set(k, k);
        shadow.alpha = 0.34 * (1 - Math.min(0.6, lift / 160));

        for (const child of [...hearts.children]) {
          const h = child as unknown as { _life: number; y: number; alpha: number; destroy: () => void };
          h._life -= dt * 0.9;
          h.y -= dt * 40;
          h.alpha = Math.max(0, h._life);
          if (h._life <= 0) h.destroy();
        }
      };
      a.ticker.add(tick);

      const onVis = () => (document.hidden ? a.ticker.stop() : a.ticker.start());
      document.addEventListener("visibilitychange", onVis);
      cleanup = () => document.removeEventListener("visibilitychange", onVis);
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
