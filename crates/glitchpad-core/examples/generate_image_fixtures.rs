//! Reproducible original Apache-2.0 fixtures; run from the repository root.
use image::{DynamicImage, ImageFormat, Rgb, RgbImage};
use sha2::{Digest, Sha256};
use std::{fs, io::Cursor, path::Path};

fn oriented_exif(orientation: u16) -> Vec<u8> {
    let mut exif = b"Exif\0\0II*\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0".to_vec();
    exif.extend_from_slice(&orientation.to_le_bytes());
    exif.extend_from_slice(&[0; 6]);
    exif
}

fn chunk(tag: [u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut bytes = tag.to_vec();
    bytes.extend_from_slice(&u32::try_from(payload.len()).unwrap().to_le_bytes());
    bytes.extend_from_slice(payload);
    if payload.len() % 2 == 1 {
        bytes.push(0);
    }
    bytes
}

fn families(root: &Path) {
    for (name, repeat) in [
        ("original.gif", gif::Repeat::Finite(2)),
        ("s047-playback.gif", gif::Repeat::Infinite),
    ] {
        let mut gif = Vec::new();
        {
            let mut encoder =
                gif::Encoder::new(&mut gif, 4, 3, &[255, 0, 0, 0, 0, 255, 0, 255, 0, 0, 0, 0])
                    .unwrap();
            encoder.set_repeat(repeat).unwrap();
            for (left, top, width, height, pixels, dispose) in [
                (0, 0, 4, 3, vec![0; 12], gif::DisposalMethod::Keep),
                (1, 1, 1, 1, vec![1], gif::DisposalMethod::Previous),
                (2, 1, 1, 1, vec![2], gif::DisposalMethod::Background),
                (0, 0, 1, 1, vec![3], gif::DisposalMethod::Keep),
            ] {
                encoder
                    .write_frame(&gif::Frame {
                        left,
                        top,
                        width,
                        height,
                        delay: 4,
                        transparent: Some(3),
                        dispose,
                        buffer: pixels.into(),
                        ..Default::default()
                    })
                    .unwrap();
            }
        }
        fs::write(root.join(name), gif).unwrap();
    }
    let mut chunks = chunk(*b"VP8X", &[0x12, 0, 0, 0, 3, 0, 0, 2, 0, 0]);
    chunks.extend(chunk(*b"ANIM", &[0, 0, 0, 0, 0, 0]));
    for (color, duration) in [([255, 0, 0, 255], 40), ([0, 0, 255, 128], 60)] {
        let mut still = Vec::new();
        image_webp::WebPEncoder::new(&mut still)
            .encode(&[color; 12].concat(), 4, 3, image_webp::ColorType::Rgba8)
            .unwrap();
        let mut frame = vec![0, 0, 0, 0, 0, 0, 3, 0, 0, 2, 0, 0, duration, 0, 0, 2];
        frame.extend_from_slice(&still[12..]);
        chunks.extend(chunk(*b"ANMF", &frame));
    }
    let mut webp = b"RIFF".to_vec();
    webp.extend_from_slice(&u32::try_from(chunks.len() + 4).unwrap().to_le_bytes());
    webp.extend_from_slice(b"WEBP");
    webp.extend(chunks);
    fs::write(root.join("animated.webp"), webp).unwrap();
    fs::write(root.join("original.svg"), br##"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="2" height="3" fill="#ff0000"/><rect x="2" width="2" height="3" fill="#0000ff" opacity="0.5"/><text x="0" y="1" font-family="Geist" font-size="1">G</text></svg>"##).unwrap();
    fs::write(root.join("hostile.svg"), br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><script>throw new Error('unsafe')</script><image href="https://invalid.example/pixel"/></svg>"#).unwrap();
    fs::write(root.join("svg-presentation.svg"), br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><style>.ink { fill: #123456; } #panel { opacity: 1; }</style><rect id="panel" class="ink" width="4" height="3" style="stroke:none"/></svg>"#).unwrap();
    fs::write(root.join("svg-namespaced.svg"), br#"<s:svg xmlns:s="http://www.w3.org/2000/svg" width="4" height="3"><s:g style="fill:#123456"><s:rect width="4" height="3"/></s:g></s:svg>"#).unwrap();
    fs::write(root.join("svg-reuse.svg"), br##"<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="4" height="3"><defs><rect id="panel" width="4" height="3" fill="#123456"/></defs><use xlink:href="#panel"/></svg>"##).unwrap();
    fs::write(root.join("svg-external.svg"), br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><use href="https://invalid.example/object#shape"/></svg>"#).unwrap();
    fs::write(root.join("svg-cycle.svg"), br##"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><defs><g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g></defs><use href="#a"/></svg>"##).unwrap();
    fs::write(
        root.join("svg-malformed.svg"),
        br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect></svg>"#,
    )
    .unwrap();
    fs::write(
        root.join("svg-unsupported.svg"),
        br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><filter/></svg>"#,
    )
    .unwrap();
    fs::write(root.join("svg-missing.svg"), br##"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><use href="#absent"/></svg>"##).unwrap();
    fs::write(
        root.join("svg-resource.svg"),
        format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3">{}{}</svg>"#,
            "<g>".repeat(129),
            "</g>".repeat(129)
        ),
    )
    .unwrap();
    fs::write(root.join("svg-viewport.svg"), br##"<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#123456"/></svg>"##).unwrap();
    fs::write(root.join("svg-read-denied.svg"), br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><style>.ink { fill: #123456; } #panel { opacity: 1; }</style><rect id="panel" class="ink" width="4" height="3" style="stroke:none"/></svg>"#).unwrap();
    let png = fs::read(root.join("original.png")).unwrap();
    let mut dib = fs::read(root.join("original.bmp")).unwrap()[14..].to_vec();
    dib[8..12].copy_from_slice(&6_u32.to_le_bytes());
    dib.extend_from_slice(&[0; 12]);
    let payloads = [png.clone(), dib, png, vec![0; 16]];
    let mut ico = vec![0, 0, 1, 0, 4, 0];
    let mut offset = 70_u32;
    for (index, payload) in payloads.iter().enumerate() {
        ico.extend_from_slice(&[4, 3, 0, 0, 1, 0, if index == 1 { 24 } else { 32 }, 0]);
        ico.extend_from_slice(&u32::try_from(payload.len()).unwrap().to_le_bytes());
        ico.extend_from_slice(&offset.to_le_bytes());
        offset += u32::try_from(payload.len()).unwrap();
    }
    for payload in payloads {
        ico.extend(payload);
    }
    fs::write(root.join("entries.ico"), ico).unwrap();
}

fn main() {
    let root = Path::new("fixtures/images");
    fs::create_dir_all(root).unwrap();
    let pixels = RgbImage::from_fn(4, 3, |x, y| {
        Rgb([
            u8::try_from(x * 60).unwrap(),
            u8::try_from(y * 90).unwrap(),
            32,
        ])
    });
    for (name, format) in [
        ("png", ImageFormat::Png),
        ("jpg", ImageFormat::Jpeg),
        ("webp", ImageFormat::WebP),
        ("bmp", ImageFormat::Bmp),
        ("tiff", ImageFormat::Tiff),
    ] {
        let mut encoded = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(pixels.clone())
            .write_to(&mut encoded, format)
            .unwrap();
        fs::write(root.join(format!("original.{name}")), encoded.into_inner()).unwrap();
    }
    let jpeg = fs::read(root.join("original.jpg")).unwrap();
    for orientation in 1..=8 {
        let exif = oriented_exif(orientation);
        let mut source = vec![0xff, 0xd8, 0xff, 0xe1];
        source.extend_from_slice(&u16::try_from(exif.len() + 2).unwrap().to_be_bytes());
        source.extend_from_slice(&exif);
        source.extend_from_slice(&jpeg[2..]);
        fs::write(root.join(format!("orientation-{orientation}.jpg")), source).unwrap();
    }
    families(root);
    let mut paths = fs::read_dir(root)
        .unwrap()
        .map(|p| p.unwrap().path())
        .filter(|p| {
            matches!(
                p.extension().and_then(|e| e.to_str()),
                Some("png" | "jpg" | "webp" | "bmp" | "tiff" | "gif" | "svg" | "ico")
            )
        })
        .collect::<Vec<_>>();
    paths.sort();
    let files = paths.iter().map(|path| {
        let bytes = fs::read(path).unwrap();
        serde_json::json!({ "name": path.file_name().unwrap().to_str().unwrap(), "sha256": hex::encode(Sha256::digest(&bytes)), "bytes": bytes.len(), "width": if path.file_name().unwrap() == "svg-viewport.svg" {1600} else {4}, "height": if path.file_name().unwrap() == "svg-viewport.svg" {1200} else {3} })
    }).collect::<Vec<_>>();
    let manifest = serde_json::json!({ "license": "Apache-2.0", "author": "Glitchpad contributors", "generator": "cargo run -p glitchpad-core --example generate_image_fixtures", "files": files });
    fs::write(
        root.join("manifest.json"),
        format!("{}\n", serde_json::to_string_pretty(&manifest).unwrap()),
    )
    .unwrap();
}
