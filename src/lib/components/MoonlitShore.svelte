<script lang="ts">
  // V2 Phase 2 — the environment proof. A layered Pixi scene-graph for the
  // Moonlit Shore biome (the water gold-standard): gradient sky → glowing moon
  // (parallax) → sea with a shimmering moon-reflection + rolling waves →
  // drifting fireflies → a warm lantern flicker. Sits BEHIND the pet (its own
  // transparent-on-top canvas). If this feels magical, the V2 direction holds.
  import { onMount } from "svelte";
  import { Application, Container, Graphics, FillGradient } from "pixi.js";

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
      const horizon = () => H() * 0.62; // sea starts here

      // ── static sky + sea (redrawn on resize) ────────────────────────────────
      const back = new Graphics();
      a.stage.addChild(back);
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

      // ── moon + soft glow (parallax drift) ───────────────────────────────────
      const moon = new Container();
      const glow = new Graphics();
      for (let i = 4; i >= 1; i--) glow.circle(0, 0, 10 + i * 9).fill({ color: 0xbcd2ff, alpha: 0.06 });
      const disc = new Graphics().circle(0, 0, 13).fill({ color: 0xeef4ff, alpha: 0.95 });
      moon.addChild(glow, disc);
      a.stage.addChild(moon);

      // ── moon reflection on the water (vertical shimmer column) ───────────────
      const reflect = new Graphics();
      a.stage.addChild(reflect);

      // ── rolling waves (redrawn each frame) ───────────────────────────────────
      const waves = new Graphics();
      a.stage.addChild(waves);

      // ── fireflies ────────────────────────────────────────────────────────────
      const flies = new Container();
      a.stage.addChild(flies);
      const FLY = Array.from({ length: 7 }, (_, i) => ({
        g: (() => {
          const c = new Container();
          const halo = new Graphics().circle(0, 0, 4).fill({ color: 0xffef9c, alpha: 0.25 });
          const core = new Graphics().circle(0, 0, 1.4).fill({ color: 0xfff3b0, alpha: 0.95 });
          c.addChild(halo, core);
          flies.addChild(c);
          return c;
        })(),
        bx: 0.12 + Math.random() * 0.76, // base x as fraction
        by: 0.3 + Math.random() * 0.34,
        ph: Math.random() * 6.28,
        sp: 0.4 + Math.random() * 0.5,
        amp: 8 + Math.random() * 14
      }));

      // ── lantern (warm flicker, lower-left) ───────────────────────────────────
      const lantern = new Graphics();
      for (let i = 5; i >= 1; i--) lantern.circle(0, 0, 6 + i * 10).fill({ color: 0xffb066, alpha: 0.05 });
      lantern.circle(0, 0, 5).fill({ color: 0xffd9a0, alpha: 0.85 });
      a.stage.addChild(lantern);

      const layout = () => {
        paintBack();
        moon.x = W() * 0.74;
        moon.y = H() * 0.2;
        lantern.x = W() * 0.12;
        lantern.y = H() * 0.86;
      };
      layout();
      const ro = new ResizeObserver(layout);
      ro.observe(host);

      let t = 0;
      const tick = (ticker: { deltaMS: number }) => {
        const dt = Math.min(0.05, ticker.deltaMS / 1000);
        t += dt;
        const w = W();
        const hz = horizon();
        const h = H();

        // moon parallax drift
        moon.x = w * 0.74 + Math.sin(t * 0.18) * 6;
        moon.y = h * 0.2 + Math.sin(t * 0.12) * 3;

        // moon reflection — a shimmering column under the moon
        reflect.clear();
        const mrx = moon.x;
        for (let i = 0; i < 10; i++) {
          const yy = hz + i * ((h - hz) / 10);
          const sway = Math.sin(t * 2 + i * 0.7) * (3 + i);
          const wdt = 26 - i * 1.6 + Math.sin(t * 3 + i) * 3;
          reflect
            .ellipse(mrx + sway, yy, Math.max(3, wdt), 2)
            .fill({ color: 0xcfe0ff, alpha: 0.16 - i * 0.012 });
        }

        // rolling waves across the sea
        waves.clear();
        for (let r = 0; r < 6; r++) {
          const yy = hz + 6 + r * ((h - hz - 6) / 6);
          const alpha = 0.14 - r * 0.015;
          waves.moveTo(0, yy);
          const seg = 26;
          for (let x = 0; x <= w; x += seg) {
            const yo = Math.sin(x * 0.045 + t * 1.6 + r * 0.9) * (1.6 + r * 0.5);
            waves.lineTo(x, yy + yo);
          }
          waves.stroke({ color: 0x9fc0ee, width: 1, alpha: Math.max(0.04, alpha) });
        }

        // fireflies drift + blink
        for (const f of FLY) {
          f.g.x = f.bx * w + Math.sin(t * f.sp + f.ph) * f.amp;
          f.g.y = f.by * hz + Math.cos(t * f.sp * 0.8 + f.ph) * (f.amp * 0.6);
          f.g.alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * (1.6 + f.sp) + f.ph));
        }

        // lantern flicker
        lantern.alpha = 0.82 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.03;
        lantern.scale.set(1 + Math.sin(t * 7) * 0.015);
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

<div class="scene" bind:this={host}></div>

<style>
  .scene {
    position: absolute;
    inset: 0;
  }
</style>
