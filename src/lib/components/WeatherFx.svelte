<script lang="ts">
  // Natural weather effects — wind, rain, snow, thunderstorm.
  // Each lasts 20–30 seconds. Auto-fires on a random interval; also
  // manually toggle-able from the syscluster.

  export type WeatherKind = "none" | "wind" | "rain" | "snow" | "thunder";

  interface Props {
    kind: WeatherKind;
  }
  let { kind }: Props = $props();

  // ---- Rain drops ----
  const RAIN_DROPS = Array.from({ length: 38 }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 110 - 5),   // % — slightly off-screen allowed
    delay: +(Math.random() * 1.4).toFixed(2),
    dur:   +(0.55 + Math.random() * 0.35).toFixed(2),
    opacity: +(0.45 + Math.random() * 0.4).toFixed(2),
    tilt: Math.round(-15 + Math.random() * 8),   // degrees — slanted right
  }));

  // ---- Snow flakes ----
  const SNOW_FLAKES = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    left: Math.round(Math.random() * 108 - 4),
    delay: +(Math.random() * 3.5).toFixed(2),
    dur:   +(3.5 + Math.random() * 3).toFixed(2),
    size:  +(0.7 + Math.random() * 0.9).toFixed(2),
    swing: Math.round(Math.random() < 0.5 ? -1 : 1) * Math.round(8 + Math.random() * 18),
    emoji: Math.random() < 0.18 ? "❄" : "·",
  }));

  // ---- Wind leaves/particles ----
  const WIND_LEAVES = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    top:   Math.round(10 + Math.random() * 70),
    delay: +(Math.random() * 2.5).toFixed(2),
    dur:   +(1.8 + Math.random() * 1.6).toFixed(2),
    emoji: ["🍃","🍂","·","✦","·","🍃"][i % 6],
    size:  +(0.65 + Math.random() * 0.7).toFixed(2),
    yDrift: Math.round(-18 + Math.random() * 36),
  }));

  // ---- Thunder flash: two flashes then done ----
  let flashPhase = $state<"none" | "flash1" | "gap" | "flash2" | "off">("none");
  $effect(() => {
    if (kind === "thunder") {
      flashPhase = "none";
      const t1 = setTimeout(() => (flashPhase = "flash1"), 600);
      const t2 = setTimeout(() => (flashPhase = "gap"),    750);
      const t3 = setTimeout(() => (flashPhase = "flash2"),  900);
      const t4 = setTimeout(() => (flashPhase = "off"),    1100);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    } else {
      flashPhase = "none";
    }
  });
</script>

