Drop real voice clips here (mp3) and Hearthmon will use them instead of TTS.
For personal use only — e.g. clips you downloaded yourself from soundboards
(jayuzumi.com, 101soundboards.com, soundboard.com, soundinstants.com).

Naming:

  go.mp3              generic trainer throw line, plays for any switch
                      (e.g. Ash's "I choose you!")
  go-pikachu.mp3      per-species throw line, beats go.mp3 when present
  pikachu.mp3         the Pokemon announcing its own name
                      (plays before its game cry)

Species names are lowercase, spaces become hyphens:
  tapu koko -> tapu-koko.mp3, mr mime -> mr-mime.mp3

No clip found = automatic fallback to the synthesized voice. No restart
needed in dev; rebuild (npm run tauri build) to bundle clips into the exe.

Voice cloning (free, local, personal use only):
  python tools/clone_voice.py charizard pikachu gengar
generates go-charizard.mp3 etc. in the cloned trainer voice (XTTS v2,
conditioned on the real clips in this folder). ~10-30s per line on CPU.
  python tools/caption_split.py <audio>   cuts + labels clips from raw audio.
