// Living-companion README card — an ANIMATED, self-contained SVG snapshot of
// the pet's current state. Loaded via <img> on GitHub, so the browser runs the
// CSS @keyframes while GitHub's sanitizer stays out of the way. No scripts, no
// external refs: the sprite is embedded as a base64 data-URI.
import { biomeForType } from "./biomes";

export interface CardState {
  thought: string; // Layer 1 — a live COMPANION thought ("still here with this one")
  tagline: string; // Layer 2 — the money line / identity, under the title (wraps)
  sub?: string; // Layer 2.5 — ONE concrete line: what Hearthmon actually is
  chips: { icon: string; label: string }[]; // Layer 3 — narrative aliveness
  cta: string; // Layer 4 — a soft call with a direction ("come sit by the hearth →")
  stats?: string; // Layer 4 — factual proof of life ("day 27 together · 3-day streak")
  partner: string; // the companion's name, labelled under the sprite
  night: boolean;
  sprite?: string; // base64 data-URI of the companion (a static PNG, OR a frame STRIP)
  spriteFrames?: number; // >1 → `sprite` is a horizontal sprite-sheet; play it
  spriteFw?: number; // a single frame's width in the strip
  spriteFh?: number; // a single frame's height in the strip
  spriteDur?: number; // seconds for one full loop (matches the source GIF timing)
  type?: string; // the pet's primary type → picks ONE ambient effect for the card
  title?: string; // defaults to "Hearthmon"
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Split a line into at most two lines near `max` chars, breaking on a space. */
function wrap2(text: string, max = 34): [string, string] {
  if (text.length <= max) return [text, ""];
  const at = text.lastIndexOf(" ", max);
  const cut = at > 8 ? at : max;
  return [text.slice(0, cut).trim(), text.slice(cut).trim()];
}

/** ONE ambient effect for the card, chosen by the pet's type. Pure SVG + CSS so it
 *  animates inside an <img>-loaded SVG on GitHub (no scripts, no external refs). */
function petFieldFx(type: string, W: number, H: number): { css: string; body: string } {
  const R = (a: number, b: number) => +(a + Math.random() * (b - a)).toFixed(1);
  // N rising/scattered motes around the pet (x 34–126), parametric
  const motes = (cls: string, n: number, fill: string, y0: number, y1: number, r0: number, r1: number, dur: number) =>
    Array.from({ length: n }, (_, i) =>
      `<circle class="${cls}" cx="${R(34, 126)}" cy="${R(y0, y1)}" r="${R(r0, r1)}" fill="${fill}" style="animation-delay:${(i * dur / n).toFixed(2)}s"/>`
    ).join("");

  switch (type) {
    case "electric": {
      let d = "M78,32"; let yy = 32; let xx = 78;
      for (let i = 0; i < 5; i++) { yy += R(20, 30); xx = 78 + R(-24, 24); d += ` L${xx.toFixed(0)},${yy.toFixed(0)}`; }
      return {
        css: `.ltflash{opacity:0;animation:ltFlash 4.6s ease-out infinite}
      .ltbolt{opacity:0;fill:none;stroke-linecap:round;stroke-linejoin:round;animation:ltStrike 4.6s ease-out infinite}
      .ltglow{filter:blur(1.6px)}
      @keyframes ltStrike{0%,100%{opacity:0}1%{opacity:1}3%{opacity:.25}4.5%{opacity:.95}6.5%{opacity:0}}
      @keyframes ltFlash{0%,100%{opacity:0}1.5%{opacity:.5}6.5%{opacity:0}}`,
        body: `<rect class="ltflash" x="0" y="0" width="${W}" height="${H}" rx="16" fill="#d7ecff"/>
      <path class="ltbolt ltglow" d="${d}" stroke="#bfe0ff" stroke-width="5"/>
      <path class="ltbolt" d="${d}" stroke="#ffffff" stroke-width="1.7"/>`
      };
    }
    case "fire":
      return {
        css: `.ember{opacity:0;transform-box:fill-box;animation:emberRise 3.2s ease-in infinite}
      @keyframes emberRise{0%{opacity:0;transform:translateY(0) scale(1)}18%{opacity:.9}100%{opacity:0;transform:translateY(-90px) scale(.3)}}`,
        body: motes("ember", 8, "#ffb061", 146, 152, 1.2, 2.6, 3.2)
      };
    case "water":
      return {
        css: `.bub2{opacity:0;fill:none;stroke:#9fdcff;stroke-width:1;transform-box:fill-box;animation:bubRise 5.5s ease-in infinite}
      @keyframes bubRise{0%{opacity:0;transform:translateY(0)}22%{opacity:.7}100%{opacity:0;transform:translateY(-94px)}}`,
        body: Array.from({ length: 6 }, (_, i) => `<circle class="bub2" cx="${R(40, 122)}" cy="150" r="${R(1.6, 3.2)}" style="animation-delay:${(i * 0.9).toFixed(2)}s"/>`).join("")
      };
    case "grass": case "bug":
      return {
        css: `.pollen{opacity:.7;transform-box:fill-box;animation:pollenDrift 9s ease-in-out infinite alternate}
      @keyframes pollenDrift{0%{transform:translate(0,0)}50%{transform:translate(9px,-7px)}100%{transform:translate(-6px,-13px)}}`,
        body: motes("pollen", 9, "#bff09a", 92, 144, 1, 2.1, 9)
      };
    case "ice":
      return {
        css: `.flake{opacity:0;transform-box:fill-box;animation:snowFall 7s linear infinite}
      @keyframes snowFall{0%{opacity:0;transform:translateY(-14px) translateX(0)}12%{opacity:.9}88%{opacity:.9}100%{opacity:0;transform:translateY(120px) translateX(12px)}}`,
        body: Array.from({ length: 9 }, (_, i) => `<circle class="flake" cx="${R(30, 128)}" cy="${R(30, 46)}" r="${R(1, 2)}" fill="#eaf6ff" style="animation-delay:${(i * 0.8).toFixed(2)}s"/>`).join("")
      };
    case "psychic": case "fairy": {
      const orbit = [[44, 96], [112, 96], [78, 64], [78, 126]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 2 : 2.6}" fill="#d9c2ff"/>`).join("");
      return {
        css: `.psy{transform-box:fill-box;transform-origin:center;animation:psySpin 16s linear infinite}
      .pbloom{opacity:.4;transform-box:fill-box;transform-origin:center;animation:glowPulse 4s ease-in-out infinite}
      @keyframes psySpin{to{transform:rotate(360deg)}}`,
        body: `<ellipse class="pbloom" cx="78" cy="96" rx="46" ry="44" fill="url(#sprGlow)"/><g class="psy">${orbit}</g>`
      };
    }
    case "ghost": case "dark":
      return {
        css: `.wisp{opacity:0;transform-box:fill-box;animation:wispDrift 6s ease-in-out infinite}
      .geye{animation:gblink 5s ease-in-out infinite}
      @keyframes wispDrift{0%{opacity:0;transform:translateY(0)}30%{opacity:.5}100%{opacity:0;transform:translateY(-42px) translateX(7px)}}
      @keyframes gblink{0%,40%,46%,100%{opacity:.55}43%{opacity:.05}72%{opacity:.55}}`,
        body: Array.from({ length: 4 }, (_, i) => `<ellipse class="wisp" cx="${R(44, 120)}" cy="${R(120, 148)}" rx="7" ry="4" fill="#9a8fd6" style="animation-delay:${(i * 1.2).toFixed(2)}s"/>`).join("")
          + `<circle class="geye" cx="70" cy="84" r="2.4" fill="#ff5a5a"/><circle class="geye" cx="84" cy="84" r="2.4" fill="#ff5a5a"/>`
      };
    case "dragon": case "flying":
      return {
        css: `.wind{opacity:0;transform-box:fill-box;animation:windPass 5s linear infinite}
      @keyframes windPass{0%{opacity:0;transform:translateX(-34px)}25%{opacity:.4}75%{opacity:.4}100%{opacity:0;transform:translateX(46px)}}`,
        body: Array.from({ length: 4 }, (_, i) => `<rect class="wind" x="34" y="${62 + i * 22}" width="${R(34, 60)}" height="1.4" rx="0.7" fill="#cdbcf0" style="animation-delay:${(i * 0.7).toFixed(2)}s"/>`).join("")
      };
    default:
      return { css: "", body: "" }; // normal/ground/rock/steel/fighting/poison → base sparkles
  }
}

/** Build the animated README status card as an SVG string. */
export function buildCard(s: CardState): string {
  const W = 480;
  const H = 188;
  const title = s.title ?? "Hearthmon";
  const field = petFieldFx(s.type ?? "normal", W, H); // one type-based ambient effect

  // ── Per-type template ──────────────────────────────────────────────────────
  // The whole card palette derives from the pet's biome (biomes.ts): a water pet
  // gets the Moonlit Shore card, a fire pet the Campfire card, … Night keeps the
  // biome's identity but sinks the walls toward black.
  const biome = biomeForType(s.type ?? "normal");
  const mix = (a: string, b: string, t: number) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };
  const shade = (c: string, f: number) => mix(c, "#000000", f);
  const tint = (c: string, f: number) => mix(c, "#ffffff", f);

