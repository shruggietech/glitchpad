use glitchpad_core::images::{ImageLimits, RasterCodec, decode_image, raster_signature};
use image::{DynamicImage, ImageFormat};
use std::io::Cursor;
use std::sync::atomic::AtomicBool;

#[test]
fn five_reviewed_codecs_decode_to_inert_png_without_changing_source() {
    for (format, codec) in [
        (ImageFormat::Png, RasterCodec::Png),
        (ImageFormat::Jpeg, RasterCodec::Jpeg),
        (ImageFormat::WebP, RasterCodec::Webp),
        (ImageFormat::Bmp, RasterCodec::Bmp),
        (ImageFormat::Tiff, RasterCodec::Tiff),
    ] {
        let image = DynamicImage::new_rgb8(3, 2);
        let mut bytes = Cursor::new(Vec::new());
        image.write_to(&mut bytes, format).unwrap();
        let source = bytes.into_inner();
        let before = source.clone();
        assert_eq!(raster_signature(&source), Some(codec));
        let preview =
            decode_image(&source, &ImageLimits::desktop(), &AtomicBool::new(false)).unwrap();
        assert_eq!(
            (
                preview.descriptor.display_width,
                preview.descriptor.display_height
            ),
            (3, 2)
        );
        assert!(preview.png_bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
        assert_eq!(before, source);
    }
}

#[test]
fn malformed_and_cancelled_inputs_are_classified() {
    for bytes in [
        b"not an image".as_slice(),
        b"\x89PNG\r\n\x1a\n".as_slice(),
        b"\xff\xd8\xff".as_slice(),
    ] {
        assert!(decode_image(bytes, &ImageLimits::desktop(), &AtomicBool::new(false)).is_err());
    }
    assert!(decode_image(b"BM", &ImageLimits::desktop(), &AtomicBool::new(true)).is_err());
}

#[test]
fn all_eight_orientations_match_independently_transformed_pixels() {
    for orientation in 1..=8 {
        let source = std::fs::read(format!(
            "../../fixtures/images/orientation-{orientation}.jpg"
        ))
        .unwrap();
        let preview =
            decode_image(&source, &ImageLimits::desktop(), &AtomicBool::new(false)).unwrap();
        let mut expected = image::load_from_memory_with_format(&source, ImageFormat::Jpeg).unwrap();
        expected.apply_orientation(image::metadata::Orientation::from_exif(orientation).unwrap());
        let actual =
            image::load_from_memory_with_format(&preview.png_bytes, ImageFormat::Png).unwrap();
        assert_eq!(actual.into_rgba8(), expected.into_rgba8());
        assert_eq!(preview.descriptor.orientation, u16::from(orientation));
    }
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = !0u32;
    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            crc = (crc >> 1) ^ (0xedb8_8320 & 0u32.wrapping_sub(crc & 1));
        }
    }
    !crc
}

#[test]
fn compressed_metadata_cannot_break_or_expand_the_raster_decoder() {
    let original = include_bytes!("../../../fixtures/images/original.png");
    let mut source = original[..33].to_vec();
    // Invalid compressed text is metadata failure, independently of valid pixels.
    let payload = b"untrusted\0\0not-a-zlib-stream";
    source.extend_from_slice(&u32::try_from(payload.len()).unwrap().to_be_bytes());
    source.extend_from_slice(b"zTXt");
    source.extend_from_slice(payload);
    source.extend_from_slice(&crc32(&[b"zTXt".as_slice(), payload].concat()).to_be_bytes());
    source.extend_from_slice(&original[33..]);
    let preview = decode_image(&source, &ImageLimits::desktop(), &AtomicBool::new(false))
        .expect("compressed metadata must never reach the raster decoder");
    let expected = image::load_from_memory(original).unwrap().into_rgba8();
    assert_eq!(
        image::load_from_memory(&preview.png_bytes)
            .unwrap()
            .into_rgba8(),
        expected
    );
}

fn large_png_with_thumbnail(width: u32, height: u32) -> Vec<u8> {
    large_png_with_oriented_thumbnail(width, height, 1)
}

