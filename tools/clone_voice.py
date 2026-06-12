"""Clone the trainer's voice locally (free, offline) and pre-generate lines.

Uses Coqui XTTS v2 zero-shot voice cloning, conditioned on the real clips
already in static/voice/ (the ones cut from your own audio). Generates
"<Species>, I choose you!" as go-<species>.mp3 — the app automatically
prefers these over everything else.

PERSONAL USE ONLY. This clones a real voice actor's voice; never publish
or redistribute the generated audio. XTTS v2's license (CPML) is
non-commercial as well.

Usage:
    python tools/clone_voice.py charizard pikachu "tapu koko"
    python tools/clone_voice.py --text "Let's go, buddy!" --out lets-go-buddy
    python tools/clone_voice.py --name-only gengar     (just "Gengar!" -> gengar.mp3)

First run downloads the XTTS v2 model (~1.8 GB) and builds a reference
sample from your best clips. Each line takes ~10-30s on CPU.
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

VOICE = Path(__file__).resolve().parent.parent / "static" / "voice"
REF = VOICE / "_ash_reference.wav"
# clean, speech-dense clips make the best cloning reference (~10s total)
REF_CLIPS = [
    "im-ash-from-pallet-town.mp3",
    "my-dream-is-to-become.mp3",
    "i-choose-you.mp3",
    "lets-go-catch-some-pokemon.mp3",
    "we-should-have-a-battle.mp3",
]


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def pretty(name: str) -> str:
    return " ".join(w.capitalize() for w in re.split(r"[-\s]+", name.strip()))


def build_reference() -> None:
    if REF.exists():
        return
    clips = [VOICE / c for c in REF_CLIPS if (VOICE / c).exists()]
    if not clips:
        sys.exit("no reference clips found in static/voice — run caption_split.py first")
    listfile = VOICE / "_ref_list.txt"
    listfile.write_text("\n".join(f"file '{p.as_posix()}'" for p in clips), encoding="utf-8")
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "concat", "-safe", "0", "-i", str(listfile),
         "-ar", "22050", "-ac", "1", str(REF)],
        check=True,
    )
    listfile.unlink()
    print(f"reference voice built from {len(clips)} clips -> {REF.name}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("species", nargs="*", help="species names to generate go-lines for")
    ap.add_argument("--text", help="custom line instead of the go-line")
    ap.add_argument("--out", help="output name (without .mp3) for --text")
    ap.add_argument("--name-only", action="store_true",
                    help="generate just the species name (for <species>.mp3)")
    args = ap.parse_args()
    if not args.species and not args.text:
        sys.exit("give species names or --text. see --help")

    build_reference()

    os.environ.setdefault("COQUI_TOS_AGREED", "1")
    print("loading XTTS v2 (first run downloads ~1.8 GB)…")
    from TTS.api import TTS  # noqa: E402 — heavy import after the cheap checks

    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")

    jobs: list[tuple[str, str]] = []  # (text, out-stem)
    if args.text:
        jobs.append((args.text, args.out or slug(args.text)[:40]))
    for sp in args.species:
        name = pretty(sp)
        if args.name_only:
            jobs.append((f"{name}!", slug(sp)))
        else:
            jobs.append((f"{name}! I choose you!", f"go-{slug(sp)}"))

    for text, stem in jobs:
        out = VOICE / f"{stem}.mp3"
        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / "out.wav"
            tts.tts_to_file(
                text=text,
                speaker_wav=str(REF),
                language="en",
                file_path=str(wav),
            )
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                 "-i", str(wav), "-q:a", "4", str(out)],
                check=True,
            )
        print(f'  {out.name}  <- "{text}"')

    print(f"\ndone — {len(jobs)} clips in {VOICE}")
    print("the app uses go-<species>.mp3 automatically on that species' throw.")


if __name__ == "__main__":
    main()
