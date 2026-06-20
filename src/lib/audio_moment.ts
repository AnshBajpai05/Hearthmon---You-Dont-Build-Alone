// The Moment Engine (audio awareness v2). Instead of a binary "is this music?", score how confident
// we are this is a LISTENING moment by combining VOTES: audio confidence + the audio SOURCE (process
// category) + how long it's stayed music-LIKE (persistence) + what the user has TAUGHT us (corrections).
// WASAPI session detection and YAMNet slot in later as stronger / extra votes — NOT rewrites.
//
// Key trick: persistence accrues ONLY while the audio is music-like, so a talking tutorial/podcast in
// the background never builds up — separating "coding to music" from "coding with a tutorial on"
// without even knowing the source. (Soul: react only on a confident moment; when unsure, ask once.)
export type AudioSourceCat = "music" | "comms" | "browser" | "editor" | "terminal" | "other" | "";

export interface MomentInputs {
  musical: number; // 0..1 detector confidence (steady kick tempo)
  source: AudioSourceCat; // process category (→ real WASAPI audio-session source later)
  sustainedS: number; // seconds the audio has stayed music-like (persistence)
  bias: number; // -1..+1 learned from the user's corrections for this source
  // YAMNet vote (the strong one): independent sigmoid probs that this 0.96s is Music / Speech.
  // This is the signal the DSP heuristics provably can't produce — a talking video reads speech≫music
  // and gets vetoed; real music reads music≫speech and is confirmed. Both 0 ⇒ no vote (model off).
  yamnetMusic?: number;
  yamnetSpeech?: number;
}
export interface Moment {
  score: number; // 0..1 confidence this is a listening moment
  band: "react" | "ask" | "quiet";
}

// process vote: a dedicated media app is a strong + (and it IS music); a call is strongly negative; an
// editor/terminal is only a faint + (the background source is UNKNOWN → persistence decides); a
// browser is neutral (the ambiguous bucket — lean on audio + corrections, the Layer-2.5 case).
const PROC: Record<AudioSourceCat, number> = {
  music: 0.45,
  comms: -0.8,
  editor: 0.05,
  terminal: 0.05,
  browser: 0,
  other: 0,
  "": 0
};

export function momentScore(i: MomentInputs): Moment {
  const audio = (i.musical - 0.45) * 1.1; // centred ~ -0.5 … +0.6
  const proc = PROC[i.source] ?? 0;
  const persist = Math.min(0.18, Math.max(0, i.sustainedS) / 700); // up to +0.18 after ~2 min steady
  let score = 0.5 + audio * 0.55 + proc + persist + i.bias * 0.4;
  // YAMNet vote — strong because it's the one signal that actually KNOWS speech from music. A high
  // music prob lifts toward react; a high speech prob vetoes (so a YouTube talking video can't react
  // even when it's loud + steady). Weighted to dominate when confident; neutral when both are low.
  const ym = i.yamnetMusic ?? 0;
  const ys = i.yamnetSpeech ?? 0;
  if (ym > 0 || ys > 0) score += (ym - ys) * 0.6;
  score = Math.max(0, Math.min(1, score));
  const band: Moment["band"] = score >= 0.7 ? "react" : score >= 0.5 ? "ask" : "quiet";
  return { score: +score.toFixed(3), band };
}
