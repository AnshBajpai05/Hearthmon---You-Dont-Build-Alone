//! YAMNet audio-class vote: separate SPEECH from MUSIC — which Hearthmon's audio heuristics
//! provably CAN'T (blind A/B test: voiceish ~0.32 for both). The YAMNet MobileNet core runs in
//! pure Rust via `tract`; the log-mel front-end is hand-written here so raw audio never leaves the
//! process (same soul rule as the loopback bands). This whole pipeline is validated to 1e-5 against
//! TensorFlow — see `tools/yamnet_export/` (export + parity harness).
//!
//! The model is the MEL-INPUT core only (`[1,96,64]` patch -> 521 sigmoid scores); YAMNet's STFT
//! front-end does NOT convert to ONNX cleanly (tract can't run it), so we own it in Rust and feed
//! the core the exact log-mel TF would have produced (mel matrix dumped from TF, byte-for-byte).
use rustfft::{num_complex::Complex, Fft, FftPlanner};
use std::sync::Arc;
use tract_onnx::prelude::*;

const MODEL: &[u8] = include_bytes!("../resources/yamnet/yamnet_core.onnx");
const MEL_BYTES: &[u8] = include_bytes!("../resources/yamnet/mel_matrix.f32");

const WIN: usize = 400; // 25ms @16kHz
const HOP: usize = 160; // 10ms
const FFT: usize = 512; // 2^ceil(log2(400))
const BINS: usize = FFT / 2 + 1; // 257
const MELS: usize = 64;
const PATCH: usize = 96; // frames per 0.96s patch
pub const PATCH_SAMPLES: usize = WIN + (PATCH - 1) * HOP; // 15600 = one patch worth of 16k audio
const LOG_OFFSET: f32 = 0.001;
const SPEECH_IDX: usize = 0; // AudioSet "Speech"
const MUSIC_IDX: usize = 132; // AudioSet "Music"

type Plan = TypedRunnableModel<TypedModel>;

pub struct Classifier {
    plan: Plan,
    fft: Arc<dyn Fft<f32>>,
    mel: Vec<f32>, // [257*64] row-major, TF's exact linear_to_mel_weight_matrix
    win: [f32; WIN], // periodic Hann
}

impl Classifier {
    pub fn load() -> TractResult<Self> {
        let plan = tract_onnx::onnx()
            .model_for_read(&mut std::io::Cursor::new(MODEL))?
            .with_input_fact(0, f32::fact([1, PATCH, MELS]).into())?
            .into_optimized()?
            .into_runnable()?;
        let mel: Vec<f32> = MEL_BYTES
            .chunks_exact(4)
            .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();
        debug_assert_eq!(mel.len(), BINS * MELS);
        let mut win = [0f32; WIN];
        for (n, w) in win.iter_mut().enumerate() {
            *w = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * n as f32 / WIN as f32).cos();
        }
        let fft = FftPlanner::<f32>::new().plan_fft_forward(FFT);
        Ok(Self { plan, fft, mel, win })
    }

    /// Classify the most recent 0.96s of a 16kHz mono window. Returns (music_prob, speech_prob),
    /// each an independent sigmoid 0..1. `None` if there isn't a full patch of audio yet.
    pub fn classify(&self, wav16: &[f32]) -> Option<(f32, f32)> {
        if wav16.len() < PATCH_SAMPLES {
            return None;
        }
        let start = wav16.len() - PATCH_SAMPLES; // newest patch
        let mut patch = Vec::with_capacity(PATCH * MELS);
        let mut buf = vec![Complex::new(0f32, 0f32); FFT];
        for f in 0..PATCH {
            let s = start + f * HOP;
            for b in buf.iter_mut() {
                *b = Complex::new(0.0, 0.0);
            }
            for i in 0..WIN {
                buf[i].re = wav16[s + i] * self.win[i]; // window, then right-pad to FFT with zeros
            }
            self.fft.process(&mut buf);
            let mut mel = [0f32; MELS];
            for (bin, c) in buf.iter().take(BINS).enumerate() {
                let mag = (c.re * c.re + c.im * c.im).sqrt();
                let row = bin * MELS;
                for j in 0..MELS {
                    mel[j] += mag * self.mel[row + j];
                }
            }
            for m in mel.iter() {
                patch.push((*m + LOG_OFFSET).ln());
            }
        }
        let input = tract_ndarray::Array::from_shape_vec((1, PATCH, MELS), patch).ok()?;
        let out = self.plan.run(tvec!(input.into_tensor().into())).ok()?;
        // output is [1,521]; flatten before indexing (scalar-indexing a 2-D view panics)
        let scores: Vec<f32> = out[0].to_array_view::<f32>().ok()?.iter().copied().collect();
        if scores.len() <= MUSIC_IDX {
            return None;
        }
        Some((scores[MUSIC_IDX], scores[SPEECH_IDX]))
    }
}

/// Streaming linear resampler to 16kHz mono. YAMNet is robust to resampling quality, so linear is
/// plenty for a speech/music vote (we are not building a visualizer).
pub fn resample_to_16k(input: &[f32], in_sr: u32) -> Vec<f32> {
    if in_sr == 16000 || input.is_empty() {
        return input.to_vec();
    }
    let step = in_sr as f32 / 16000.0;
    let mut out = Vec::with_capacity((input.len() as f32 / step) as usize + 1);
    let mut pos = 0f32;
    while (pos as usize) + 1 < input.len() {
        let i = pos as usize;
        let frac = pos - i as f32;
        out.push(input[i] * (1.0 - frac) + input[i + 1] * frac);
        pos += step;
    }
    out
}
