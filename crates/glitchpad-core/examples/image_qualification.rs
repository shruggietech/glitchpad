//! Original-corpus latency and sampled process-working-set qualification.

use glitchpad_core::image_family::decode_family;
use glitchpad_core::images::ImageLimits;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use sysinfo::{ProcessesToUpdate, System, get_current_pid};

fn main() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/images");
    let pid = get_current_pid().expect("process identity must be measurable");
    let done = Arc::new(AtomicBool::new(false));
    let peak = Arc::new(AtomicU64::new(0));
    let sampler = {
        let done = Arc::clone(&done);
        let peak = Arc::clone(&peak);
        std::thread::spawn(move || {
            let mut system = System::new().expect("process sampler must initialize");
            while !done.load(Ordering::Acquire) {
                system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
                if let Some(process) = system.process(pid) {
                    peak.fetch_max(process.memory(), Ordering::Relaxed);
                }
                std::thread::sleep(Duration::from_millis(5));
            }
        })
    };
    let mut rows = Vec::new();
    let mut inputs = Vec::new();
    for name in [
        "original.png",
        "original.jpg",
        "original.webp",
        "original.bmp",
        "original.tiff",
        "original.gif",
        "animated.webp",
        "original.svg",
        "entries.ico",
    ] {
        let bytes = std::fs::read(root.join(name)).expect("owned fixture exists");
        inputs.push((name.to_owned(), bytes));
    }
    let pixels = image::RgbaImage::from_fn(1024, 1024, |x, y| {
        image::Rgba([
            u8::try_from(x % 251).expect("bounded channel"),
            u8::try_from(y % 251).expect("bounded channel"),
            u8::try_from((x + y) % 251).expect("bounded channel"),
            255,
        ])
    });
    let mut generated = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(pixels)
        .write_to(&mut generated, image::ImageFormat::Bmp)
        .expect("generated bounded fixture encodes");
    inputs.push(("generated-1mp.bmp".to_owned(), generated.into_inner()));
    for (name, bytes) in inputs {
        let mut elapsed = Vec::new();
        for _ in 0..20 {
            let start = Instant::now();
            let result = decode_family(&bytes, 0, &ImageLimits::android(), &AtomicBool::new(false))
                .expect("original fixture must decode");
            elapsed.push(start.elapsed().as_micros());
            assert!(!result.preview.png_bytes.is_empty());
            drop(result);
        }
        elapsed.sort_unstable();
        let p95_us = elapsed[18];
        assert!(p95_us <= 5_000_000, "{name} exceeds 5-second stage budget");
        rows.push(json!({"fixture":name,"sha256":hex::encode(Sha256::digest(&bytes)),"iterations":20,"p95_us":p95_us}));
    }
    // Ensure at least one process sample even on an unusually fast runner.
    std::thread::sleep(Duration::from_millis(20));
    done.store(true, Ordering::Release);
    sampler.join().expect("resource sampler completes");
    let peak_bytes = peak.load(Ordering::Relaxed);
    assert!(
        peak_bytes > 0 && peak_bytes <= 384 * 1024 * 1024,
        "original corpus exceeds Android working-set qualification ceiling"
    );
    println!(
        "{}",
        json!({"schema_version":1,"platform":std::env::consts::OS,"architecture":std::env::consts::ARCH,"version":env!("CARGO_PKG_VERSION"),"source_revision":std::env::var("GLITCHPAD_SOURCE_REVISION").unwrap_or_else(|_| "uncommitted".to_owned()),"measurement":"sampled_process_resident_bytes","sample_interval_ms":5,"peak_bytes":peak_bytes,"rows":rows,"limitations":["original and generated 1MP campaign, not maximum-input peak proof","hosted process, not physical Android validation"]})
    );
}
