<script lang="ts">
  // V2 Phase 0 — the beachhead. Prove a Pokémon can LIVE in Pixi without losing
  // interaction quality: breathing, lean, idle hop, drag (with weight), petting,
  // tap. No sanctuary, no shaders, no FSM yet — just parity + the spring feel.
  import { onMount } from "svelte";
  import { Application, Sprite, Assets, Text, Container, type Texture } from "pixi.js";
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

      // crisp pixel art
      let tex: Texture;
      try {
        tex = await Assets.load(spriteUrl(dexId, shiny));
      } catch {
        tex = await Assets.load(fallbackUrl(dexId, shiny));
      }
      if (destroyed) return;
      tex.source.scaleMode = "nearest";

      const pet = new Sprite(tex);
      pet.anchor.set(0.5, 1); // feet at the bottom → hop/squash pivot from the ground
      pet.eventMode = "static";
      pet.cursor = "grab";
      const baseScale = size / Math.max(tex.width, tex.height);
      a.stage.addChild(pet);

      const hearts = new Container();
      a.stage.addChild(hearts);

      const baseY = () => a.screen.height * 0.82;
      const centerX = () => a.screen.width / 2;

      // motion springs
      const posX = new Spring(centerX(), 120, 16);
      const posY = new Spring(baseY(), 150, 14);
      const lean = new Spring(0, 90, 12);
      const squash = new Spring(0, 220, 16); // + = wider & shorter (landing/petting)

      // interaction state (mirrors V1 Pet.svelte: drag vs stroke vs tap)
      let dragging = false;
      let downAt: { x: number; y: number; t: number } | null = null;
      let last: { x: number; y: number } | null = null;
      let strokeDist = 0;
      let petFrames = 0;
      let airborne = false;
      let t = 0;
      let nextHop = 3 + Math.random() * 5;

      const hop = (v = 300) => posY.nudge(-v);
      function spawnHeart() {
        const h = new Text({ text: "♥", style: { fill: 0xff8fb0, fontSize: 16 } });
        h.anchor.set(0.5);
        h.x = pet.x + (Math.random() * 40 - 20);
        h.y = pet.y - size * 0.6;
        (h as unknown as { _life: number })._life = 1;
        hearts.addChild(h);
      }

      pet.on("pointerdown", (e) => {
        downAt = { x: e.global.x, y: e.global.y, t: performance.now() };
        last = { x: e.global.x, y: e.global.y };
        strokeDist = 0;
        pet.cursor = "grabbing";
      });

      a.stage.eventMode = "static";
      a.stage.hitArea = a.screen;
      a.stage.on("pointermove", (e) => {
        const gx = e.global.x;
        const gy = e.global.y;
        if (!dragging) lean.target = Math.max(-0.14, Math.min(0.14, (gx - pet.x) / a.screen.width));
        if (downAt) {
          const moved = Math.hypot(gx - downAt.x, gy - downAt.y);
          if (moved > 6) dragging = true;
        }
        if (dragging) {
          posX.target = gx;
          posY.target = gy; // sprite lags the cursor via the spring → weight
        } else if (last) {
          const within =
            Math.abs(gx - pet.x) < size * 0.5 && Math.abs(gy - (pet.y - size * 0.4)) < size * 0.5;
          if (within) {
            strokeDist += Math.hypot(gx - last.x, gy - last.y);
            if (strokeDist > 46) {
              strokeDist = 0;
              spawnHeart();
              petFrames = 26;
              squash.nudge(2);
            }
          }
        }
        last = { x: gx, y: gy };
      });

      const release = (tap: boolean) => {
        if (tap && downAt && !dragging) {
          const moved = last ? Math.hypot(last.x - downAt.x, last.y - downAt.y) : 0;
          if (moved < 6 && performance.now() - downAt.t < 400) hop(360); // a tap → a little jump
        }
        if (dragging) {
          dragging = false;
          posX.target = centerX();
          posY.target = baseY(); // drift home with an overshoot settle
        }
        downAt = null;
        last = null;
        pet.cursor = "grab";
      };
      a.stage.on("pointerup", () => release(true));
      a.stage.on("pointerupoutside", () => release(false));

      const tick = (ticker: { deltaMS: number }) => {
        const dt = Math.min(0.05, ticker.deltaMS / 1000);
        t += dt;

        if (!dragging) {
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

        // landing squash: detect crossing the baseline downward after a hop
        if (!dragging) {
          if (posY.value < baseY() - 8) airborne = true;
          else if (airborne && posY.value >= baseY() - 2) {
            airborne = false;
            squash.nudge(3.2);
          }
        }

        const breathe = 1 + 0.025 * Math.sin(t * 1.7); // continuous breath
        const wig = petFrames > 0 ? Math.sin(t * 30) * 0.05 : 0;
        if (petFrames > 0) petFrames--;

        pet.x = posX.value;
        pet.y = posY.value;
        const sQ = squash.value * 0.06;
        pet.scale.set(baseScale * (1 + sQ), baseScale * (breathe - sQ));
        pet.rotation = lean.value * 0.5 + wig;

        for (const child of [...hearts.children]) {
          const h = child as unknown as { _life: number } & { y: number; alpha: number; destroy: () => void };
          h._life -= dt * 0.9;
          h.y -= dt * 40;
          h.alpha = Math.max(0, h._life);
          if (h._life <= 0) h.destroy();
        }
      };
      a.ticker.add(tick);

      // always-on hygiene: pause the loop when the window/tab is hidden
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
