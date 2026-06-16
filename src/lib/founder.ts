// Founder's Mark — a faint signature woven into each habitat, meant to be *discovered* after a
// few seconds, never to compete with the pet or the calm. This is signature art direction, not a
// watermark. It is editable in a fork (frontend) by design; the real, unforgeable protection is
// the embedded cryptographic provenance (Rust `founder_mark`). Identity: AnshBajpai05.

const HANDLE = "AnshBajpai05";

// Adaptive phrasings so the mark "feels discovered" and varies per world.
const PHRASINGS = [
  `✦ quietly built by ${HANDLE}`,
  `hearthmon · ${HANDLE}`,
  `a quiet thing · ${HANDLE}`,
  `✦ hearthmon — ${HANDLE}`
];

// A rare spoken whisper — the only time the mark "speaks". ~1 in 100 idle murmurs, ~30s.
export const FOUNDER_WHISPER = "quietly built by anshbajpai05 ✦";
// Tunable odds per idle murmur tick (1/100). Edit here.
export const FOUNDER_WHISPER_ODDS = 0.01;

/** Stable per-seed pick (e.g. biome key/scene) so the phrasing is consistent within a world. */
export function founderMark(seedKey: string): string {
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) | 0;
  return PHRASINGS[Math.abs(h) % PHRASINGS.length];
}
