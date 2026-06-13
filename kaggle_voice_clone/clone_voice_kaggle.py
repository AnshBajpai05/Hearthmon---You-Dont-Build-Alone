"""Hearthmon voice cloning — Kaggle / Linux GPU edition.

Clones the trainer voice from the reference clips in reference_clips/ using
Coqui XTTS v2 (zero-shot), then generates lines into results/:

    results/go-<species>.mp3   "<Species>! I choose you!"   (used on every throw)
    results/<species>.mp3      "<Species>!"                 (name call before the cry)

Download results/ when done and drop the files into the app's static/voice/.

Runs great on a Kaggle P100 or T4 (and T4x2 — it only needs one GPU).
PERSONAL USE ONLY — this clones a real voice actor's voice; never publish/redistribute.

Run:
    python clone_voice_kaggle.py                      # uses species.txt
    python clone_voice_kaggle.py pikachu charizard    # ad-hoc species
    python clone_voice_kaggle.py --name-only gengar   # just "Gengar!" -> gengar.mp3
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REF_DIR = HERE / "reference_clips"
OUT_DIR = HERE / "results"
REF_WAV = OUT_DIR / "_reference.wav"


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def pretty(name: str) -> str:
    return " ".join(w.capitalize() for w in re.split(r"[-\s]+", name.strip()))


def build_reference() -> Path:
    """Concatenate the reference clips into one clean 22.05kHz mono wav."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    clips = sorted([*REF_DIR.glob("*.mp3"), *REF_DIR.glob("*.wav")])
    if not clips:
        sys.exit(f"No reference clips in {REF_DIR} — add a few .mp3 voice samples first.")
    listfile = OUT_DIR / "_ref_list.txt"
    listfile.write_text("\n".join(f"file '{p.as_posix()}'" for p in clips), encoding="utf-8")
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "concat", "-safe", "0", "-i", str(listfile),
         "-ar", "22050", "-ac", "1", str(REF_WAV)],
        check=True,
    )
    listfile.unlink(missing_ok=True)
    print(f"[ref] built from {len(clips)} clips -> {REF_WAV.name}")
    return REF_WAV


def read_species() -> list[tuple[str, str]]:
    """species.txt: one per line. 'pikachu' or 'pikachu | custom line'. # = comment."""
    f = HERE / "species.txt"
    jobs: list[tuple[str, str]] = []
    if not f.exists():
        return jobs
    for raw in f.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "|" in line:
            name, text = (s.strip() for s in line.split("|", 1))
            jobs.append((slug(name or text), text))
        else:
            jobs.append((slug(line), f"{pretty(line)}! I choose you!"))
    return jobs


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("species", nargs="*", help="species to generate (overrides species.txt)")
    ap.add_argument("--name-only", action="store_true",
                    help='generate just "<Name>!" -> <species>.mp3')
    ap.add_argument("--also-names", action="store_true",
                    help="also emit <species>.mp3 name calls alongside go-lines")
    args = ap.parse_args()

    ref = build_reference()

    os.environ.setdefault("COQUI_TOS_AGREED", "1")
    import torch  # noqa: E402
    from TTS.api import TTS  # noqa: E402

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[xtts] loading model on {device} (first run downloads ~1.8 GB)…")
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

    # build the job list
    jobs: list[tuple[str, str]] = []
    if args.species:
        for sp in args.species:
            jobs.append((slug(sp), f"{pretty(sp)}!" if args.name_only
                         else f"{pretty(sp)}! I choose you!"))
    else:
        jobs = read_species()
        if args.name_only:
            jobs = [(s, f"{pretty(s)}!") for s, _ in jobs]
    if not jobs:
        sys.exit("Nothing to generate. Edit species.txt or pass species on the CLI.")

    if args.also_names and not args.name_only:
        jobs += [(s, f"{pretty(s.split('|')[0])}!") for s, _ in jobs]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for i, (stem, text) in enumerate(jobs, 1):
        # name-only -> "<species>.mp3"; full throw line -> "go-<species>.mp3"
        out_name = f"{stem}.mp3" if args.name_only else f"go-{stem}.mp3"
        wav = OUT_DIR / f"{stem}.wav"
        tts.tts_to_file(text=text, speaker_wav=str(ref), language="en", file_path=str(wav))
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(wav), "-q:a", "4", str(OUT_DIR / out_name)],
            check=True,
        )
        wav.unlink(missing_ok=True)
        print(f"  [{i}/{len(jobs)}] {out_name}  <-  \"{text}\"")

    REF_WAV.unlink(missing_ok=True)
    print(f"\nDone — {len(jobs)} clips in {OUT_DIR}")
    print("Download results/ and drop the .mp3s into the app's static/voice/ folder.")


if __name__ == "__main__":
    main()
