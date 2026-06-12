"""Split an audio file you own into voice clips for Hearthmon.

Detects silences with ffmpeg, cuts the audio into one mp3 per spoken phrase,
and drops them into static/voice/ as clip-01.mp3, clip-02.mp3, ...
Listen to each one, keep the good ones, and rename per static/voice/README.txt
(e.g. the best "I choose you!" becomes go.mp3).

Usage:
    python tools/split_clips.py <audiofile> [--min-silence 0.4] [--threshold -35]

    <audiofile>     any audio/video file ffmpeg can read (mp3, wav, m4a, mp4...)
    --min-silence   seconds of quiet that separate two clips (default 0.4)
    --threshold     silence level in dB (default -35; raise to -30 if clips merge,
                    lower to -40 if clips get chopped mid-word)
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

VOICE_DIR = Path(__file__).resolve().parent.parent / "static" / "voice"


def ffmpeg(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["ffmpeg", "-hide_banner", *args], capture_output=True, text=True
    )


def detect_silences(src: Path, threshold: int, min_silence: float) -> list[tuple[float, float]]:
    """Return [(silence_start, silence_end), ...] from ffmpeg's silencedetect."""
    proc = ffmpeg(
        "-i", str(src),
        "-af", f"silencedetect=noise={threshold}dB:d={min_silence}",
        "-f", "null", "-",
    )
    log = proc.stderr
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", log)]
    return list(zip(starts, ends))


def duration_of(src: Path) -> float:
    proc = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(src)],
        capture_output=True, text=True,
    )
    try:
        return float(proc.stdout.strip())
    except ValueError:
        sys.exit(f"could not read duration of {src}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("audiofile", type=Path)
    ap.add_argument("--min-silence", type=float, default=0.4)
    ap.add_argument("--threshold", type=int, default=-35)
    ap.add_argument("--min-clip", type=float, default=0.35,
                    help="discard clips shorter than this many seconds")
    args = ap.parse_args()

    src = args.audiofile
    if not src.exists():
        sys.exit(f"file not found: {src}")
    VOICE_DIR.mkdir(parents=True, exist_ok=True)

    total = duration_of(src)
    silences = detect_silences(src, args.threshold, args.min_silence)
    print(f"{src.name}: {total:.1f}s, {len(silences)} silences found")

    # speech segments = the gaps between silences
    segments: list[tuple[float, float]] = []
    cursor = 0.0
    for s_start, s_end in silences:
        if s_start - cursor >= args.min_clip:
            segments.append((cursor, s_start))
        cursor = s_end
    if total - cursor >= args.min_clip:
        segments.append((cursor, total))

    if not segments:
        sys.exit("no speech segments found — try --threshold -30")

    pad = 0.12  # keep a tiny breath either side
    for i, (a, b) in enumerate(segments, 1):
        out = VOICE_DIR / f"clip-{i:02d}.mp3"
        ffmpeg(
            "-y",
            "-ss", str(max(0, a - pad)),
            "-to", str(min(total, b + pad)),
            "-i", str(src),
            "-q:a", "4",
            str(out),
        )
        print(f"  clip-{i:02d}.mp3  {a:7.2f}s - {b:7.2f}s  ({b - a:.2f}s)")

    print(f"\n{len(segments)} clips written to {VOICE_DIR}")
    print("Listen, keep the good ones, rename per static/voice/README.txt:")
    print('  best "I choose you!" -> go.mp3   |   per-species -> go-pikachu.mp3')


if __name__ == "__main__":
    main()