<!-- ===== RAIN ===== -->
{#if kind === "rain"}
  <div class="weather-root rain-root" aria-hidden="true">
    {#each RAIN_DROPS as d (d.id)}
      <span
        class="raindrop"
        style="
          left:{d.left}%;
          animation-delay:{d.delay}s;
          animation-duration:{d.dur}s;
          opacity:{d.opacity};
          transform:rotate({d.tilt}deg);
        "
      ></span>
    {/each}
  </div>
{/if}

<!-- ===== SNOW ===== -->
{#if kind === "snow"}
  <div class="weather-root snow-root" aria-hidden="true">
    {#each SNOW_FLAKES as f (f.id)}
      <span
        class="snowflake"
        style="
          left:{f.left}%;
          animation-delay:{f.delay}s;
          animation-duration:{f.dur}s;
          font-size:{f.size}em;
          --swing:{f.swing}px;
        "
      >{f.emoji}</span>
    {/each}
  </div>
{/if}

<!-- ===== WIND ===== -->
{#if kind === "wind"}
  <div class="weather-root wind-root" aria-hidden="true">
    <!-- Three wind-streak lines -->
    {#each [15, 42, 68] as top, i (i)}
      <span class="windline" style="top:{top}%; animation-delay:{i * 0.35}s"></span>
    {/each}
    <!-- Leaves / debris -->
    {#each WIND_LEAVES as l (l.id)}
      <span
        class="windleaf"
        style="
          top:{l.top}%;
          animation-delay:{l.delay}s;
          animation-duration:{l.dur}s;
          font-size:{l.size}em;
          --ydrift:{l.yDrift}px;
        "
      >{l.emoji}</span>
    {/each}
  </div>
{/if}

<!-- ===== THUNDER ===== -->
{#if kind === "thunder"}
  <!-- Reuse rain for thunder -->
  <div class="weather-root rain-root" aria-hidden="true">
    {#each RAIN_DROPS.slice(0, 22) as d (d.id)}
      <span
        class="raindrop heavy"
        style="
          left:{d.left}%;
          animation-delay:{d.delay}s;
          animation-duration:{d.dur * 0.75}s;
          opacity:{Math.min(1, d.opacity + 0.2)};
          transform:rotate({d.tilt - 5}deg);
        "
      ></span>
    {/each}
  </div>
  <!-- Lightning bolt -->
  {#if flashPhase !== "none" && flashPhase !== "off"}
    <div class="lightning-veil" class:flash={flashPhase === "flash1" || flashPhase === "flash2"} aria-hidden="true"></div>
    <span class="bolt" aria-hidden="true">⚡</span>
  {/if}
{/if}

<style>
  .weather-root {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 4;
    overflow: hidden;
  }

  /* ---- RAIN ---- */
  .rain-root {}
  .raindrop {
    position: absolute;
    top: -18px;
    width: 1.5px;
    height: 14px;
    border-radius: 1px;
    background: linear-gradient(to bottom, transparent, rgba(160, 200, 255, 0.75));
    animation: raindropfall linear infinite;
  }
  .raindrop.heavy {
    width: 2px;
    height: 18px;
    background: linear-gradient(to bottom, transparent, rgba(180, 210, 255, 0.85));
  }
  @keyframes raindropfall {
    0%   { transform: rotate(inherit) translateY(0);    opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 0.8; }
    100% { transform: rotate(inherit) translateY(110vh); opacity: 0; }
  }

  /* ---- SNOW ---- */
  .snow-root {}
  .snowflake {
    position: absolute;
    top: -20px;
    color: rgba(220, 235, 255, 0.9);
    text-shadow: 0 0 6px rgba(200, 220, 255, 0.7);
    animation: snowfall ease-in-out infinite;
  }
  @keyframes snowfall {
    0%   { transform: translateY(0)     translateX(0)                 rotate(0);    opacity: 0; }
    10%  { opacity: 0.9; }
    50%  { transform: translateY(50vh)  translateX(var(--swing, 12px)) rotate(120deg); }
    90%  { opacity: 0.7; }
    100% { transform: translateY(110vh) translateX(0)                 rotate(240deg); opacity: 0; }
  }

  /* ---- WIND ---- */
  .wind-root {}
  .windline {
    position: absolute;
    left: -10%;
    width: 35%;
    height: 1.5px;
    border-radius: 1px;
    background: linear-gradient(to right, transparent, rgba(200, 210, 230, 0.45), transparent);
    animation: windstreakline 1.4s ease-out infinite;
  }
  @keyframes windstreakline {
    0%   { transform: scaleX(0) translateX(0); opacity: 0; }
    25%  { opacity: 1; transform: scaleX(1) translateX(0); }
    100% { transform: scaleX(1) translateX(130vw); opacity: 0; }
  }
  .windleaf {
    position: absolute;
    left: -6%;
    animation: windleaffloat ease-in-out infinite;
  }
  @keyframes windleaffloat {
    0%   { transform: translateX(0)     translateY(0)                 rotate(0);   opacity: 0; }
    12%  { opacity: 0.9; }
    100% { transform: translateX(120vw) translateY(var(--ydrift, 0px)) rotate(360deg); opacity: 0; }
  }

  /* ---- THUNDER ---- */
  .lightning-veil {
    position: fixed;
    inset: 0;
    background: rgba(200, 220, 255, 0);
    transition: background 0.06s ease;
    pointer-events: none;
    z-index: 5;
  }
  .lightning-veil.flash {
    background: rgba(200, 220, 255, 0.22);
  }
  .bolt {
    position: fixed;
    top: 8%;
    left: 50%;
    font-size: 36px;
    transform: translateX(-50%);
    filter: drop-shadow(0 0 20px #fffbe0) drop-shadow(0 0 40px #aadfff);
    pointer-events: none;
    z-index: 6;
    animation: boltappear 0.5s ease-out forwards;
  }
  @keyframes boltappear {
    0%   { opacity: 0; transform: translateX(-50%) scale(0.5) translateY(-12px); }
    20%  { opacity: 1; transform: translateX(-50%) scale(1.1) translateY(0); }
    60%  { opacity: 1; }
    100% { opacity: 0; transform: translateX(-50%) scale(0.9) translateY(4px); }
  }
</style>