  const [wallTop, wallBot] = biome.wall;
  const nf = s.night ? 0.45 : 0; // night sink
  const bg1 = shade(wallTop, nf);
  const bg3 = shade(mix(wallTop, wallBot, 0.5), nf);
  const bg2 = shade(wallBot, nf);
  const accent  = biome.light;
  const aurora1 = accent;
  const aurora2 = tint(wallTop, 0.4);
  const textMain = "#f6f1ff";
  const textDim = tint(wallBot, 0.62); // dim yet readable on the dark walls
  const bubbleBg = shade(wallBot, 0.35);
  const groundTint = biome.light; // type's light colour → the ground/globe hue

  // money line wraps to two lines if long — chips sit under it
  const [tagA, tagB] = wrap2(s.tagline, 34);

  // ── Narrative aliveness chips — width-aware single row ───────────────────────
  const CHIP_Y = tagB ? 131 : 118;
  let chipX = 168;
  const chipSvg = s.chips
    .map((c, i) => {
      const label = esc(c.label);
      const w = 26 + (c.icon ? 13 : 0) + label.length * 6.1;
      if (chipX + w > W - 14) return ""; // ran out of room — drop the overflow
      const x = chipX;
      chipX += w + 7;
      const inner = `${c.icon ? c.icon + " " : ""}${label}`;
      return `<g class="chip" style="animation-delay:${i * 0.6}s">` +
        `<rect x="${x}" y="${CHIP_Y}" rx="10" width="${w.toFixed(0)}" height="21" ` +
        `fill="${accent}" fill-opacity="0.1" stroke="${accent}" stroke-opacity="0.45"/>` +
        `<rect x="${x}" y="${CHIP_Y}" rx="10" width="${w.toFixed(0)}" height="21" ` +
        `fill="url(#chipGlint)" fill-opacity="0" class="chipshine"/>` +
        `<text x="${(x + w / 2).toFixed(0)}" y="${CHIP_Y + 14}" font-size="11" fill="${accent}" ` +
        `text-anchor="middle">${inner}</text>` +
        `</g>`;
    })
    .join("");

