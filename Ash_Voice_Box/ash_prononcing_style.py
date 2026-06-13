# ============================================================
# HEARTHMON — ASH PRONUNCIATION ENGINE v1
# ============================================================
# Purpose:
#   - Clone Ash's voice from a saved reference (F5-TTS, zero-shot).
#   - Preserve Ash's drawn-out Pokemon-name shout ("Pikachuuu!").
#   - Make reusable clips of Ash saying arbitrary lines.
#   - Emit files in the exact names Hearthmon's app already plays:
#       <species>.mp3       name call before the cry   (sound.ts voiceCry)
#       go-<species>.mp3    "<Name>! I choose you!"     (sound.ts announceGo)
#       <slug>.mp3          any custom trainer line     (sound.ts playVoiceClip)
#
# PERSONAL USE ONLY — this clones a real voice actor's voice. Never publish
# or redistribute the reference audio or anything generated from it.
#
# Run (GPU box or Kaggle/Colab):
#   pip install f5-tts            # ffmpeg must also be on PATH
#   python ash_prononcing_style.py pikachu charizard       # name + throw clips
#   python ash_prononcing_style.py --name-only mewtwo      # just "Mewtwooo!"
#   python ash_prononcing_style.py --text "Good work today." --out good-work
#   python ash_prononcing_style.py --from-dex 151          # batch the first 151
#   python ash_prononcing_style.py --from-file species.txt # one name per line
#
# Add  --install  to write straight into ../static/voice instead of ./results.
# ============================================================

import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================

HERE = Path(__file__).resolve().parent
REPO = HERE.parent                                   # hearthmon/
APP_VOICE_DIR = REPO / "static" / "voice"            # what the app serves at /voice
DEX_FILE = REPO / "src" / "lib" / "pokedex.ts"       # source of all 1025 names

# Reference voice. The elite single-speaker take clones best; the full comp is a
# fallback. Override with HEARTHMON_ASH_REF or --ref.
REF_CANDIDATES = [HERE / "ash_elite_reference.wav", HERE / "ash_all_voices.mp3"]

DEFAULT_SPEED = 0.98           # a touch slower = more deliberate, more "Ash"
DEFAULT_OUT = HERE / "results"

_tts = None                    # lazy-initialised F5TTS (don't touch the GPU on import)


# ============================================================
# ASH CADENCE RULES
# ============================================================
# The trick: F5-TTS lengthens a vowel when it's written long, and "!" lifts the
# intonation. So "Pikachuuu!" literally drags the final vowel into Ash's shout.

# Hand-tuned, iconic pronunciations (lowercase key -> exact spoken form).
OVERRIDES = {
    "pikachu":   "Pikachuuu!",
    "charizard": "Charizaaard!",
    "squirtle":  "Squirtleee!",
    "greninja":  "Greninjaaa!",
    "lucario":   "Lucariooo!",
    "dragonite": "Dragoniiite!",
    "rayquaza":  "Rayquazaaa!",
    "garchomp":  "Garchooomp!",
    "eevee":     "Eeveeee!",
    "mewtwo":    "Mewtwooo!",
    "bulbasaur": "Bulbasaurrr!",
    "gengar":    "Gengaarrr!",
    "infernape": "Infernaaape!",
    "sceptile":  "Sceptiiile!",
    "snorlax":   "Snorlaaax!",
}

_VOWELS = "aeiou"
_KNOWN_NAMES: set[str] | None = None     # lazily loaded Pokemon-name lexicon


def load_known_names() -> set[str]:
    """Every species name the stretch rule is allowed to fire on.

    Built from the override keys plus the app's pokedex (if present), so a word
    only gets the dramatic Ash stretch when it's genuinely a Pokemon — ordinary
    words in a custom line ("Good work today.") are left completely alone.
    """
    global _KNOWN_NAMES
    if _KNOWN_NAMES is not None:
        return _KNOWN_NAMES
    names = set(OVERRIDES)
    if DEX_FILE.exists():
        for m in re.finditer(r'\[\s*\d+\s*,\s*"([^"]+)"', DEX_FILE.read_text(encoding="utf-8")):
            # dex stores "nidoran-f", "tapu-koko" — index each whole + word parts
            slug_name = m.group(1).lower()
            names.add(slug_name.replace("-", ""))
            names.update(slug_name.split("-"))
    _KNOWN_NAMES = names
    return names


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def pretty(name: str) -> str:
    return " ".join(w.capitalize() for w in re.split(r"[-\s]+", name.strip()))


