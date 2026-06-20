// Isolated de-risk for the YAMNet audio-class path. Two checks, both against TF/onnxruntime
// reference vectors dumped by the Python export:
//   1. tract loads + runs the core ONNX and matches onnxruntime (the model path).
//   2. a hand-written Rust log-mel (mirroring YAMNet's features.py) -> tract reproduces the TF
//      log-mel AND the final 521 scores from a raw waveform (the WHOLE Rust pipeline).
// If both pass, increment 3 (wiring into src-tauri) is pure plumbing.
use rustfft::{num_complex::Complex, FftPlanner};
use tract_onnx::prelude::*;

const SR: usize = 16000;
const WIN: usize = 400; // 25ms
const HOP: usize = 160; // 10ms
const FFT: usize = 512; // 2^ceil(log2(400))
const BINS: usize = FFT / 2 + 1; // 257
const MELS: usize = 64;
const PATCH_FRAMES: usize = 96; // 0.96s
const PATCH_HOP_FRAMES: usize = 48; // 0.48s
const LOG_OFFSET: f32 = 0.001;

fn read_f32(path: &str) -> Vec<f32> {
    std::fs::read(path)
        .unwrap_or_else(|e| panic!("read {path}: {e}"))
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

// periodic Hann window (matches tf.signal.stft default): 0.5 - 0.5*cos(2*pi*n/WIN)
fn hann() -> [f32; WIN] {
    let mut w = [0f32; WIN];
    for (n, wv) in w.iter_mut().enumerate() {
        *wv = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * n as f32 / WIN as f32).cos();
    }
    w
}

// YAMNet pad_waveform: pad with silence to an integral number of patches.
fn pad_waveform(wav: &[f32]) -> Vec<f32> {
    let min_samples = ((0.96 + 0.025 - 0.010) * SR as f32) as usize; // 15600
    let mut n = wav.len();
    let mut pad = min_samples.saturating_sub(n);
    n = n.max(min_samples);
    let after_first = n - min_samples;
    let hop = (0.48 * SR as f32) as usize; // 7680
    let hops = (after_first as f32 / hop as f32).ceil() as usize;
    pad += hop * hops - after_first;
    let mut out = wav.to_vec();
    out.extend(std::iter::repeat(0.0).take(pad));
    out
}

// waveform -> log-mel spectrogram [frames, 64], mirroring features.py (tflite_compatible=False).
fn log_mel(wav: &[f32], mel_mat: &[f32], win: &[f32; WIN], planner: &mut FftPlanner<f32>) -> Vec<[f32; MELS]> {
    let fft = planner.plan_fft_forward(FFT);
    let nframes = if wav.len() >= WIN { 1 + (wav.len() - WIN) / HOP } else { 0 };
    let mut out = Vec::with_capacity(nframes);
    let mut buf = vec![Complex::new(0f32, 0f32); FFT];
    for f in 0..nframes {
        let start = f * HOP;
        for b in buf.iter_mut() {
            *b = Complex::new(0.0, 0.0);
        }
        for i in 0..WIN {
            buf[i].re = wav[start + i] * win[i]; // window, then right-pad to FFT with zeros
        }
        fft.process(&mut buf);
        let mut mel = [0f32; MELS];
        // magnitude of bins 0..256, projected through TF's exact mel matrix [257,64]
        for (bin, c) in buf.iter().take(BINS).enumerate() {
            let mag = (c.re * c.re + c.im * c.im).sqrt();
            let row = bin * MELS;
            for j in 0..MELS {
                mel[j] += mag * mel_mat[row + j];
            }
        }
        for m in mel.iter_mut() {
            *m = (*m + LOG_OFFSET).ln();
        }
        out.push(mel);
    }
    out
}

fn main() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../src-tauri/resources/yamnet");
    let mel_mat = read_f32(&format!("{dir}/mel_matrix.f32"));
    assert_eq!(mel_mat.len(), BINS * MELS);

    let model = tract_onnx::onnx()
        .model_for_path(format!("{dir}/yamnet_core.onnx"))
        .expect("load onnx")
        .with_input_fact(0, f32::fact([1, PATCH_FRAMES, MELS]).into())
        .expect("input fact")
        .into_optimized()
        .expect("optimize")
        .into_runnable()
        .expect("runnable");

    let run = |patch: &[f32]| -> Vec<f32> {
        let input = tract_ndarray::Array::from_shape_vec((1, PATCH_FRAMES, MELS), patch.to_vec()).unwrap();
        let out = model.run(tvec!(input.into_tensor().into())).expect("run");
        out[0].to_array_view::<f32>().unwrap().iter().copied().collect()
    };

    // ---- check 1: tract vs onnxruntime on the reference feat patch ----
    let feat = read_f32(&format!("{dir}/sine440_feat.f32"));
    let want_scores = read_f32(&format!("{dir}/sine440_scores.f32"));
    let s1 = run(&feat);
    let e1 = s1.iter().zip(&want_scores).map(|(a, b)| (a - b).abs()).fold(0.0f32, f32::max);
    println!("[1] tract vs ort (ref patch):       max|d|={e1:.2e}");

    // ---- check 2: full Rust pipeline from raw waveform ----
    let wav = read_f32(&format!("{dir}/sine440_wav.f32"));
    let ref_logmel = read_f32(&format!("{dir}/sine440_logmel.f32")); // [144,64] from TF
    let win = hann();
    let mut planner = FftPlanner::<f32>::new();
    let padded = pad_waveform(&wav);
    let lm = log_mel(&padded, &mel_mat, &win, &mut planner);
    println!("    frames: rust={} tf={}", lm.len(), ref_logmel.len() / MELS);

    // log-mel parity
    let mut e_lm = 0f32;
    for (f, frame) in lm.iter().enumerate() {
        for j in 0..MELS {
            e_lm = e_lm.max((frame[j] - ref_logmel[f * MELS + j]).abs());
        }
    }
    println!("[2a] rust log-mel vs TF log-mel:     max|d|={e_lm:.2e}");

    // first patch (frames 0..96) -> tract -> compare to the TF/ort reference scores
    let mut patch = Vec::with_capacity(PATCH_FRAMES * MELS);
    for frame in lm.iter().take(PATCH_FRAMES) {
        patch.extend_from_slice(frame);
    }
    let s2 = run(&patch);
    let e2 = s2.iter().zip(&want_scores).map(|(a, b)| (a - b).abs()).fold(0.0f32, f32::max);
    println!("[2b] full rust pipeline vs ref score: max|d|={e2:.2e}");
    let _ = PATCH_HOP_FRAMES;

    let pass = e1 < 1e-3 && e_lm < 1e-2 && e2 < 1e-2;
    println!("\n{}", if pass { "ALL PASS — Rust audio-class path proven end-to-end" } else { "FAIL" });
    assert!(pass);
}