  // ── Particles ──────────────────────────────────────────────────────────────
  const ptDefs = [
    { x: 38,  y: 118, d: "0s",    e: "✦",  fs: 10 },
    { x: 62,  y: 108, d: "1.1s",  e: s.night ? "✧" : "✦", fs: 8  },
    { x: 90,  y: 122, d: "2.1s",  e: s.night ? "🌙" : "✦", fs: 10 },
    { x: 52,  y: 130, d: "0.55s", e: "·",  fs: 14 },
    { x: 108, y: 112, d: "3.0s",  e: "✧",  fs: 9  },
    { x: 76,  y: 105, d: "1.7s",  e: "·",  fs: 12 },
    { x: 44,  y: 95,  d: "3.8s",  e: "✦",  fs: 7  },
  ];
  const particleSvg = ptDefs
    .map((p, i) => {
      const dur = (3.8 + i * 0.45).toFixed(1) + "s";
      return `<text class="pt" x="${p.x}" y="${p.y}" font-size="${p.fs}" fill="${accent}" ` +
             `style="animation-duration:${dur};animation-delay:${p.d}">${p.e}</text>`;
    })
    .join("");

  // ── Sprite ─────────────────────────────────────────────────────────────────
  // ~15% larger so the companion commands the left, not decoration. If a frame
  // STRIP is supplied, play it: clip to one frame and step the strip across with a
  // CSS steps() animation (runs inside an <img>-loaded SVG on GitHub — no scripts).
  const N = s.spriteFrames ?? 1;
  const fw = s.spriteFw || 110;
  const fh = s.spriteFh || 110;
  const animatedSheet = N > 1 && !!s.sprite;
  const fScale = Math.min(110 / fw, 110 / fh);
  const dispW = fw * fScale;
  const dispH = fh * fScale;
  const offX = (110 - dispW) / 2; // center horizontally
  const offY = 110 - dispH; // sit on the baseline (matches xMidYMax meet)
  const stripW = dispW * N;
  const innerSprite = animatedSheet
    ? `<g clip-path="url(#petclip)"><image class="monframes" href="${s.sprite}" x="${offX.toFixed(2)}" y="${offY.toFixed(2)}" width="${stripW.toFixed(2)}" height="${dispH.toFixed(2)}" preserveAspectRatio="none"/></g>`
    : s.sprite
      ? `<image class="mon" href="${s.sprite}" x="0" y="0" width="110" height="110" preserveAspectRatio="xMidYMax meet"/>`
      : `<text class="mon" x="55" y="82" font-size="62" text-anchor="middle">🐾</text>`;
  const clipDef = animatedSheet
    ? `<clipPath id="petclip"><rect x="${offX.toFixed(2)}" y="${offY.toFixed(2)}" width="${dispW.toFixed(2)}" height="${dispH.toFixed(2)}"/></clipPath>`
    : "";
  // step the strip one frame at a time over the loop duration (uniform-frame approx)
  const spriteAnimCss = animatedSheet
    ? `.monframes { image-rendering: pixelated; transform-box: fill-box; animation: monPlay ${(s.spriteDur || N / 12).toFixed(2)}s steps(${N}) infinite; }
      @keyframes monPlay { from { transform: translateX(0); } to { transform: translateX(-${stripW.toFixed(2)}px); } }`
    : "";

