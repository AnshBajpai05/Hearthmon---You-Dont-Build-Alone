"""Caption-driven clip cutter: transcribe an audio file you own, cut one mp3
per spoken phrase, and name each clip from the words in it.

Works where silence-splitting fails (background music) because it cuts on
speech-recognition timestamps instead of audio level.

Usage:
    python tools/caption_split.py <audiofile>

Output goes to static/voice/ as e.g. "i-choose-you.mp3", "lets-go.mp3"...
A clip containing "i choose you" is also copied to go.mp3 automatically
(that's the one Hearthmon plays on every Pokéball throw).
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

from faster_whisper import WhisperModel

VOICE_DIR = Path(__file__).resolve().parent.parent / "static" / "voice"
PAD = 0.15  # seconds of breathing room either side of a phrase


def slug(text: str, max_words: int = 5) -> str:
    words = re.findall(r"[a-z0-9']+", text.lower())[:max_words]
    return "-".join(w.replace("'", "") for w in words) or "clip"


def cut(src: Path, start: float, end: float, out: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-ss", str(max(0, start - PAD)), "-to", str(end + PAD),
         "-i", str(src), "-q:a", "4", str(out)],
        check=True,
    )


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    if not src.exists():
        sys.exit(f"file not found: {src}")
    VOICE_DIR.mkdir(parents=True, exist_ok=True)

    print("loading model (first run downloads ~145MB)…")
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    print(f"transcribing {src.name}…")
    segments, _info = model.transcribe(str(src), vad_filter=True, word_timestamps=False)

    used: dict[str, int] = {}
    rows: list[tuple[str, float, float, str]] = []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        base = slug(text)
        used[base] = used.get(base, 0) + 1
        name = f"{base}.mp3" if used[base] == 1 else f"{base}-{used[base]}.mp3"
        cut(src, seg.start, seg.end, VOICE_DIR / name)
        rows.append((name, seg.start, seg.end, text))
        print(f"  {seg.start:7.2f}s-{seg.end:7.2f}s  {name:<38} | {text}")

    if not rows:
        sys.exit("no speech recognized")

    # auto-wire the throw line
    for name, _a, _b, text in rows:
        if "i choose you" in text.lower():
            shutil.copyfile(VOICE_DIR / name, VOICE_DIR / "go.mp3")
            print(f'\nauto-assigned go.mp3 <- {name}  ("{text}")')
            break

    print(f"\n{len(rows)} clips in {VOICE_DIR}")
    print("Rename any clip per static/voice/README.txt to wire it into the app.")


if __name__ == "__main__":
    main()