def _stretch_last_vowel(word: str) -> str:
    """Triple the final vowel of one word (the drawn-out part of the shout)."""
    chars = list(word)
    for i in range(len(chars) - 1, -1, -1):
        if chars[i].lower() in _VOWELS:
            chars[i] = chars[i] * 3
            break
    return "".join(chars)


def ashify_word(word: str) -> str:
    """Stretch a single Pokemon name token into Ash's shout."""
    key = re.sub(r"[^a-z0-9]", "", word.lower())
    if key in OVERRIDES:
        return OVERRIDES[key]
    return _stretch_last_vowel(word).rstrip("!") + "!"


def ashify_name(species: str) -> str:
    """Ash's name shout for a WHOLE species, including multi-word / form names.

    One shout per name: stretch only the final word's last vowel, single "!".
    So "tapu-koko" -> "Tapu Kokooo!", "ho-oh" -> "Ho Ohhh!", and connector-only
    tails ("Nidoran F", "...Of Four") don't each get shouted.
    """
    key = re.sub(r"[^a-z0-9]", "", species.lower())
    if key in OVERRIDES:
        return OVERRIDES[key]
    words = pretty(species).split()
    if not words:
        return species
    words[-1] = _stretch_last_vowel(words[-1])
    return " ".join(words).rstrip("!") + "!"


def ashify_text(text: str, force_names: frozenset[str] = frozenset()) -> str:
    """Apply the shout only to recognised Pokemon names; pass everything else through.

    `force_names` are slugs we KNOW are species (the one we're generating for),
    so they stretch even if they aren't in the dex/override lexicon yet.
    """
    known = load_known_names()
    out = []
    for word in text.split():
        clean = re.sub(r"[^a-z0-9]", "", word.lower())
        if clean and (clean in known or clean in force_names or slug(word) in force_names):
            out.append(ashify_word(word))
        else:
            out.append(word)
    return " ".join(out)


# ============================================================
# TTS BACKEND (lazy)
# ============================================================

def resolve_ref(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit)
        if not p.exists():
            sys.exit(f"reference audio not found: {p}")
        return p
    env = os.environ.get("HEARTHMON_ASH_REF")
    if env and Path(env).exists():
        return Path(env)
    for cand in REF_CANDIDATES:
        if cand.exists():
            return cand
    sys.exit(f"no reference audio found. Put ash_elite_reference.wav in {HERE} "
             f"or pass --ref <file>.")


def get_tts():
    global _tts
    if _tts is None:
        try:
            import torch
            from f5_tts.api import F5TTS
        except ImportError as e:
            sys.exit(f"missing dependency ({e}). Install with:  pip install f5-tts")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cpu":
            print("[warn] no CUDA found — running on CPU (slow but works).")
        print(f"[f5-tts] loading model on {device} (first run downloads weights)…")
        _tts = F5TTS(device=device)
    return _tts


def synth(text: str, out_path: Path, ref: Path, ref_text: str, speed: float) -> None:
    """Generate `text` in Ash's voice and write it to out_path (.mp3 or .wav)."""
    tts = get_tts()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "out.wav"
        tts.infer(
            ref_file=str(ref),
            ref_text=ref_text,          # "" -> F5-TTS auto-transcribes the reference
            gen_text=text,
            file_wave=str(wav),
            speed=speed,
        )
        if out_path.suffix.lower() == ".wav":
            wav.replace(out_path)
        else:                            # the app plays .mp3 — convert with ffmpeg
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                 "-i", str(wav), "-q:a", "4", str(out_path)],
                check=True,
            )


# ============================================================
# CLIP GENERATORS  (file names match what sound.ts already looks for)
# ============================================================

def gen_name_call(species: str, voice_dir: Path, ref: Path, ref_text: str, speed: float) -> None:
    text = ashify_name(species)          # whole-name shout: "Tapu Kokooo!"
    out = voice_dir / f"{slug(species)}.mp3"
    print(f'  {out.name:28s} <- "{text}"')
    synth(text, out, ref, ref_text, speed)


def gen_throw(species: str, voice_dir: Path, ref: Path, ref_text: str, speed: float) -> None:
    text = f"{ashify_name(species)} I choose you!"
    out = voice_dir / f"go-{slug(species)}.mp3"
    print(f'  {out.name:28s} <- "{text}"')
    synth(text, out, ref, ref_text, speed)


