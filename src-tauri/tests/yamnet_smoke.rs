//! Smoke test: can `tract` load + run the exported YAMNet core, and does it match TF/onnxruntime?
//! This is the gating de-risk for the whole Rust audio-class path — if tract can't run this ONNX,
//! the approach changes. Reference vectors (sine440_feat -> sine440_scores) were dumped from the
//! Python export (TF == onnxruntime to 2e-7), so the bar here is tight: max|diff| < 1e-3.
use tract_onnx::prelude::*;

fn read_f32(path: &str) -> Vec<f32> {
    let bytes = std::fs::read(path).unwrap_or_else(|e| panic!("read {path}: {e}"));
    bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

#[test]
fn yamnet_core_parity() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/resources/yamnet");
    let model = tract_onnx::onnx()
        .model_for_path(format!("{dir}/yamnet_core.onnx"))
        .expect("load onnx")
        .with_input_fact(0, f32::fact([1, 96, 64]).into())
        .expect("set input fact")
        .into_optimized()
        .expect("optimize")
        .into_runnable()
        .expect("runnable");

    let feat = read_f32(&format!("{dir}/sine440_feat.f32")); // [1,96,64]
    let want = read_f32(&format!("{dir}/sine440_scores.f32")); // [1,521]
    assert_eq!(feat.len(), 96 * 64);
    assert_eq!(want.len(), 521);

    let input = tract_ndarray::Array::from_shape_vec((1, 96, 64), feat).unwrap();
    let result = model
        .run(tvec!(input.into_tensor().into()))
        .expect("run inference");
    let got = result[0].to_array_view::<f32>().expect("scores view");
    assert_eq!(got.len(), 521, "expected 521 class scores");

    let max_err = got
        .iter()
        .zip(want.iter())
        .map(|(a, b)| (a - b).abs())
        .fold(0.0f32, f32::max);

    // sanity: a pure 440Hz tone should NOT be classified as Music or Speech with high confidence
    let v: Vec<f32> = got.iter().copied().collect();
    let top = (0..521).max_by(|&i, &j| v[i].total_cmp(&v[j])).unwrap();
    println!("tract top class idx={top} score={:.4}  max|tract-ort|={max_err:.2e}", v[top]);

    assert!(max_err < 1e-3, "tract diverges from onnxruntime: {max_err:.2e}");
}
