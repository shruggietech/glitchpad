//! Inert, bounded image-family previews. No source markup reaches the browser.

mod animation;

use crate::images::{
    DecodedImage, ImageContainer, ImageEntry, ImageFailure, ImageFamily, ImageFamilyState,
    ImageLimits, ImagePreviewKind, SvgPreviewOutput, admit_surface, decode_image, raster_signature,
    rgba_preview,
};
use quick_xml::{Reader, events::Event};
use std::sync::atomic::{AtomicBool, Ordering};

pub use animation::{AnimationContext, animated_webp};

#[derive(Debug)]
pub struct FamilyPreview {
    pub preview: DecodedImage,
    pub state: ImageFamilyState,
}

/// Classifies a bounded content probe without trusting the filename.
pub fn image_signature(bytes: &[u8]) -> Option<ImageContainer> {
    if let Some(codec) = raster_signature(bytes) {
        return Some(codec.into());
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(ImageContainer::Gif);
    }
    if bytes.starts_with(&[0, 0, 1, 0]) {
        return Some(ImageContainer::Ico);
    }
    let mut reader = Reader::from_reader(&bytes[..bytes.len().min(4096)]);
    loop {
        match reader.read_event() {
            Ok(Event::Start(element) | Event::Empty(element)) => {
                return (element.name().as_ref() == "svg"
                    && element.attributes().flatten().any(|a| {
                        a.key.as_ref() == "xmlns"
                            && a.value.as_ref() == "http://www.w3.org/2000/svg"
                    }))
                .then_some(ImageContainer::Svg);
            }
            Ok(Event::Decl(_) | Event::Comment(_) | Event::Text(_) | Event::DocType(_)) => {}
            _ => return None,
        }
    }
}

pub(crate) fn check(cancel: &AtomicBool) -> Result<(), ImageFailure> {
    if cancel.load(Ordering::Acquire) {
        Err(ImageFailure::Cancelled)
    } else {
        Ok(())
    }
}

/// Produces a selected inert preview. Hosts retain `AnimationContext` for forward playback.
///
/// # Errors
/// Returns classified malformed, unsupported, admission, cancellation, or output errors.
pub fn decode_family(
    bytes: &[u8],
    selection: u32,
    limits: &ImageLimits,
    cancel: &AtomicBool,
) -> Result<FamilyPreview, ImageFailure> {
    check(cancel)?;
    match image_signature(bytes).ok_or(ImageFailure::UnsupportedCodec)? {
        ImageContainer::Svg => decode_svg(bytes, limits, cancel),
        ImageContainer::Ico => decode_ico(bytes, selection, limits, cancel),
        ImageContainer::Gif => {
            AnimationContext::new(bytes, limits, cancel)?.frame(selection, cancel)
        }
        ImageContainer::Webp if animation::animated_webp(bytes) => {
            AnimationContext::new(bytes, limits, cancel)?.frame(selection, cancel)
        }
        _ => {
            let preview = decode_image(bytes, limits, cancel)?;
            let state = ImageFamilyState::Raster {
                preview: preview.kind,
            };
            Ok(FamilyPreview { preview, state })
        }
    }
}

fn svg_attributes(
    e: &quick_xml::events::BytesStart<'_>,
    path_tokens: &mut usize,
) -> Result<(), ImageFailure> {
    for (index, attribute) in e.attributes().enumerate() {
        if index >= 64 {
            return Err(ImageFailure::Oversized);
        }
        let attribute = attribute.map_err(|_| ImageFailure::Malformed)?;
        let key = attribute.key.as_ref();
        let value = attribute
            .normalized_value(quick_xml::XmlVersion::Implicit1_0)
            .map_err(|_| ImageFailure::Malformed)?;
        if value.len() > 65536
            || key.starts_with("on")
            || key.ends_with("href")
            || key == "style"
            || value.contains('\\')
            || value.contains('@')
            || (value.contains("url(")
                && !value
                    .split("url(")
                    .skip(1)
                    .all(|v| v.starts_with('#') || v.starts_with("'#") || v.starts_with("\"#")))
        {
            return Err(ImageFailure::UnsupportedCodec);
        }
        if key == "d" || key == "points" {
            *path_tokens += value
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '.')
                .count();
        }
    }
    Ok(())
}

