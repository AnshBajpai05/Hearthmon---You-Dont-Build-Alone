# Hearthmon voice cloning — Kaggle run kit

Clone the trainer voice from the bundled reference clips and generate
`go-<species>.mp3` throw lines. Runs in seconds per line on a Kaggle **P100** or
**T4** (T4×2 is fine — it only uses one GPU).

> **Personal use only.** This clones a real voice actor's voice. Don't publish,
> share, or redistribute the reference clips or the generated audio.

## Contents
```
clone_voice_kaggle.py   the generator
requirements.txt        pinned deps (predate the torchcodec wall)
species.txt             list of species to generate (edit freely)
reference_clips/        real voice samples used to clone the voice
results/                generated .mp3s land here (download these)
```

## Run on Kaggle (5 steps)
1. **New Notebook → Add Data → Upload** this whole folder (or upload the zip and unzip).
2. Notebook settings: **Accelerator = GPU (P100 or T4×2)**, **Internet = ON**
   (needed once to download the ~1.8 GB XTTS model).
3. First cell — install the two extra deps (Kaggle already has torch + ffmpeg):
   ```python
   !pip install -q "coqui-tts==0.24.3" "transformers==4.40.2"
   ```
4. Second cell — run it (cd into wherever you put the folder):
   ```python
   %cd /kaggle/working/kaggle_voice_clone      # adjust path to where you uploaded
   !COQUI_TOS_AGREED=1 python clone_voice_kaggle.py
   ```
5. When it finishes, the `results/` folder holds `go-pikachu.mp3`, `go-charizard.mp3`, …
   **Download `results/`** (right-click → Download, or zip it in a cell).

## Options
```python
# specific species, ignore species.txt
!python clone_voice_kaggle.py pikachu charizard "tapu koko"

# just the name calls ("Gengar!") -> gengar.mp3, used before the cry
!python clone_voice_kaggle.py --name-only gengar mimikyu

# throw lines AND name calls in one pass
!python clone_voice_kaggle.py --also-names
```

To generate ALL 1025 species' throw lines, replace `species.txt` with the full list
(or loop the dex). Each line is a few seconds on GPU; the full set is ~1–2 hours.

## Back in the app
Drop the generated files into `hearthmon/static/voice/`. The app automatically prefers:
- `go-<species>.mp3` — plays on that species' Pokéball throw (beats everything else)
- `<species>.mp3` — the name call before the cry

No code changes, no restart in dev. Missing file → it falls back to the built-in TTS voice.

## Why Kaggle and not local Windows
Newer `coqui-tts` pulls in `torchcodec`, whose prebuilt Windows DLL won't load without
matching FFmpeg shared libs — that blocked local cloning. Kaggle's Linux image + the
pinned `coqui-tts==0.24.3` here avoid the whole problem, and the GPU makes it fast.

## Better reference (optional)
Cloning quality scales with the reference. Add more clean, single-speaker clips to
`reference_clips/` (10–60s total, no music/SFX over the voice) for a closer match.
The script concatenates everything in that folder automatically.
