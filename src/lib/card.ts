// Living-companion README card — an ANIMATED, self-contained SVG snapshot of
// the pet's current state. Loaded via <img> on GitHub, so the browser runs the
// CSS @keyframes while GitHub's sanitizer stays out of the way. No scripts, no
// external refs: the sprite is embedded as a base64 data-URI.

export interface CardState {
  thought: string; // Layer 1 — a live COMPANION thought ("still here with this one")
  tagline: string; // Layer 2 — the money line / identity, under the title (wraps)
  chips: { icon: string; label: string }[]; // Layer 3 — narrative aliveness
  cta: string; // Layer 4 — a soft call ("see what it noticed →")
  footer: string; // emotional counterweight ("still growing")
  partner: string; // the companion's name, labelled under the sprite
  night: boolean;
  sprite?: string; // base64 data-URI of the companion (a static PNG, OR a frame STRIP)
  spriteFrames?: number; // >1 → `sprite` is a horizontal sprite-sheet; play it
  spriteFw?: number; // a single frame's width in the strip
  spriteFh?: number; // a single frame's height in the strip
  spriteDur?: number; // seconds for one full loop (matches the source GIF timing)
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

/** Build the animated README status card as an SVG string. */
export function buildCard(s: CardState): string {
  const W = 480;
  const H = 188;
  const title = s.title ?? "Hearthmon";

  // Night mode shifts palette toward cooler purples; day is warmer indigo
  const bg1       = s.night ? "#0d0b18" : "#1a1530";
  const bg2       = s.night ? "#1e1738" : "#251e40";
  const bg3       = s.night ? "#12102a" : "#201c38";
  const aurora1   = s.night ? "#6a4fcf" : "#7b5ea7";
  const aurora2   = s.night ? "#3d6bcf" : "#5468c4";
  const accent    = s.night ? "#c4a0f0" : "#f0b66a";
  const accentDim = s.night ? "#7a55c0" : "#b07840";
  const textMain  = "#f6f1ff";
  const textDim   = "#8d82ab";
  const bubbleBg  = "#160f24";

  // money line wraps to two lines if long — chips sit under it
  const [tagA, tagB] = wrap2(s.tagline, 34);

  // ── Narrative aliveness chips — width-aware single row ───────────────────────
  const CHIP_Y = tagB ? 126 : 114;
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
      /*
       * ── SPRITE MOVEMENT SYSTEM ───────────────────────────────────────────
       */

      .monWrap {
        transform-box: fill-box;
        transform-origin: 50% 100%;
        animation: monMove 18s cubic-bezier(0.45,0,0.55,1) infinite;
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
        animation: shadowMove 18s cubic-bezier(0.45,0,0.55,1) infinite;
      }

      .sprGlow {
        transform-box: fill-box;
        transform-origin: center;
        animation: glowPulse 4s ease-in-out infinite;
      }

      .pt { opacity: 0; animation: rise 4.4s ease-in-out infinite; }
      .bub { animation: bubFloat 5s ease-in-out infinite; }
      .aur  { animation: aurDrift  12s ease-in-out infinite alternate; }
      .aur2 { animation: aurDrift2 14s ease-in-out infinite alternate; }
      .chip     { animation: chipPulse 6s ease-in-out infinite; }
      .chipshine{ animation: chipSweep 6s ease-in-out infinite; }
      .label  { animation: labelTwinkle 8s ease-in-out infinite; }
      .footer { animation: footerPulse  7s ease-in-out infinite; }
      .borderShimmer { animation: borderPulse 4s ease-in-out infinite; }
      .nameShimmer { animation: namePulse 6s ease-in-out infinite; }

      @keyframes monMove {
        0%   { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        5%   { transform: translateY(-0.5px) scaleX(1)     scaleY(1)     rotate(0deg); }
        8%   { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        10%  { transform: translateY(1.5px)  scaleX(1.03)  scaleY(0.96)  rotate(0deg); }
        13%  { transform: translateY(-11px)  scaleX(0.94)  scaleY(1.08)  rotate(-1deg); }
        15%  { transform: translateY(-5px)   scaleX(0.96)  scaleY(1.05)  rotate(-0.5deg); }
        16%  { transform: translateY(0)      scaleX(1.13)  scaleY(0.89)  rotate(0deg); }
        18%  { transform: translateY(-4.5px) scaleX(0.97)  scaleY(1.04)  rotate(0.5deg); }
        20%  { transform: translateY(0)      scaleX(1.05)  scaleY(0.96)  rotate(0deg); }
        21%  { transform: translateY(-1.5px) scaleX(0.99)  scaleY(1.015) rotate(0deg); }
        23%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        28%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(-3deg); }
        34%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(3deg); }
        38%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(-1deg); }
        42%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        50%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        51%  { transform: translateY(1px)    scaleX(1.02)  scaleY(0.975) rotate(0deg); }
        52%  { transform: translateY(-5.5px) scaleX(0.965) scaleY(1.05)  rotate(0.5deg); }
        53%  { transform: translateY(0)      scaleX(1.075) scaleY(0.93)  rotate(0deg); }
        55%  { transform: translateY(-1px)   scaleX(0.995) scaleY(1.01)  rotate(0deg); }
        57%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        60%  { transform: translateY(-0.5px) scaleX(1)     scaleY(1)     rotate(-2.5deg); }
        62%  { transform: translateY(-0.5px) scaleX(1)     scaleY(1)     rotate(2.5deg); }
        64%  { transform: translateY(-0.5px) scaleX(1)     scaleY(1)     rotate(-2deg); }
        66%  { transform: translateY(-0.5px) scaleX(1)     scaleY(1)     rotate(2deg); }
        68%  { transform: translateY(-0.5px) scaleX(1)     scaleY(1)     rotate(-1deg); }
        70%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        74%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        84%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        85%  { transform: translateY(1.5px)  scaleX(1.03)  scaleY(0.96)  rotate(0deg); }
        87%  { transform: translateY(-11px)  scaleX(0.94)  scaleY(1.08)  rotate(1deg); }
        88%  { transform: translateY(-4px)   scaleX(0.96)  scaleY(1.05)  rotate(0.5deg); }
        89%  { transform: translateY(0)      scaleX(1.13)  scaleY(0.89)  rotate(0deg); }
        90%  { transform: translateY(-3.5px) scaleX(0.975) scaleY(1.03)  rotate(-0.5deg); }
        91%  { transform: translateY(0)      scaleX(1.04)  scaleY(0.97)  rotate(0deg); }
        93%  { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
        100% { transform: translateY(0)      scaleX(1)     scaleY(1)     rotate(0deg); }
      }

      @keyframes monBreathe {
        0%,100% { transform: scaleX(1)    scaleY(1)    translateY(0);    }
        40%     { transform: scaleX(0.97) scaleY(1.04) translateY(-2px); }
        70%     { transform: scaleX(1.01) scaleY(0.99) translateY(0);    }
      }

      @keyframes shadowMove {
        0%   { transform: scaleX(1)     scaleY(1);     opacity: 0.32; }
        10%  { transform: scaleX(1.025) scaleY(1.025); opacity: 0.35; }
        13%  { transform: scaleX(0.775) scaleY(0.7);   opacity: 0.22; }
        15%  { transform: scaleX(0.85)  scaleY(0.775); opacity: 0.25; }
        16%  { transform: scaleX(1.2)   scaleY(1.175); opacity: 0.435; }
        18%  { transform: scaleX(0.9)   scaleY(0.825); opacity: 0.26; }
        20%  { transform: scaleX(1.075) scaleY(1.06);  opacity: 0.37; }
        23%  { transform: scaleX(1)     scaleY(1);     opacity: 0.32; }
        51%  { transform: scaleX(1.015) scaleY(1.015); opacity: 0.34; }
        52%  { transform: scaleX(0.85)  scaleY(0.775); opacity: 0.24; }
        53%  { transform: scaleX(1.1)   scaleY(1.075); opacity: 0.40; }
        57%  { transform: scaleX(1)     scaleY(1);     opacity: 0.32; }
        85%  { transform: scaleX(1.025) scaleY(1.025); opacity: 0.35; }
        87%  { transform: scaleX(0.775) scaleY(0.7);   opacity: 0.22; }
        89%  { transform: scaleX(1.2)   scaleY(1.175); opacity: 0.435; }
        91%  { transform: scaleX(1.04)  scaleY(1.03);  opacity: 0.35; }
        93%  { transform: scaleX(1)     scaleY(1);     opacity: 0.32; }
        100% { transform: scaleX(1)     scaleY(1);     opacity: 0.32; }
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
      @keyframes labelTwinkle {
        0%,100% { opacity: 1;    }
        48%     { opacity: 1;    }
        50%     { opacity: 0.5;  }
        52%     { opacity: 1;    }
        75%     { opacity: 0.85; }
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

  <!-- Ground shadow (synced to monMove) -->
  <ellipse class="shadow" cx="78" cy="152" rx="44" ry="6.5" fill="#000" fill-opacity="0.38"/>

  <!-- Sparkle particles -->
  ${particleSvg}

  <!-- Sprite (bigger, grounded near the shadow) -->
  <g transform="translate(23,42)">
    <g class="monWrap">
      ${innerSprite}
    </g>
  </g>

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

  <!-- Layer 2: title (the product) + the money line as its identity -->
  <text class="nameShimmer" x="168" y="68" font-size="23" font-weight="800">${s.night ? "🌙" : "✦"} ${esc(title)}</text>
  <text x="168" y="${tagB ? 92 : 94}" font-size="14.5" fill="${accent}" font-weight="600">${esc(tagA)}</text>
  ${tagB ? `<text x="168" y="111" font-size="14.5" fill="${accent}" font-weight="600">${esc(tagB)}</text>` : ""}

  <!-- Layer 3: narrative aliveness chips -->
  ${chipSvg}

  <!-- Layer 4: a soft call + factual counterweight, clustered together on the right -->
  <text class="footer" x="${W - 18}" y="${H - 11}" text-anchor="end">
    <tspan font-size="11" fill="${accent}" fill-opacity="0.9">${esc(s.cta)}</tspan>
    <tspan font-size="10" fill="${textDim}"> · ${esc(s.footer)}</tspan>
  </text>

</svg>`;
}