fn preflight_svg<'a>(
    text: &'a str,
    cancel: &AtomicBool,
    deadline: std::time::Instant,
) -> Result<roxmltree::Document<'a>, ImageFailure> {
    let mut reader = Reader::from_str(text);
    let (mut nodes, mut depth, mut path_tokens, mut text_chars) = (0_u32, 0_u32, 0_usize, 0_usize);
    loop {
        check(cancel)?;
        if std::time::Instant::now() > deadline {
            return Err(ImageFailure::Deadline);
        }
        let event = reader.read_event().map_err(|_| ImageFailure::Malformed)?;
        if matches!(event, Event::Start(_)) {
            depth += 1;
        }
        if depth > 128 {
            return Err(ImageFailure::Oversized);
        }
        match event {
            Event::Start(ref e) | Event::Empty(ref e) => {
                nodes += 1;
                let name = e.name();
                let name = name.as_ref();
                if matches!(
                    name,
                    "script"
                        | "foreignObject"
                        | "image"
                        | "use"
                        | "filter"
                        | "pattern"
                        | "mask"
                        | "marker"
                        | "style"
                        | "a"
                        | "animate"
                        | "animateTransform"
                        | "set"
                ) || name.contains(':')
                {
                    return Err(ImageFailure::UnsupportedCodec);
                }
                svg_attributes(e, &mut path_tokens)?;
                if nodes > 50_000 || path_tokens > 250_000 {
                    return Err(ImageFailure::Oversized);
                }
            }
            Event::Text(e) => {
                text_chars += e.len();
                if text_chars > 65536 {
                    return Err(ImageFailure::Oversized);
                }
            }
            Event::DocType(_) | Event::PI(_) => return Err(ImageFailure::UnsupportedCodec),
            Event::End(_) => {
                depth = depth.checked_sub(1).ok_or(ImageFailure::Malformed)?;
            }
            Event::Eof => break,
            _ => {}
        }
    }
    // The DOM parser refuses DTD expansion and stops before exceeding its node budget.
    let document = roxmltree::Document::parse_with_options(
        text,
        roxmltree::ParsingOptions {
            allow_dtd: false,
            nodes_limit: 50_000,
            ..Default::default()
        },
    )
    .map_err(|_| ImageFailure::Malformed)?;
    for node in document.descendants() {
        depth = depth.max(u32::try_from(node.ancestors().take(130).count()).unwrap_or(130));
        if depth > 128 {
            return Err(ImageFailure::Oversized);
        }
    }
    Ok(document)
}

fn decode_svg(
    bytes: &[u8],
    limits: &ImageLimits,
    cancel: &AtomicBool,
) -> Result<FamilyPreview, ImageFailure> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
    if bytes.len() > 4 * 1024 * 1024 {
        return Err(ImageFailure::Oversized);
    }
    let text = std::str::from_utf8(bytes).map_err(|_| ImageFailure::Malformed)?;
    let document = preflight_svg(text, cancel, deadline)?;
    let mut options = resvg::usvg::Options {
        font_family: "Geist".into(),
        ..Default::default()
    };
    options.image_href_resolver = resvg::usvg::ImageHrefResolver {
        resolve_data: Box::new(|_, _, _| None),
        resolve_string: Box::new(|_, _| None),
    };
    options
        .fontdb_mut()
        .load_font_data(include_bytes!("../../../brand/fonts/ttf/Geist-Regular.ttf").to_vec());
    check(cancel)?;
    let tree = resvg::usvg::Tree::from_xmltree(&document, &options)
        .map_err(|_| ImageFailure::Malformed)?;
    if std::time::Instant::now() > deadline {
        return Err(ImageFailure::Deadline);
    }
    let size = tree.size().to_int_size();
    admit_surface(size.width(), size.height(), 8, bytes.len() as u64, limits)?;
    check(cancel)?;
    let mut pixmap = resvg::tiny_skia::Pixmap::new(size.width(), size.height())
        .ok_or(ImageFailure::Allocation)?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::default(),
        &mut pixmap.as_mut(),
    );
    if std::time::Instant::now() > deadline {
        return Err(ImageFailure::Deadline);
    }
    check(cancel)?;
    let rgba = pixmap.take_demultiplied();
    let mut preview = rgba_preview(
        &rgba,
        size.width(),
        size.height(),
        ImageContainer::Svg,
        ImageFamily::Svg,
        cancel,
    )?;
    preview.descriptor.limitations.extend([
        "bundled_geist_font_only".into(),
        "unsupported_svg_constructs_refused".into(),
    ]);
    Ok(FamilyPreview {
        preview,
        state: ImageFamilyState::Svg {
            output: SvgPreviewOutput::RasterizedPng,
            external_resources: false,
            scripts: false,
            max_nodes: 50_000,
            max_depth: 128,
        },
    })
}

