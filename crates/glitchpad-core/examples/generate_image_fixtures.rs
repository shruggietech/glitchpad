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
    let mut paths = fs::read_dir(root)
        .unwrap()
        .map(|p| p.unwrap().path())
        .filter(|p| {
            matches!(
                p.extension().and_then(|e| e.to_str()),
                Some("png" | "jpg" | "webp" | "bmp" | "tiff")
            )
        })
        .collect::<Vec<_>>();
    paths.sort();
    let files = paths.iter().map(|path| {
        let bytes = fs::read(path).unwrap();
        serde_json::json!({ "name": path.file_name().unwrap().to_str().unwrap(), "sha256": format!("{:x}", Sha256::digest(&bytes)), "bytes": bytes.len(), "width": 4, "height": 3 })
    }).collect::<Vec<_>>();
    let manifest = serde_json::json!({ "license": "Apache-2.0", "author": "Glitchpad contributors", "generator": "cargo run -p glitchpad-core --example generate_image_fixtures", "files": files });
    fs::write(
        root.join("manifest.json"),
        format!("{}\n", serde_json::to_string_pretty(&manifest).unwrap()),
    )
    .unwrap();
}
