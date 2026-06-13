// Living-companion README card — an ANIMATED, self-contained SVG snapshot of
// the pet's current state. Loaded via <img> on GitHub, so the browser runs the
// CSS @keyframes while GitHub's sanitizer stays out of the way. No scripts, no
// external refs: the sprite is embedded as a base64 data-URI.

export interface CardState {
  name: string;
  species: string;
  bond: string;
  personaIcon: string;
  personaLabel: string;
  status: string; // the spoken quip in the bubble
  commits: number;
  days: number;
  night: boolean;
  sprite?: string; // base64 PNG data-URI of the companion (optional)
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Build the animated README status card as an SVG string. */
export function buildCard(s: CardState): string {
  const W = 480;
  const H = 172;

  // Night mode shifts palette toward cooler purples; day is warmer indigo
  const bg1       = s.night ? "#0d0b18" : "#1a1530";
  const bg2       = s.night ? "#1e1738" : "#251e40";
  const bg3       = s.night ? "#12102a" : "#201c38";
  const aurora1   = s.night ? "#6a4fcf" : "#7b5ea7";
  const aurora2   = s.night ? "#3d6bcf" : "#5468c4";
  const accent    = s.night ? "#c4a0f0" : "#f0b66a";
  const accentDim = s.night ? "#7a55c0" : "#b07840";
  const textMain  = "#f6f1ff";
  const textSub   = "#c9bff0";
  const textDim   = "#8d82ab";
  const bubbleBg  = "#160f24";

  // ── Chips ──────────────────────────────────────────────────────────────────
  const chips = [s.bond, s.personaLabel ? `${s.personaIcon} ${s.personaLabel}`.trim() : ""]
    .filter(Boolean)
    .map(esc);
  let chipX = 168;
  const chipSvg = chips
    .map((c, i) => {
      const w = 16 + c.length * 7;
      const x = chipX;
      chipX += w + 8;
      const delay = `${i * 0.6}s`;
      return `<g class="chip" style="animation-delay:${delay}">` +
        `<rect x="${x}" y="98" rx="9" width="${w.toFixed(0)}" height="20" ` +
        `fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-opacity="0.5"/>` +
        `<rect x="${x}" y="98" rx="9" width="${w.toFixed(0)}" height="20" ` +
        `fill="url(#chipGlint)" fill-opacity="0" class="chipshine"/>` +
        `<text x="${(x + w / 2).toFixed(0)}" y="112" font-size="11" fill="${accent}" ` +
        `text-anchor="middle">${c}</text>` +
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
  const innerSprite = s.sprite
    ? `<image class="mon" href="${s.sprite}" x="0" y="0" width="96" height="96" preserveAspectRatio="xMidYMax meet"/>`
    : `<text class="mon" x="48" y="72" font-size="54" text-anchor="middle">${s.personaIcon || "🐾"}</text>`;

  const spriteEl = `<g class="monWrap" style="transform-origin:74px 144px">${innerSprite}</g>`;

  // ── Speech bubble ──────────────────────────────────────────────────────────
  const bubW = Math.min(340, 36 + s.status.length * 6.8);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hearthmon — ${esc(s.name)}, ${esc(s.status)}">
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
        0%   { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        5%   { transform: translateY(-1px)  scaleX(1)    scaleY(1)    rotate(0deg); }
        8%   { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        10%  { transform: translateY(3px)   scaleX(1.06) scaleY(0.92) rotate(0deg); }
        13%  { transform: translateY(-22px) scaleX(0.88) scaleY(1.16) rotate(-2deg); }
        15%  { transform: translateY(-10px) scaleX(0.92) scaleY(1.10) rotate(-1deg); }
        16%  { transform: translateY(0)     scaleX(1.25) scaleY(0.78) rotate(0deg); }
        18%  { transform: translateY(-9px)  scaleX(0.94) scaleY(1.08) rotate(1deg); }
        20%  { transform: translateY(0)     scaleX(1.10) scaleY(0.92) rotate(0deg); }
        21%  { transform: translateY(-3px)  scaleX(0.98) scaleY(1.03) rotate(0deg); }
        23%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        28%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(-6deg); }
        34%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(6deg); }
        38%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(-2deg); }
        42%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        50%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        51%  { transform: translateY(2px)   scaleX(1.04) scaleY(0.95) rotate(0deg); }
        52%  { transform: translateY(-11px) scaleX(0.93) scaleY(1.10) rotate(1deg); }
        53%  { transform: translateY(0)     scaleX(1.15) scaleY(0.86) rotate(0deg); }
        55%  { transform: translateY(-2px)  scaleX(0.99) scaleY(1.02) rotate(0deg); }
        57%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        60%  { transform: translateY(-1px)  scaleX(1)    scaleY(1)    rotate(-5deg); }
        62%  { transform: translateY(-1px)  scaleX(1)    scaleY(1)    rotate(5deg); }
        64%  { transform: translateY(-1px)  scaleX(1)    scaleY(1)    rotate(-4deg); }
        66%  { transform: translateY(-1px)  scaleX(1)    scaleY(1)    rotate(4deg); }
        68%  { transform: translateY(-1px)  scaleX(1)    scaleY(1)    rotate(-2deg); }
        70%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        74%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        84%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        85%  { transform: translateY(3px)   scaleX(1.06) scaleY(0.92) rotate(0deg); }
        87%  { transform: translateY(-22px) scaleX(0.88) scaleY(1.16) rotate(2deg); }
        88%  { transform: translateY(-8px)  scaleX(0.92) scaleY(1.10) rotate(1deg); }
        89%  { transform: translateY(0)     scaleX(1.25) scaleY(0.78) rotate(0deg); }
        90%  { transform: translateY(-7px)  scaleX(0.95) scaleY(1.06) rotate(-1deg); }
        91%  { transform: translateY(0)     scaleX(1.08) scaleY(0.94) rotate(0deg); }
        93%  { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
        100% { transform: translateY(0)     scaleX(1)    scaleY(1)    rotate(0deg); }
      }

      @keyframes monBreathe {
        0%,100% { transform: scaleX(1)    scaleY(1)    translateY(0);    }
        40%     { transform: scaleX(0.97) scaleY(1.04) translateY(-2px); }
        70%     { transform: scaleX(1.01) scaleY(0.99) translateY(0);    }
      }

      @keyframes shadowMove {
        0%   { transform: scaleX(1)    scaleY(1);    opacity: 0.32; }
        10%  { transform: scaleX(1.05) scaleY(1.05); opacity: 0.38; } 
        13%  { transform: scaleX(0.55) scaleY(0.4);  opacity: 0.12; } 
        15%  { transform: scaleX(0.7)  scaleY(0.55); opacity: 0.18; } 
        16%  { transform: scaleX(1.4)  scaleY(1.35); opacity: 0.55; } 
        18%  { transform: scaleX(0.8)  scaleY(0.65); opacity: 0.20; } 
        20%  { transform: scaleX(1.15) scaleY(1.12); opacity: 0.42; } 
        23%  { transform: scaleX(1)    scaleY(1);    opacity: 0.32; } 
        51%  { transform: scaleX(1.03) scaleY(1.03); opacity: 0.36; } 
        52%  { transform: scaleX(0.7)  scaleY(0.55); opacity: 0.16; } 
        53%  { transform: scaleX(1.2)  scaleY(1.15); opacity: 0.48; } 
        57%  { transform: scaleX(1)    scaleY(1);    opacity: 0.32; } 
        85%  { transform: scaleX(1.05) scaleY(1.05); opacity: 0.38; } 
        87%  { transform: scaleX(0.55) scaleY(0.4);  opacity: 0.12; } 
        89%  { transform: scaleX(1.4)  scaleY(1.35); opacity: 0.55; } 
        91%  { transform: scaleX(1.08) scaleY(1.06); opacity: 0.38; } 
        93%  { transform: scaleX(1)    scaleY(1);    opacity: 0.32; }
        100% { transform: scaleX(1)    scaleY(1);    opacity: 0.32; }
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
  <ellipse class="sprGlow" cx="74" cy="86" rx="110" ry="100" fill="url(#sprGlow)"/>

  <!-- Ground shadow (synced to monMove) -->
  <ellipse class="shadow" cx="74" cy="138" rx="38" ry="6" fill="#000" fill-opacity="0.38"/>

  <!-- Sparkle particles -->
  ${particleSvg}

  <!-- Sprite -->
  <g transform="translate(26,58)">
    <g class="monWrap">
      ${innerSprite}
    </g>
  </g>

  <!-- Speech bubble -->
  <g class="bub">
    <rect x="118" y="16" rx="10" width="${bubW.toFixed(0)}" height="28"
          fill="${bubbleBg}" fill-opacity="0.94" stroke="${accent}" stroke-opacity="0.45" stroke-width="1"/>
    <rect x="122" y="18" rx="6"  width="${(bubW-8).toFixed(0)}" height="6"
          fill="white" fill-opacity="0.04"/>
    <path d="M128 44 l-10 11 l14 -5 z" fill="${bubbleBg}" fill-opacity="0.94"/>
    <text x="132" y="35" font-size="12" fill="#e9e2fb">${esc(s.status)}</text>
  </g>

  <!-- Hearthmon label -->
  <text class="label" x="168" y="62" font-size="14" font-weight="700" fill="${accent}">${s.night ? "🌙" : "✦"} Hearthmon</text>

  <!-- Companion name -->
  <text class="nameShimmer" x="168" y="86" font-size="20" font-weight="800">${esc(s.name)}</text>

  <!-- Chips -->
  ${chipSvg}

  <!-- Tagline -->
  <text x="168" y="142" font-size="12" fill="${textSub}">${s.night ? "🌙 coding by moonlight" : "✦ building, quietly"}</text>

  <!-- Footer -->
  <text class="footer" x="${W-18}" y="160" font-size="10" fill="${textDim}" text-anchor="end">${s.commits} commits · ${s.days} day${s.days !== 1 ? "s" : ""} together</text>

</svg>`;
}