fn u16le(bytes: &[u8], offset: usize) -> Result<u16, ImageFailure> {
    let b: [u8; 2] = bytes
        .get(offset..offset + 2)
        .ok_or(ImageFailure::Truncated)?
        .try_into()
        .map_err(|_| ImageFailure::Truncated)?;
    Ok(u16::from_le_bytes(b))
}
pub(crate) fn u32le(bytes: &[u8], offset: usize) -> Result<u32, ImageFailure> {
    let b: [u8; 4] = bytes
        .get(offset..offset + 4)
        .ok_or(ImageFailure::Truncated)?
        .try_into()
        .map_err(|_| ImageFailure::Truncated)?;
    Ok(u32::from_le_bytes(b))
}

fn png_icon_dimensions(payload: &[u8], width: u32, height: u32) -> bool {
    payload.get(12..16) == Some(b"IHDR")
        && payload.get(16..24).is_some_and(|b| {
            u32::from_be_bytes(b[..4].try_into().unwrap_or_default()) == width
                && u32::from_be_bytes(b[4..].try_into().unwrap_or_default()) == height
        })
}

/// Inspects every bounded icon directory row without decoding unrelated payloads.
///
/// # Errors
/// Rejects malformed directories and out-of-source entry ranges.
pub fn ico_inventory(bytes: &[u8], cancel: &AtomicBool) -> Result<Vec<ImageEntry>, ImageFailure> {
    if bytes.len() as u64 > crate::images::MAX_IMAGE_SOURCE_BYTES {
        return Err(ImageFailure::Oversized);
    }
    let count = u16le(bytes, 4)?;
    if count == 0 || count > 256 {
        return Err(ImageFailure::Oversized);
    }
    let directory_end = 6 + usize::from(count) * 16;
    if bytes.len() < directory_end {
        return Err(ImageFailure::Truncated);
    }
    let mut entries = Vec::with_capacity(usize::from(count));
    let mut fingerprints: Vec<Option<[u8; 32]>> = Vec::with_capacity(usize::from(count));
    let mut range_hashes = std::collections::HashMap::new();
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
    let mut scanned = 0_usize;
    for index in 0..count {
        check(cancel)?;
        let at = 6 + usize::from(index) * 16;
        let width = if bytes[at] == 0 {
            256
        } else {
            u32::from(bytes[at])
        };
        let height = if bytes[at + 1] == 0 {
            256
        } else {
            u32::from(bytes[at + 1])
        };
        let length = usize::try_from(u32le(bytes, at + 8)?).map_err(|_| ImageFailure::Oversized)?;
        let start = usize::try_from(u32le(bytes, at + 12)?).map_err(|_| ImageFailure::Oversized)?;
        let end = start.checked_add(length).ok_or(ImageFailure::Oversized)?;
        if start < directory_end {
            return Err(ImageFailure::Malformed);
        }
        let payload = bytes.get(start..end).ok_or(ImageFailure::Truncated)?;
        let png = payload.starts_with(b"\x89PNG\r\n\x1a\n");
        let valid = if png {
            png_icon_dimensions(payload, width, height)
        } else {
            u32le(payload, 0).is_ok_and(|n| n >= 40)
                && u32le(payload, 4) == Ok(width)
                && u32le(payload, 8) == Ok(height * 2)
                && u16le(payload, 12) == Ok(1)
                && u16le(payload, 14).is_ok_and(|n| matches!(n, 1 | 4 | 8 | 16 | 24 | 32))
        };
        let fingerprint = if valid && length <= 8 * 1024 * 1024 {
            if let Some(hash) = range_hashes.get(&(start, end)) {
                Some(*hash)
            } else {
                use sha2::{Digest, Sha256};
                scanned = scanned.checked_add(length).ok_or(ImageFailure::Oversized)?;
                if scanned > 128 * 1024 * 1024 {
                    return Err(ImageFailure::Oversized);
                }
                let mut digest = Sha256::new();
                for chunk in payload.chunks(1024 * 1024) {
                    check(cancel)?;
                    if std::time::Instant::now() > deadline {
                        return Err(ImageFailure::Deadline);
                    }
                    digest.update(chunk);
                }
                let hash: [u8; 32] = digest.finalize().into();
                range_hashes.insert((start, end), hash);
                Some(hash)
            }
        } else {
            None
        };
        let duplicate_of = fingerprint
            .and_then(|hash| fingerprints.iter().position(|old| *old == Some(hash)))
            .and_then(|n| u16::try_from(n).ok());
        fingerprints.push(fingerprint);
        let valid = valid && length <= 8 * 1024 * 1024;
        entries.push(ImageEntry {
            index,
            width,
            height,
            bits_per_pixel: u16le(bytes, at + 6)?,
            encoded_bytes: length as u64,
            preview: if valid {
                ImagePreviewKind::Full
            } else {
                ImagePreviewKind::Unavailable
            },
            encoding: if png { "png" } else { "dib" }.into(),
            alpha: if png && valid {
                payload.get(25).map(|n| matches!(n, 4 | 6))
            } else {
                None
            },
            failure: (!valid).then_some(ImageFailure::Malformed),
            duplicate_of,
        });
    }
    Ok(entries)
}