  // ── "Snow-globe" ground: a glowing TYPE-TINTED base + a dense scattered star field + a bright
  // core — echoes the Alive renderer's lit ground plane (Mewtwo's pink, water's blue, …). ──
  const gCx = 78, gCy = 150;
  const groundStars = Array.from({ length: 48 }, () => {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random());            // fill the disc fairly evenly, not a ring
    const x = (gCx + Math.cos(ang) * 64 * rad).toFixed(1);
    const y = (gCy + Math.sin(ang) * 17 * rad).toFixed(1); // flat orbital plane
    const front = Math.sin(ang) * 0.5 + 0.5;          // 0 behind → 1 toward viewer
    const r = (0.45 + front * 1.5 + Math.random() * 0.5).toFixed(1); // nearer = bigger
    const fill = Math.random() < 0.4 ? "#ffffff" : groundTint;
    const dly = (Math.random() * 3.4).toFixed(2);
    const dur = (2 + Math.random() * 1.8).toFixed(1);
    return `<circle class="gstar" cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="0.7" style="animation-delay:${dly}s;animation-duration:${dur}s"/>`;
  }).join("");
  const groundGlobe =
    `<ellipse cx="${gCx}" cy="${gCy}" rx="64" ry="19" fill="url(#groundGlow)"/>` +                    // wide soft glow
    `<ellipse cx="${gCx}" cy="${gCy}" rx="40" ry="11" fill="${groundTint}" fill-opacity="0.16"/>` +   // brighter inner pad
    `<ellipse cx="${gCx}" cy="${gCy}" rx="55" ry="13" fill="none" stroke="${groundTint}" stroke-opacity="0.18" stroke-width="1"/>` +
    `<ellipse cx="${gCx}" cy="${gCy}" rx="34" ry="8"  fill="none" stroke="${groundTint}" stroke-opacity="0.13" stroke-width="1"/>` +
    groundStars +
    `<ellipse class="sprGlow" cx="${gCx}" cy="${gCy}" rx="9" ry="4" fill="#ffffff" fill-opacity="0.85"/>` + // bright crystalline core
    `<circle cx="${gCx}" cy="${gCy}" r="1.8" fill="#ffffff"/>`;

  // ── Speech bubble (the companion's live thought) ─────────────────────────────
  const bubW = Math.min(340, 36 + s.thought.length * 6.8);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hearthmon — ${esc(s.thought)}">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="${bg1}"/>
      <stop offset="50%"  stop-color="${bg3}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>

    <!-- Sprite glow -->
    <radialGradient id="sprGlow" cx="50%" cy="60%" r="50%">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>

    <!-- Snow-globe ground glow (echoes the Alive renderer's lit base; type-tinted) -->
    <radialGradient id="groundGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${groundTint}" stop-opacity="0.42"/>
      <stop offset="55%"  stop-color="${groundTint}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${groundTint}" stop-opacity="0"/>
    </radialGradient>

    <!-- Aurora blobs -->
    <radialGradient id="aur1" cx="20%" cy="40%" r="45%">
      <stop offset="0%"   stop-color="${aurora1}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${aurora1}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="aur2" cx="80%" cy="60%" r="40%">
      <stop offset="0%"   stop-color="${aurora2}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${aurora2}" stop-opacity="0"/>
    </radialGradient>

    <!-- Chip glint -->
    <linearGradient id="chipGlint" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="white" stop-opacity="0"/>
      <stop offset="50%"  stop-color="white" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    ${clipDef}

    <style>
      /* deliberate typography — never the browser's default serif */
      text { font-family: 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif; }

      /* the card is decoration-dense; respect viewers who opt out of motion
         (initially-invisible bits like the heart and particles simply stay hidden) */
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }

      /*
       * ── SPRITE MOVEMENT SYSTEM ───────────────────────────────────────────
       */

      /* gentle, BOUNDED idle: a small drift left/right + a little hop — never leaves the card */
      .monWrap {
        transform-box: fill-box;
        transform-origin: 50% 100%;
        animation: monSway 11s ease-in-out infinite;
      }

      .mon {
        transform-box: fill-box;
        transform-origin: 50% 100%;
        animation: monBreathe 3.8s ease-in-out infinite;
        image-rendering: pixelated;
      }

      .shadow {
        transform-box: fill-box;
        transform-origin: 50% 50%;
        animation: shadowSway 11s ease-in-out infinite;
      }

      @keyframes monSway {
        0%   { transform: translate(0,0)       rotate(0deg); }
        14%  { transform: translate(-4px,0)    rotate(-1.2deg); }
        26%  { transform: translate(-3px,-7px) rotate(0deg); }
        34%  { transform: translate(0,0)       rotate(0deg); }
        54%  { transform: translate(4px,0)     rotate(1.2deg); }
        66%  { transform: translate(3px,-7px)  rotate(0deg); }
        74%  { transform: translate(0,0)       rotate(0deg); }
        100% { transform: translate(0,0)       rotate(0deg); }
      }
      @keyframes shadowSway {
        0%,100% { transform: translateX(0)    scale(1);    opacity: 0.32; }
        14%     { transform: translateX(-4px) scale(1);    opacity: 0.32; }
        26%     { transform: translateX(-3px) scale(0.78); opacity: 0.2; }
        34%     { transform: translateX(0)    scale(1);    opacity: 0.32; }
        54%     { transform: translateX(4px)  scale(1);    opacity: 0.32; }
        66%     { transform: translateX(3px)  scale(0.78); opacity: 0.2; }
        74%     { transform: translateX(0)    scale(1);    opacity: 0.32; }
      }
      /* a heart drifts up every ~9s and stays on screen ~2.5s — long enough to
         actually be seen. CSS-only so it animates on GitHub (README cards render
         as images, which have no hover/pointer events) */
      .heart {
        opacity: 0;
        transform-box: fill-box;
        transform-origin: center;
        animation: heartFloat 9s ease-out infinite;
      }
      @keyframes heartFloat {
        0%   { opacity: 0;    transform: translateY(0)     scale(0.4);  }
        5%   { opacity: 1;    transform: translateY(-6px)  scale(1.05); }
        18%  { opacity: 0.85; transform: translateY(-20px) scale(0.95); }
        28%  { opacity: 0;    transform: translateY(-34px) scale(0.8);  }
        100% { opacity: 0;    transform: translateY(-34px) scale(0.8);  }
      }

      .sprGlow {
        transform-box: fill-box;
        transform-origin: center;
        animation: glowPulse 4s ease-in-out infinite;
      }

      .gstar { animation-name: gtwinkle; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
      @keyframes gtwinkle { 0%,100% { opacity: 0.18; } 50% { opacity: 1; } }
      .pt { opacity: 0; animation: rise 4.4s ease-in-out infinite; }
      .bub { animation: bubFloat 5s ease-in-out infinite; }
      .aur  { animation: aurDrift  12s ease-in-out infinite alternate; }
      .aur2 { animation: aurDrift2 14s ease-in-out infinite alternate; }
      .chip     { animation: chipPulse 6s ease-in-out infinite; }
      .chipshine{ animation: chipSweep 6s ease-in-out infinite; }
      .footer { animation: footerPulse  7s ease-in-out infinite; }
      .borderShimmer { animation: borderPulse 4s ease-in-out infinite; }
      .nameShimmer { animation: namePulse 6s ease-in-out infinite; }

      @keyframes monBreathe {
        0%,100% { transform: scaleX(1)    scaleY(1)    translateY(0);    }
        40%     { transform: scaleX(0.97) scaleY(1.04) translateY(-2px); }
        70%     { transform: scaleX(1.01) scaleY(0.99) translateY(0);    }
      }

      @keyframes glowPulse {
        0%,100% { opacity: 0.5; transform: scale(1);    }
        50%     { opacity: 0.85; transform: scale(1.06); }
      }
      @keyframes rise {
        0%   { opacity: 0;   transform: translateY(0px)   rotate(0deg);  }
        15%  { opacity: 0.9; }
        80%  { opacity: 0.3; }
        100% { opacity: 0;   transform: translateY(-36px) rotate(25deg); }
      }
      @keyframes bubFloat {
        0%,100% { transform: translateY(0px);  opacity: 1;    }
        40%     { transform: translateY(-2px); opacity: 1;    }
        70%     { transform: translateY(-1px); opacity: 0.92; }
      }
      @keyframes aurDrift  {
        0%   { transform: translate(0px,  0px);  }
        50%  { transform: translate(18px, 8px);  }
        100% { transform: translate(4px,  14px); }
      }
      @keyframes aurDrift2 {
        0%   { transform: translate(0px,   0px);  }
        50%  { transform: translate(-12px, -6px); }
        100% { transform: translate(-4px,  10px); }
      }
      @keyframes chipPulse {
        0%,100% { opacity: 1;    }
        50%     { opacity: 0.75; }
      }
      @keyframes chipSweep {
        0%,100% { fill-opacity: 0;    }
        50%     { fill-opacity: 0.55; }
      }
      @keyframes footerPulse {
        0%,100% { opacity: 0.6; }
        50%     { opacity: 0.9; }
      }
      @keyframes borderPulse {
        0%,100% { stroke-opacity: 0.3; }
        50%     { stroke-opacity: 0.8; }
      }
      @keyframes namePulse {
        0%,100% { fill: ${textMain}; text-shadow: 0 0 0px rgba(255,255,255,0); }
        50%     { fill: #ffffff; text-shadow: 0 0 6px rgba(255,255,255,0.4); }
      }
      ${spriteAnimCss}
      ${field.css}
    </style>
  </defs>

  <!-- Base card fill -->
  <rect width="${W}" height="${H}" rx="16" fill="url(#bg)"/>

  <!-- Aurora blobs -->
  <ellipse class="aur"  cx="90"  cy="70"  rx="160" ry="100" fill="url(#aur1)"/>
  <ellipse class="aur2" cx="380" cy="110" rx="140" ry="90"  fill="url(#aur2)"/>

  <!-- Border -->
  <rect class="borderShimmer" x="0.5" y="0.5" width="${W-1}" height="${H-1}" rx="16"
        fill="none" stroke="${accent}" stroke-width="1.5"/>

  <!-- Sprite glow -->
  <ellipse class="sprGlow" cx="78" cy="96" rx="120" ry="108" fill="url(#sprGlow)"/>

  <!-- "Snow-globe" ground: glowing base + faint orbit rings + a twinkling orbital star band -->
  ${groundGlobe}

  <!-- Ground contact shadow (synced to monMove) -->
  <ellipse class="shadow" cx="78" cy="152" rx="40" ry="6" fill="#000" fill-opacity="0.3"/>

  <!-- Sparkle particles -->
  ${particleSvg}

  <!-- Type-based ambient effect (lightning / fire / rays / …) — behind the pet -->
  ${field.body}

  <!-- Sprite (bigger, grounded near the shadow) -->
  <g transform="translate(23,42)">
    <g class="monWrap">
      ${innerSprite}
    </g>
  </g>

  <!-- Affection heart — a real path (emoji glyphs vary per platform), drifts up every ~9s -->
  <g transform="translate(78,72)"><path class="heart" d="M0,2.2 C-2.8,-2.2 -8.8,-0.6 -8.8,3.9 C-8.8,8.3 -3.3,9.9 0,14.3 C3.3,9.9 8.8,8.3 8.8,3.9 C8.8,-0.6 2.8,-2.2 0,2.2 Z" fill="#ff7aa8"/></g>

  <!-- Current partner, labelled right under the companion -->
  <text x="78" y="170" font-size="10.5" text-anchor="middle" fill="${textDim}">currently beside you · <tspan fill="${accent}" font-weight="700">${esc(s.partner)}</tspan></text>

  <!-- Speech bubble — a thought, nudged toward the companion with a long soft tail -->
  <g class="bub">
    <rect x="116" y="14" rx="11" width="${bubW.toFixed(0)}" height="28"
          fill="${bubbleBg}" fill-opacity="0.95" stroke="${accent}" stroke-opacity="0.45" stroke-width="1"/>
    <rect x="120" y="16" rx="6"  width="${(bubW-8).toFixed(0)}" height="6"
          fill="white" fill-opacity="0.05"/>
    <path d="M124 42 q -7 17 -26 22 q 19 -2 30 -12 z" fill="${bubbleBg}" fill-opacity="0.95"/>
    <text x="130" y="33" font-size="12" fill="#e9e2fb">${esc(s.thought)}</text>
  </g>

  <!-- Layer 2: title (the product) + the money line + ONE concrete line (what this IS) -->
  <text class="nameShimmer" x="168" y="66" font-size="23" font-weight="800">${s.night ? "🌙" : "✦"} ${esc(title)}</text>
  <text x="168" y="${tagB ? 90 : 92}" font-size="14.5" fill="${accent}" font-weight="600">${esc(tagA)}</text>
  ${tagB ? `<text x="168" y="107" font-size="14.5" fill="${accent}" font-weight="600">${esc(tagB)}</text>` : ""}
  ${s.sub ? `<text x="168" y="${tagB ? 122 : 108}" font-size="10.5" fill="${textDim}">${esc(s.sub)}</text>` : ""}

  <!-- Layer 3: narrative aliveness chips -->
  ${chipSvg}

  <!-- Layer 4: factual proof of life under the chips, a soft directional call bottom-right -->
  ${s.stats ? `<text x="168" y="164" font-size="10.5" fill="${textDim}">${esc(s.stats)}</text>` : ""}
  <text class="footer" x="${W - 18}" y="${H - 11}" text-anchor="end" font-size="11" fill="${accent}" fill-opacity="0.9">${esc(s.cta)}</text>

</svg>`;
}