def gen_custom(text: str, stem: str, voice_dir: Path, ref: Path, ref_text: str, speed: float) -> None:
    spoken = ashify_text(text)           # stretches any species mentioned, leaves prose alone
    out = voice_dir / f"{slug(stem)}.mp3"
    print(f'  {out.name:28s} <- "{spoken}"')
    synth(spoken, out, ref, ref_text, speed)


# ============================================================
# SPECIES SOURCES
# ============================================================

def species_from_dex(limit: int | None) -> list[str]:
    if not DEX_FILE.exists():
        sys.exit(f"dex not found at {DEX_FILE}")
    names = [m.group(1) for m in
             re.finditer(r'\[\s*\d+\s*,\s*"([^"]+)"', DEX_FILE.read_text(encoding="utf-8"))]
    return names[:limit] if limit else names


def species_from_file(path: str) -> list[tuple[str, str | None]]:
    """One per line. 'pikachu' or 'pikachu | Go get 'em!'  (# = comment)."""
    out: list[tuple[str, str | None]] = []
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "|" in line:
            name, custom = (x.strip() for x in line.split("|", 1))
            out.append((name, custom))
        else:
            out.append((line, None))
    return out


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Generate Ash-voiced Pokemon name / throw / line clips for Hearthmon.")
    ap.add_argument("species", nargs="*", help="species names to generate")
    ap.add_argument("--name-only", action="store_true",
                    help='only the name call ("Gengar!") -> <species>.mp3')
    ap.add_argument("--throw-only", action="store_true",
                    help='only the throw line -> go-<species>.mp3')
    ap.add_argument("--text", help="custom line to speak (use with --out)")
    ap.add_argument("--out", help="output stem for --text (without .mp3)")
    ap.add_argument("--from-dex", type=int, nargs="?", const=0, metavar="N",
                    help="pull species from the app pokedex (optionally first N)")
    ap.add_argument("--from-file", metavar="FILE",
                    help="read species (and optional | custom lines) from a file")
    ap.add_argument("--ref", help="reference audio (default: ash_elite_reference.wav)")
    ap.add_argument("--ref-text", default="",
                    help="transcript of the reference (default: auto-transcribe)")
    ap.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    ap.add_argument("--voice-dir", help="output dir (default: ./results)")
    ap.add_argument("--install", action="store_true",
                    help=f"write straight into the app voice dir ({APP_VOICE_DIR})")
    args = ap.parse_args()

    voice_dir = (Path(args.voice_dir) if args.voice_dir
                 else APP_VOICE_DIR if args.install else DEFAULT_OUT)
    ref = resolve_ref(args.ref)
    print(f"[ref]  {ref}")
    print(f"[out]  {voice_dir}\n")

    did = 0

    # 1) one-off custom line
    if args.text:
        gen_custom(args.text, args.out or args.text, voice_dir, ref, args.ref_text, args.speed)
        did += 1

    # 2) assemble the species worklist
    worklist: list[tuple[str, str | None]] = [(s, None) for s in args.species]
    if args.from_dex is not None:
        worklist += [(s, None) for s in species_from_dex(args.from_dex or None)]
    if args.from_file:
        worklist += species_from_file(args.from_file)

    for name, custom in worklist:
        if custom:                       # a file line with its own throw text
            gen_custom(custom, f"go-{slug(name)}", voice_dir, ref, args.ref_text, args.speed)
            did += 1
            continue
        if not args.throw_only:
            gen_name_call(name, voice_dir, ref, args.ref_text, args.speed)
            did += 1
        if not args.name_only:
            gen_throw(name, voice_dir, ref, args.ref_text, args.speed)
            did += 1

    if did == 0:
        ap.error("nothing to do — pass species, --from-dex, --from-file, or --text.")

    print(f"\nDone — {did} clip(s) in {voice_dir}")
    if voice_dir != APP_VOICE_DIR:
        print(f"Drop the .mp3s into {APP_VOICE_DIR} (the app prefers them automatically; "
              f"missing files fall back to built-in TTS).")


# ============================================================
# TEST  (text-only — prints the transform without touching the GPU)
# ============================================================

def _selftest() -> None:
    for line in ["Pikachu use thunderbolt!",
                 "Charizard and Greninja are ready!",
                 "Good work today. I'll be here tomorrow."]:
        print(f"{line!r:48s} -> {ashify_text(line)!r}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest":
        _selftest()
    else:
        main()