fn decode_ico(
    bytes: &[u8],
    selection: u32,
    limits: &ImageLimits,
    cancel: &AtomicBool,
) -> Result<FamilyPreview, ImageFailure> {
    decode_ico_entry(
        bytes,
        ico_inventory(bytes, cancel)?,
        selection,
        limits,
        cancel,
    )
}

/// Decodes one independently validated row from the bounded inventory.
///
/// # Errors
/// Rejects inconsistent selected rows, malformed payloads, cancellation, and admission failures.
pub fn decode_ico_entry(
    bytes: &[u8],
    mut entries: Vec<ImageEntry>,
    selection: u32,
    limits: &ImageLimits,
    cancel: &AtomicBool,
) -> Result<FamilyPreview, ImageFailure> {
    use image::ImageDecoder;
    check(cancel)?;
    if entries.is_empty() || entries.len() > 256 || usize::from(u16le(bytes, 4)?) != entries.len() {
        return Err(ImageFailure::Malformed);
    }
    let selected = usize::try_from(selection).map_err(|_| ImageFailure::Malformed)?;
    let entry = entries.get(selected).ok_or(ImageFailure::Malformed)?;
    if let Some(failure) = entry.failure {
        return Err(failure);
    }
    let at = 6 + selected * 16;
    let start = usize::try_from(u32le(bytes, at + 12)?).map_err(|_| ImageFailure::Oversized)?;
    let length = usize::try_from(u32le(bytes, at + 8)?).map_err(|_| ImageFailure::Oversized)?;
    let end = start.checked_add(length).ok_or(ImageFailure::Oversized)?;
    let payload = bytes.get(start..end).ok_or(ImageFailure::Truncated)?;
    if start < 6 + 16 * entries.len()
        || entry.width == 0
        || entry.height == 0
        || entry.width > 256
        || entry.height > 256
        || length > 8 * 1024 * 1024
        || (entry.encoding == "png" && !png_icon_dimensions(payload, entry.width, entry.height))
        || (entry.encoding == "dib"
            && (u32le(payload, 4) != Ok(entry.width) || u32le(payload, 8) != Ok(entry.height * 2)))
    {
        return Err(ImageFailure::Malformed);
    }
    admit_surface(entry.width, entry.height, 8, bytes.len() as u64, limits)?;
    let mut preview = if entry.encoding == "png" {
        decode_image(payload, limits, cancel)?
    } else {
        let mut single = vec![0, 0, 1, 0, 1, 0];
        let at = 6 + selected * 16;
        single.extend_from_slice(&bytes[at..at + 16]);
        single[18..22].copy_from_slice(&22_u32.to_le_bytes());
        single.extend_from_slice(payload);
        let decoder = image::codecs::ico::IcoDecoder::new(std::io::Cursor::new(single))
            .map_err(|_| ImageFailure::Malformed)?;
        if decoder.dimensions() != (entry.width, entry.height)
            || decoder.total_bytes() > limits.surface_bytes
        {
            return Err(ImageFailure::Malformed);
        }
        let rgba = image::DynamicImage::from_decoder(decoder)
            .map_err(|_| ImageFailure::Malformed)?
            .into_rgba8();
        rgba_preview(
            rgba.as_raw(),
            entry.width,
            entry.height,
            ImageContainer::Ico,
            ImageFamily::Ico,
            cancel,
        )?
    };
    preview.descriptor.codec = ImageContainer::Ico;
    preview.descriptor.family = ImageFamily::Ico;
    preview.descriptor.capabilities = crate::images::family_capabilities(ImageFamily::Ico);
    entries[selected].alpha = Some(preview.descriptor.alpha);
    Ok(FamilyPreview {
        preview,
        state: ImageFamilyState::Ico {
            entries,
            selected_entry: u16::try_from(selection).ok(),
            selected_entry_export: true,
        },
    })
}
