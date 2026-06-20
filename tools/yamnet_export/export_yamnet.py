"""Export canonical YAMNet's MEL-INPUT CORE to ONNX for the Hearthmon audio-class vote.

WHY the core (approach M) and not the full waveform model (approach W): tf2onnx left ~27 dangling
inputs when converting YAMNet's STFT front-end, and tract has even less signal-op coverage than
onnxruntime -> the waveform ONNX is unusable in Rust. So we split the model: the STFT+mel front-end
becomes hand-written Rust DSP (validated against TF's exact log-mel), and ONNX is ONLY the MobileNet
core (mel patch [1,96,64] -> 521 sigmoid scores) -- pure conv/bn/relu, which tract loves.

Outputs:
  yamnet_core.onnx   input feat[1,96,64] f32 -> scores[1,96... no: 1,521]   (the part tract runs)
  mel_matrix.f32     [257*64] row-major little-endian -- TF's EXACT linear_to_mel_weight_matrix, so
                     Rust uses the identical mel projection (no mel-formula drift).
  class_map.csv      521 names
  labels.json        Speech / Music indices + music-family
  refs.npz           test waveform + TF log_mel + TF features patch + TF/ORT core scores -> the
                     ground truth the Rust DSP + tract pipeline is validated against.
"""
import csv
import json
import os
import sys

import numpy as np
import tensorflow as tf

# yamnet.py targets TF2.16+ (Keras 3) via `tf_keras`; we pinned TF2.15 (Keras 2), so alias it.
sys.modules["tf_keras"] = tf.keras

import tf2onnx
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)  # so `import features` inside yamnet.py resolves
import params as yp
import features as features_lib
import yamnet as yamnet_lib

P = yp.Params()
OPSET = 13

# ---- 1. full frames model (waveform->scores) just to load the official weights cleanly ----
print("building frames model + loading yamnet.h5 ...")
frames = yamnet_lib.yamnet_frames_model(P)
frames.load_weights(os.path.join(HERE, "yamnet.h5"))

# ---- 2. mel-input CORE model that SHARES those weights (copied by layer name) ----
feat_in = tf.keras.Input(batch_shape=(1, P.patch_frames, P.patch_bands), dtype=tf.float32, name="feat")
pred, _emb = yamnet_lib.yamnet(feat_in, P)
core = tf.keras.Model(inputs=feat_in, outputs=pred, name="yamnet_core")
copied = 0
for lyr in core.layers:
    if not lyr.weights:
        continue
    try:
        src = frames.get_layer(lyr.name)            # conv/bn layers: explicit matching names
    except ValueError:
        src = next(l for l in frames.layers if type(l) is type(lyr) and l.count_params() == lyr.count_params())
    lyr.set_weights(src.get_weights())
    copied += 1
print(f"copied weights into {copied} core layers")

# ---- 3. class map + labels ----
cmap = os.path.join(HERE, "yamnet_class_map.csv")
if not os.path.exists(cmap):
    import urllib.request
    urllib.request.urlretrieve(
        "https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv",
        cmap)
names = list(yamnet_lib.class_names(cmap))
assert len(names) == 521, len(names)
with open(os.path.join(HERE, "class_map.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["index", "display_name"])
    for i, nm in enumerate(names): w.writerow([i, nm])

MUSIC_KEYS = ("music", "guitar", "piano", "drum", "singing", "song", "violin", "synthesizer",
              "instrument", "orchestra", "choir", "rapping", "melody", "bass guitar")
music_family = sorted({i for i, nm in enumerate(names) if any(k in nm.lower() for k in MUSIC_KEYS)})
labels = {"speech": names.index("Speech"), "music": names.index("Music"),
          "music_family": music_family, "music_family_names": [names[i] for i in music_family]}
json.dump(labels, open(os.path.join(HERE, "labels.json"), "w", encoding="utf-8"), indent=2)
print(f"Speech={labels['speech']}  Music={labels['music']}  music_family={len(music_family)}")

# ---- 4. dump TF's EXACT mel weight matrix [257,64] for the Rust DSP ----
win = int(round(P.sample_rate * P.stft_window_seconds))
fft_len = 2 ** int(np.ceil(np.log(win) / np.log(2.0)))
n_bins = fft_len // 2 + 1
mel_mat = tf.signal.linear_to_mel_weight_matrix(
    num_mel_bins=P.mel_bands, num_spectrogram_bins=n_bins, sample_rate=P.sample_rate,
    lower_edge_hertz=P.mel_min_hz, upper_edge_hertz=P.mel_max_hz).numpy().astype(np.float32)
mel_mat.tofile(os.path.join(HERE, "mel_matrix.f32"))
print(f"mel_matrix {mel_mat.shape} -> mel_matrix.f32  (win={win} fft={fft_len} bins={n_bins})")

# ---- 5. export core to ONNX ----
onnx_path = os.path.join(HERE, "yamnet_core.onnx")
tf2onnx.convert.from_function(
    tf.function(lambda x: core(x)),
    input_signature=[tf.TensorSpec([1, P.patch_frames, P.patch_bands], tf.float32, name="feat")],
    opset=OPSET, output_path=onnx_path)
print(f"wrote {onnx_path}")

# ---- 6. validate: TF frames-scores vs core(features) vs onnxruntime(core) ----
rng = np.random.default_rng(0)
tests = {
    "sine440": (np.sin(2*np.pi*440*np.arange(20000)/16000).astype(np.float32) * 0.3),
    "white": (rng.standard_normal(20000).astype(np.float32) * 0.1),
}
sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
in_name = sess.get_inputs()[0].name
ref = {}
for tag, wav in tests.items():
    f_scores, _emb, f_logmel = frames(wav)               # official path
    padded = features_lib.pad_waveform(tf.constant(wav), P)
    _lm, feats = features_lib.waveform_to_log_mel_spectrogram_patches(padded, P)
    patch0 = feats.numpy()[:1]                            # [1,96,64]
    core_scores = core(patch0).numpy()
    ort_scores = sess.run(None, {in_name: patch0})[0]
    d_core = float(np.max(np.abs(f_scores.numpy()[:1] - core_scores)))
    d_ort = float(np.max(np.abs(core_scores - ort_scores)))
    ref[f"{tag}_wav"] = wav
    ref[f"{tag}_logmel"] = f_logmel.numpy()
    ref[f"{tag}_feat"] = patch0
    ref[f"{tag}_scores"] = ort_scores
    top = int(np.argmax(ort_scores[0]))
    print(f"  {tag:8s} top='{names[top]}'  |frames-core|={d_core:.2e}  |core-ort|={d_ort:.2e}")
np.savez(os.path.join(HERE, "refs.npz"), **ref)
print("done.")
