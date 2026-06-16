// Sound system: real game cries (PokéAPI), TTS voices, synthesized impacts.
// Three user-controllable channels (voice / cries / effects) + master mute.
// All best-effort: a missing file or blocked audio must never break anything.

let userEnabled = true; // the user's master mute preference
let suspended = false; // window hidden to tray → never speak/play to an empty screen
let enabled = true; // effective gate read by every play fn = userEnabled && !suspended
const vol = { voice: 0.65, cry: 0.4, fx: 0.55 };

export type Channel = keyof typeof vol;

function applySound(): void {
  enabled = userEnabled && !suspended;
  if (!enabled) {
    try {
      speechSynthesis.cancel(); // stop any in-flight + queued utterance immediately
    } catch {
      /* no tts */
    }
  }
}

export function setSoundEnabled(v: boolean): void {
  userEnabled = v;
  applySound();
}

/** Hard-mute everything while the window is hidden (tray); resume on show. Independent of
 *  the user's mute, so it never clobbers their preference. Cancels in-flight speech. */
export function setSoundSuspended(v: boolean): void {
  suspended = v;
  applySound();
}

export function setVolume(ch: Channel, v: number): void {
  vol[ch] = Math.min(1, Math.max(0, v));
}

export function getVolumes(): Record<Channel, number> {
  return { ...vol };
}