fn large_png_with_oriented_thumbnail(width: u32, height: u32, orientation: u16) -> Vec<u8> {
    let original = include_bytes!("../../../fixtures/images/original.png");
    let thumbnail = include_bytes!("../../../fixtures/images/original.jpg");
    let mut exif = b"II*\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0".to_vec();
    exif.extend_from_slice(&orientation.to_le_bytes());
    exif.extend_from_slice(&[0, 0, 26, 0, 0, 0, 2, 0]);
    for (tag, value) in [
        (0x0201u16, 56u32),
        (0x0202, u32::try_from(thumbnail.len()).unwrap()),
    ] {
        exif.extend_from_slice(&tag.to_le_bytes());
        exif.extend_from_slice(&4u16.to_le_bytes());
        exif.extend_from_slice(&1u32.to_le_bytes());
        exif.extend_from_slice(&value.to_le_bytes());
    }
    exif.extend_from_slice(&0u32.to_le_bytes());
    exif.extend_from_slice(thumbnail);
    let mut source = original[..33].to_vec();
    source[16..20].copy_from_slice(&width.to_be_bytes());
    source[20..24].copy_from_slice(&height.to_be_bytes());
    let crc = crc32(&source[12..29]);
    source[29..33].copy_from_slice(&crc.to_be_bytes());
    source.extend_from_slice(&u32::try_from(exif.len()).unwrap().to_be_bytes());
    source.extend_from_slice(b"eXIf");
    source.extend_from_slice(&exif);
    source.extend_from_slice(&crc32(&[b"eXIf".as_slice(), exif.as_slice()].concat()).to_be_bytes());
    source.extend_from_slice(&original[33..]);
    source
}

#[test]
fn degraded_thumbnail_applies_source_orientation_and_preserves_original_facts() {
    let source = large_png_with_oriented_thumbnail(10_001, 10_000, 6);
    let preview = decode_image(&source, &ImageLimits::desktop(), &AtomicBool::new(false)).unwrap();
    let mut expected = image::load_from_memory_with_format(
        include_bytes!("../../../fixtures/images/original.jpg"),
        ImageFormat::Jpeg,
    )
    .unwrap();
    expected.apply_orientation(image::metadata::Orientation::Rotate90);
    let actual = image::load_from_memory_with_format(&preview.png_bytes, ImageFormat::Png).unwrap();
    assert_eq!(actual.into_rgba8(), expected.into_rgba8());
    assert_eq!(preview.descriptor.orientation, 6);
    assert_eq!(
        (preview.descriptor.width, preview.descriptor.height),
        (10_001, 10_000)
    );
}

#[test]
fn thumbnail_degradation_never_decodes_the_full_surface_and_refuses_over_200mp() {
    for (width, height) in [(10_001, 10_000), (20_000, 10_000)] {
        let source = large_png_with_thumbnail(width, height);
        let preview =
            decode_image(&source, &ImageLimits::desktop(), &AtomicBool::new(false)).unwrap();
        assert_eq!(
            preview.kind,
            glitchpad_core::images::ImagePreviewKind::Thumbnail
        );
        assert_eq!(
            (preview.descriptor.width, preview.descriptor.height),
            (width, height)
        );
        assert_eq!(
            (
                preview.descriptor.display_width,
                preview.descriptor.display_height
            ),
            (4, 3)
        );
        assert_eq!(preview.descriptor.decoded_bytes, 48);
    }
    assert_eq!(
        decode_image(
            &large_png_with_thumbnail(20_001, 10_000),
            &ImageLimits::desktop(),
            &AtomicBool::new(false)
        )
        .unwrap_err(),
        glitchpad_core::images::ImageFailure::Oversized
    );
    let preview = decode_image(
        &large_png_with_thumbnail(10_000, 10_000),
        &ImageLimits::android(),
        &AtomicBool::new(false),
    )
    .unwrap();
    assert_eq!(
        preview.kind,
        glitchpad_core::images::ImagePreviewKind::Thumbnail
    );
}