export function cryUrl(dexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${dexId}.ogg`;
}

/** emphasis 0..1 — scaled by the user's cry-channel volume. */
export function playCry(dexId: number, emphasis = 1): void {
  if (!enabled) return;
  try {
    const a = new Audio(cryUrl(dexId));
    a.volume = Math.min(1, Math.max(0, emphasis * vol.cry));
    void a.play().catch(() => {});
  } catch {
    // no audio device / blocked — stay silent
  }
}

// ---- TTS: prefer Windows "Natural" neural voices over the robotic legacy ones ----
let voicesCache: SpeechSynthesisVoice[] = [];
try {
  voicesCache = speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => {
    voicesCache = speechSynthesis.getVoices();
  };
} catch {
  /* no tts */
}

function bestVoice(): SpeechSynthesisVoice | null {
  try {
    if (!voicesCache.length) voicesCache = speechSynthesis.getVoices();
    const en = voicesCache.filter((v) => v.lang.toLowerCase().startsWith("en"));
    return (
      en.find((v) => /natural/i.test(v.name)) ??
      en.find((v) => /aria|jenny|guy|sonia|ryan|libby/i.test(v.name)) ??
      en[0] ??
      voicesCache[0] ??
      null
    );
  } catch {
    return null;
  }
}

function speak(text: string, pitch = 1, rate = 1, emphasis = 1, onend?: () => void): boolean {
  if (!enabled) return false;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = bestVoice();
    if (v) u.voice = v;
    u.pitch = pitch;
    u.rate = rate;
    u.volume = Math.min(1, Math.max(0, emphasis * vol.voice));
    if (onend) {
      u.onend = onend;
      u.onerror = onend;
    }
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

// ---- user-supplied voice clips (static/voice/) take priority over TTS ----
// Drop real audio clips there (personal use) and they play instead of synthesis:
//   voice/go-pikachu.mp3  → used for "Pikachu, go!" (per species)
//   voice/go.mp3          → generic trainer throw line (any species)
//   voice/pikachu.mp3     → the Pokémon announcing its own name
const kebab = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

function playClip(
  url: string,
  emphasis: number,
  channel: Channel,
  onMissing: () => void,
  onEnded?: () => void,
  rate = 1 // playback speed (1 = normal); used to slow the name-call clips
): void {
  if (!enabled) return;
  // a missing file can fire BOTH the error event and the play() rejection —
  // guard so the fallback chain runs exactly once
  let missed = false;
  const miss = () => {
    if (!missed) {
      missed = true;
      onMissing();
    }
  };
  try {
    const a = new Audio(url);
    a.volume = Math.min(1, Math.max(0, emphasis * vol[channel]));
    if (rate !== 1) a.playbackRate = rate;
    a.onerror = miss;
    if (onEnded) a.onended = onEnded;
    a.play().catch(miss);
  } catch {
    miss();
  }
}

/**
 * The throw call: "Charizard…" (species name, best TTS voice), flowing
 * straight into the real "I choose you!" clip if one exists in static/voice/.
 * A species-specific full clip (go-charizard.mp3) wins outright.
 */
export function announceGo(speciesName: string): void {
  const k = kebab(speciesName);
  playClip(`/voice/go-${k}.mp3`, 1, "voice", () => {
    const chooseYou = () =>
      playClip(`/voice/go.mp3`, 1, "voice", () => speak("I choose you!", 1.0, 1.05, 1));
    const spoke = speak(`${speciesName}…`, 1.0, 1.0, 1, chooseYou);
    if (!spoke) chooseYou();
  });
}

/**
 * Play an optional trainer clip from static/voice/ — silently does nothing
 * if the file isn't there. `names` picks one at random; `chance` keeps
 * frequently-hit moments from getting spammy.
 */
export function playVoiceClip(names: string | string[], emphasis = 1, chance = 1): void {
  if (!enabled || Math.random() > chance) return;
  const list = Array.isArray(names) ? names : [names];
  const name = list[Math.floor(Math.random() * list.length)];
  playClip(`/voice/${name}.mp3`, emphasis, "voice", () => {});
}

/**
 * Cartoon-style self-announcement: the Pokémon "says" its own name,
 * then its official game cry follows. Uses a real clip if you provide one.
 */
export function voiceCry(dexId: number, speciesName: string, emphasis = 1): void {
  if (!enabled) return;
  const afterName = () => playCry(dexId, emphasis);
  playClip(
    `/voice/${kebab(speciesName)}.mp3`,
    emphasis,
    "voice",
    () => {
      const spoke = speak(speciesName, 1.7, 1.18, emphasis * 0.75, afterName);
      if (!spoke) afterName();
    },
    afterName,
    0.80 // normal name-call clips play a touch slower (the "go-" throw clips stay 1×)
  );
}

// ---- synthesized impact sounds (WebAudio, no files needed) ----
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  // Chromium starts the context suspended until a gesture; the call that reaches
  // here is almost always inside a click/commit reaction, so resume it.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** A short punchy thud — intensity 0..1, scaled by the effects channel. */
export function thump(intensity = 0.7): void {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const gain = intensity * vol.fx * 1.8;
  if (gain <= 0) return;
  try {
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(150 + 60 * intensity, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22 * gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.21);

    const len = Math.floor(c.sampleRate * 0.07);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = c.createBufferSource();
    n.buffer = buf;
    const ng = c.createGain();
    ng.gain.value = 0.09 * gain;
    n.connect(ng).connect(c.destination);
    n.start(t);
  } catch {
    // never let sound break a battle
  }
}

/** A short, soft sequence of sine notes on the fx channel — no audio file needed. */
function chime(freqs: number[], gain = 0.16, step = 0.08): void {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const level = gain * vol.fx;
  if (level <= 0) return;
  try {
    const start = c.currentTime + 0.04; // small lookahead so a just-resumed ctx doesn't drop note 1
    freqs.forEach((f, i) => {
      const t = start + i * step;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.26);
    });
  } catch {
    // sound is best-effort — never break a reaction over it
  }
}

// Coding-awareness cues: real sound files (static/sfx/) on the fx channel —
// these play through the reliable <audio> path. If a file is ever missing we
// fall back to the synthesized tone so there's always *something*.
/** A gentle blip when a commit lands. */
export function commitChime(): void {
  playClip("/sfx/commit.mp3", 1, "fx", () => chime([587.33, 880.0], 0.24, 0.08));
}
/** A bright little fanfare when a bug-fix lands. */
export function fixFanfare(): void {
  playClip("/sfx/bugfix.mp3", 1, "fx", () => chime([523.25, 659.25, 783.99, 1046.5], 0.28, 0.08));
}
/** PR merged / release published — a triumphant little rise. */
export function shipFanfare(): void {
  playClip("/sfx/ship.mp3", 1, "fx", () => chime([659.25, 880, 1046.5, 1318.5], 0.3, 0.07));
}
/** A bright open chime for a brand-new repo. */
export function newRepoChime(): void {
  playClip("/sfx/newrepo.mp3", 1, "fx", () => chime([523.25, 783.99, 1046.5], 0.26, 0.09));
}
/** A grand arpeggio for a commit milestone. */
export function milestoneFanfare(): void {
  playClip("/sfx/milestone.mp3", 1, "fx", () => chime([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.3, 0.08));
}

/**
 * Speak a short line aloud using the best available system voice (prefers the
 * Microsoft "Natural"/neural voices). The pet's spoken reaction to git activity.
 */
export function announce(text: string, emphasis = 1): void {
  speak(text, 1.02, 1.0, emphasis);
}

/**
 * Smoke-test playback for the Code panel's 🧪 buttons: plays a file at full
 * volume regardless of mute / channel volume, and logs the outcome. This is a
 * preview only — real git reactions still respect the user's sound settings.
 */
export function previewSfx(url: string): void {
  try {
    const a = new Audio(url);
    a.volume = 0.9;
    a.play()
      .then(() => console.info("[hearthmon] preview played:", url))
      .catch((err) => console.warn("[hearthmon] preview blocked:", url, err?.name ?? err));
  } catch (err) {
    console.warn("[hearthmon] preview threw:", err);
  }
}

/** Smoke-test TTS: speak at full volume regardless of mute, and report voices. */
export function previewSpeak(text: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn("[hearthmon] no speechSynthesis in this webview");
      return;
    }
    const voices = synth.getVoices();
    console.info(`[hearthmon] TTS voices available: ${voices.length}`, voices.map((v) => v.name).slice(0, 6));
    const u = new SpeechSynthesisUtterance(text);
    const v = bestVoice();
    if (v) u.voice = v;
    u.volume = 1;
    u.rate = 1;
    u.pitch = 1.02;
    u.onstart = () => console.info("[hearthmon] TTS started:", text);
    u.onerror = (e) => console.warn("[hearthmon] TTS error:", (e as SpeechSynthesisErrorEvent).error);
    synth.cancel();
    synth.speak(u);
  } catch (err) {
    console.warn("[hearthmon] previewSpeak threw:", err);
  }
}
