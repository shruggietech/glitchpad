//! Native image contracts and checked application-owned allocation admission.

use image::{DynamicImage, ImageDecoder, ImageEncoder, ImageFormat, ImageReader};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Write};
use std::sync::atomic::{AtomicBool, Ordering};

pub const IMAGE_CONTRACT_VERSION: u32 = 1;
pub const MAX_IMAGE_SOURCE_BYTES: u64 = 128 * 1024 * 1024;
pub const MAX_IMAGE_PNG_BYTES: usize = 8 * 1024 * 1024;
pub const FULL_IMAGE_PIXELS: u64 = 100_000_000;
pub const REFUSE_IMAGE_PIXELS: u64 = 200_000_000;

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ImageResourcePolicy {
    pub encoded_bytes: u64,
    pub png_bytes: u64,
    pub full_pixels: u64,
    pub refuse_pixels: u64,
    pub surface_bytes: u64,
    pub peak_bytes: u64,
    pub metadata_block_bytes: u64,
    pub metadata_total_bytes: u64,
    pub metadata_facts: u32,
    pub max_frames: u32,
    pub max_composited_frames: u32,
    pub max_entries: u16,
    pub max_svg_nodes: u32,
    pub max_svg_depth: u32,
    pub concurrent_decodes: u8,
    pub cancellation_scheduling_ms: u16,
}

pub const fn image_resource_policy(limits: ImageLimits) -> ImageResourcePolicy {
    ImageResourcePolicy {
        encoded_bytes: MAX_IMAGE_SOURCE_BYTES,
        png_bytes: 8 * 1024 * 1024,
        full_pixels: FULL_IMAGE_PIXELS,
        refuse_pixels: REFUSE_IMAGE_PIXELS,
        surface_bytes: limits.surface_bytes,
        peak_bytes: limits.peak_bytes,
        metadata_block_bytes: 1024 * 1024,
        metadata_total_bytes: 4 * 1024 * 1024,
        metadata_facts: 256,
        max_frames: 1024,
        max_composited_frames: 2,
        max_entries: 256,
        max_svg_nodes: 50_000,
        max_svg_depth: 128,
        concurrent_decodes: 1,
        cancellation_scheduling_ms: 250,
    }
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageFamily {
    Raster,
    Animation,
    Svg,
    Ico,
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RasterCodec {
    Png,
    Jpeg,
    Webp,
    Bmp,
    Tiff,
}

/// Future families share an explicit output and lifecycle schema; these variants
/// are contracts, not enabled renderer implementations or format associations.
#[derive(Clone, Debug, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(tag = "family", rename_all = "snake_case")]
pub enum ImageFamilyState {
    Raster {
        preview: ImagePreviewKind,
    },
    Animation {
        paused: bool,
        selected_frame: u32,
        frame_count: Option<u32>,
        loop_count: Option<u32>,
        frame_duration_ms: Option<u32>,
        max_composited_frames: u32,
    },
    Svg {
        output: SvgPreviewOutput,
        external_resources: bool,
        scripts: bool,
        max_nodes: u32,
        max_depth: u32,
    },
    Ico {
        entries: Vec<ImageEntry>,
        selected_entry: Option<u16>,
        selected_entry_export: bool,
    },
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SvgPreviewOutput {
    Unavailable,
    RasterizedPng,
    SafeTree,
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ImageEntry {
    pub index: u16,
    pub width: u32,
    pub height: u32,
    pub bits_per_pixel: u16,
    pub encoded_bytes: u64,
    pub preview: ImagePreviewKind,
    pub encoding: String,
    pub alpha: Option<bool>,
    pub failure: Option<ImageFailure>,
    pub duplicate_of: Option<u16>,
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageLifecycle {
    Idle,
    Admitted,
    CancelRequested,
    Suspended,
    Disposed,
}

/// Common source envelope includes deferred containers without enabling their codecs.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageContainer {
    Png,
    Jpeg,
    Webp,
    Bmp,
    Tiff,
    Gif,
    Svg,
    Ico,
}

impl From<RasterCodec> for ImageContainer {
    fn from(codec: RasterCodec) -> Self {
        match codec {
            RasterCodec::Png => Self::Png,
            RasterCodec::Jpeg => Self::Jpeg,
            RasterCodec::Webp => Self::Webp,
            RasterCodec::Bmp => Self::Bmp,
            RasterCodec::Tiff => Self::Tiff,
        }
    }
}

#[derive(Clone, Debug, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ImageFamilyContract {
    pub contract_version: u32,
    pub container: ImageContainer,
    pub state: ImageFamilyState,
    pub raster_descriptor: Option<ImageDescriptor>,
    pub metadata: crate::image_metadata::ImageMetadataReport,
    pub resources: ImageResourcePolicy,
    pub capabilities: ImageCapabilities,
    pub lifecycle: ImageLifecycle,
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[allow(clippy::struct_excessive_bools)] // Independent wire capabilities mirror the existing renderer contract.
pub struct ImageCapabilities {
    pub view: bool,
    pub inspect_metadata: bool,
    pub zoom: bool,
    pub animate: bool,
    pub select_frame: bool,
    pub select_entry: bool,
    pub export_entry: bool,
    pub edit: bool,
    pub save: bool,
}

pub const fn family_capabilities(family: ImageFamily) -> ImageCapabilities {
    ImageCapabilities {
        view: true,
        inspect_metadata: true,
        zoom: true,
        animate: matches!(family, ImageFamily::Animation),
        select_frame: matches!(family, ImageFamily::Animation),
        select_entry: matches!(family, ImageFamily::Ico),
        export_entry: matches!(family, ImageFamily::Ico),
        edit: false,
        save: false,
    }
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ImageLimits {
    pub surface_bytes: u64,
    pub peak_bytes: u64,
}

impl ImageLimits {
    pub const fn desktop() -> Self {
        Self {
            surface_bytes: 400_000_000,
            peak_bytes: 1024 * 1024 * 1024,
        }
    }
    pub const fn android() -> Self {
        Self {
            surface_bytes: 128 * 1024 * 1024,
            peak_bytes: 384 * 1024 * 1024,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageFailure {
    Malformed,
    Truncated,
    Oversized,
    UnsupportedCodec,
    Metadata,
    Allocation,
    SourceRevised,
    Revoked,
    Cancelled,
    Busy,
    OutputLimit,
    Deadline,
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImagePreviewKind {
    Full,
    Thumbnail,
    Unavailable,
    Refused,
}

#[derive(Clone, Debug, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ImageDescriptor {
    pub contract_version: u32,
    pub family: ImageFamily,
    pub codec: ImageContainer,
    pub width: u32,
    pub height: u32,
    pub display_width: u32,
    pub display_height: u32,
    pub pixels: u64,
    pub decoded_bytes: u64,
    pub orientation: u16,
    pub color_policy: String,
    pub profile_status: String,
    pub alpha: bool,
    pub bits_per_pixel: u16,
    pub capabilities: ImageCapabilities,
    pub limitations: Vec<String>,
}

/// Identifies only reviewed raster signatures; filenames are never format authority.
pub fn raster_signature(bytes: &[u8]) -> Option<RasterCodec> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(RasterCodec::Png)
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some(RasterCodec::Jpeg)
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(RasterCodec::Webp)
    } else if bytes.starts_with(b"BM") {
        Some(RasterCodec::Bmp)
    } else if bytes.starts_with(b"II\x2a\x00") || bytes.starts_with(b"MM\x00\x2a") {
        Some(RasterCodec::Tiff)
    } else {
        None
    }
}

/// Reserves checked pixel, native/normalized intermediate, encoded-copy, and delivery budgets.
///
/// # Errors
/// Returns a classified limit error before any prohibited output surface allocation.
pub fn admit_surface(
    width: u32,
    height: u32,
    native_bytes_per_pixel: u64,
    encoded_bytes: u64,
    limits: &ImageLimits,
) -> Result<u64, ImageFailure> {
    if width == 0 || height == 0 || native_bytes_per_pixel == 0 || native_bytes_per_pixel > 16 {
        return Err(ImageFailure::Malformed);
    }
    let pixels = u64::from(width)
        .checked_mul(u64::from(height))
        .ok_or(ImageFailure::Oversized)?;
    if pixels > FULL_IMAGE_PIXELS || encoded_bytes > MAX_IMAGE_SOURCE_BYTES {
        return Err(ImageFailure::Oversized);
    }
    let rgba = pixels.checked_mul(4).ok_or(ImageFailure::Oversized)?;
    let native = pixels
        .checked_mul(native_bytes_per_pixel)
        .ok_or(ImageFailure::Oversized)?;
    if rgba > limits.surface_bytes || native > limits.surface_bytes {
        return Err(ImageFailure::Allocation);
    }
    let delivery = rgba
        .checked_add(u64::from(height))
        .and_then(|n| n.checked_add(65_536))
        .map(|n| n.min(MAX_IMAGE_PNG_BYTES as u64))
        .and_then(|n| n.checked_mul(16))
        .ok_or(ImageFailure::Allocation)?;
    let peak = rgba
        .max(native)
        .checked_mul(2)
        .and_then(|n| encoded_bytes.checked_mul(2).and_then(|e| n.checked_add(e)))
        .and_then(|n| n.checked_add(delivery))
        .and_then(|n| n.checked_add(64 * 1024 * 1024))
        .ok_or(ImageFailure::Allocation)?;
    if peak > limits.peak_bytes {
        return Err(ImageFailure::Allocation);
    }
    Ok(rgba)
}

#[derive(Clone, Debug, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct DecodedImage {
    pub descriptor: ImageDescriptor,
    pub kind: ImagePreviewKind,
    pub png_bytes: Vec<u8>,
}

fn image_format(codec: RasterCodec) -> ImageFormat {
    match codec {
        RasterCodec::Png => ImageFormat::Png,
        RasterCodec::Jpeg => ImageFormat::Jpeg,
        RasterCodec::Webp => ImageFormat::WebP,
        RasterCodec::Bmp => ImageFormat::Bmp,
        RasterCodec::Tiff => ImageFormat::Tiff,
    }
}

fn cancelled(flag: &AtomicBool) -> Result<(), ImageFailure> {
    if flag.load(Ordering::Acquire) {
        Err(ImageFailure::Cancelled)
    } else {
        Ok(())
    }
}

fn classified(error: &image::ImageError) -> ImageFailure {
    match error {
        image::ImageError::Limits(_) => ImageFailure::Allocation,
        image::ImageError::Unsupported(_) => ImageFailure::UnsupportedCodec,
        image::ImageError::IoError(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => {
            ImageFailure::Truncated
        }
        _ => ImageFailure::Malformed,
    }
}

struct BoundedPngWriter<'a> {
    bytes: Vec<u8>,
    cancelled: &'a AtomicBool,
}

impl Write for BoundedPngWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if self.cancelled.load(Ordering::Acquire) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Interrupted,
                "cancelled",
            ));
        }
        if bytes.len() > MAX_IMAGE_PNG_BYTES.saturating_sub(self.bytes.len()) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::FileTooLarge,
                "image output limit",
            ));
        }
        self.bytes.try_reserve(bytes.len()).map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::OutOfMemory, "image allocation limit")
        })?;
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn animation_poster(bytes: &[u8], codec: RasterCodec) -> bool {
    match codec {
        RasterCodec::Webp => {
            bytes.get(12..16) == Some(b"VP8X") && bytes.get(20).is_some_and(|flags| flags & 2 != 0)
        }
        RasterCodec::Png => {
            let mut cursor = 8usize;
            for _ in 0..4096 {
                let Some(header) = bytes.get(cursor..cursor.saturating_add(8)) else {
                    return false;
                };
                if &header[4..8] == b"acTL" {
                    return true;
                }
                let length =
                    u32::from_be_bytes([header[0], header[1], header[2], header[3]]) as usize;
                let Some(next) = cursor.checked_add(12).and_then(|n| n.checked_add(length)) else {
                    return false;
                };
                if next > bytes.len() {
                    return false;
                }
                cursor = next;
            }
            false
        }
        _ => false,
    }
}

fn png_pixel_stream(bytes: &[u8], cancel: &AtomicBool) -> Result<Vec<u8>, ImageFailure> {
    let mut output = Vec::new();
    output
        .try_reserve_exact(bytes.len())
        .map_err(|_| ImageFailure::Allocation)?;
    output.extend_from_slice(bytes.get(..8).ok_or(ImageFailure::Truncated)?);
    let mut offset = 8usize;
    for _ in 0..4096 {
        cancelled(cancel)?;
        let header = bytes
            .get(offset..offset.checked_add(8).ok_or(ImageFailure::Oversized)?)
            .ok_or(ImageFailure::Truncated)?;
        let length = u32::from_be_bytes(
            header[..4]
                .try_into()
                .map_err(|_| ImageFailure::Malformed)?,
        ) as usize;
        let end = offset
            .checked_add(12)
            .and_then(|n| n.checked_add(length))
            .ok_or(ImageFailure::Oversized)?;
        let chunk = bytes.get(offset..end).ok_or(ImageFailure::Truncated)?;
        let kind = &header[4..8];
        if !matches!(kind, b"eXIf" | b"iCCP" | b"tEXt" | b"zTXt" | b"iTXt") {
            output.extend_from_slice(chunk);
        }
        if kind == b"IEND" {
            return Ok(output);
        }
        offset = end;
    }
    Err(ImageFailure::Oversized)
}

/// Decodes a reviewed container after checked admission, returning bounded inert PNG.
/// Decoder allocation hints supplement admission; they do not provide process isolation.
///
/// # Errors
/// Returns only schema-defined failures and never source bytes or parser diagnostics.
pub fn decode_image(
    bytes: &[u8],
    limits: &ImageLimits,
    cancel: &AtomicBool,
) -> Result<DecodedImage, ImageFailure> {
    decode_image_inner(bytes, limits, cancel, true, None)
}

#[allow(clippy::too_many_lines)] // Keep checked admission and owned decode stages in one auditable sequence.
fn decode_image_inner(
    bytes: &[u8],
    limits: &ImageLimits,
    cancel: &AtomicBool,
    allow_thumbnail: bool,
    orientation_hint: Option<image::metadata::Orientation>,
) -> Result<DecodedImage, ImageFailure> {
    cancelled(cancel)?;
    if bytes.len() as u64 > MAX_IMAGE_SOURCE_BYTES {
        return Err(ImageFailure::Oversized);
    }
    let codec = raster_signature(bytes).ok_or(ImageFailure::UnsupportedCodec)?;
    let pixel_bytes = if codec == RasterCodec::Png {
        std::borrow::Cow::Owned(png_pixel_stream(bytes, cancel)?)
    } else {
        std::borrow::Cow::Borrowed(bytes)
    };
    let mut reader =
        ImageReader::with_format(Cursor::new(pixel_bytes.as_ref()), image_format(codec));
    let mut decoder_limits = image::Limits::default();
    decoder_limits.max_alloc = Some(limits.peak_bytes);
    decoder_limits.max_image_width = Some(200_000_000);
    decoder_limits.max_image_height = Some(200_000_000);
    reader.limits(decoder_limits);
    let decoder = reader.into_decoder().map_err(|e| classified(&e))?;
    cancelled(cancel)?;
    let (width, height) = decoder.dimensions();
    let pixels = u64::from(width)
        .checked_mul(u64::from(height))
        .ok_or(ImageFailure::Oversized)?;
    if pixels > REFUSE_IMAGE_PIXELS || (!allow_thumbnail && pixels > 4_000_000) {
        return Err(ImageFailure::Oversized);
    }
    let color = decoder.color_type();
    let metadata = crate::image_metadata::extract_image_metadata(bytes);
    cancelled(cancel)?;
    let orientation = metadata
        .observations
        .iter()
        .find(|o| o.key == "image.orientation")
        .and_then(|o| match &o.value {
            Some(crate::metadata::MetadataValue::Integer(n)) => n.parse::<u8>().ok(),
            _ => None,
        })
        .and_then(image::metadata::Orientation::from_exif)
        .or(orientation_hint)
        .unwrap_or(image::metadata::Orientation::NoTransforms);
    let mut admission = admit_surface(
        width,
        height,
        u64::from(color.bytes_per_pixel()),
        bytes.len() as u64,
        limits,
    );
    if codec == RasterCodec::Webp && animation_poster(bytes, codec) {
        let animated_peak = pixels
            .checked_mul(12)
            .and_then(|n| {
                (bytes.len() as u64)
                    .checked_mul(2)
                    .and_then(|e| n.checked_add(e))
            })
            .and_then(|n| n.checked_add(192 * 1024 * 1024));
        if animated_peak.is_none_or(|n| n > limits.peak_bytes) {
            admission = Err(ImageFailure::Allocation);
        }
    }
    if admission.is_err() || decoder.total_bytes() > limits.surface_bytes {
        if !allow_thumbnail {
            return Err(admission.err().unwrap_or(ImageFailure::Allocation));
        }
        // Drop the full decoder before attempting a separately admitted embedded
        // thumbnail. No full pixel decode is performed on this path.
        drop(decoder);
        cancelled(cancel)?;
        let Some(thumbnail) = metadata.thumbnail else {
            return Err(admission.err().unwrap_or(ImageFailure::Allocation));
        };
        let thumbnail_limits = ImageLimits {
            surface_bytes: limits.surface_bytes.min(16 * 1024 * 1024),
            peak_bytes: limits.peak_bytes.min(128 * 1024 * 1024),
        };
        // Embedded thumbnails cannot recursively trigger further degradation.
        let thumbnail_hint = metadata
            .thumbnail_orientation
            .and_then(image::metadata::Orientation::from_exif)
            .unwrap_or(orientation);
        let mut preview = decode_image_inner(
            &thumbnail,
            &thumbnail_limits,
            cancel,
            false,
            Some(thumbnail_hint),
        )?;
        if preview.kind != ImagePreviewKind::Full {
            return Err(ImageFailure::Oversized);
        }
        preview.kind = ImagePreviewKind::Thumbnail;
        preview.descriptor.codec = codec.into();
        preview.descriptor.width = width;
        preview.descriptor.height = height;
        preview.descriptor.pixels = pixels;
        preview.descriptor.orientation = u16::from(orientation.to_exif());
        preview.descriptor.alpha = color.has_alpha();
        preview.descriptor.bits_per_pixel = color.bits_per_pixel();
        preview.descriptor.profile_status = if metadata.profile_present {
            "not_applied"
        } else {
            "not_provided"
        }
        .into();
        preview.descriptor.family = if animation_poster(bytes, codec) {
            ImageFamily::Animation
        } else {
            ImageFamily::Raster
        };
        if codec == RasterCodec::Tiff {
            preview
                .descriptor
                .limitations
                .push("first_page_only".into());
        }
        if animation_poster(bytes, codec) {
            preview
                .descriptor
                .limitations
                .push("poster_only_animation_unavailable".into());
        }
        preview
            .descriptor
            .limitations
            .push("embedded_thumbnail_only".into());
        return Ok(preview);
    }
    let decoded_bytes = admission?;
    cancelled(cancel)?;
    let mut image = DynamicImage::from_decoder(decoder).map_err(|e| classified(&e))?;
    cancelled(cancel)?;
    image.apply_orientation(orientation);
    cancelled(cancel)?;
    let rgba = image.into_rgba8();
    let (display_width, display_height) = rgba.dimensions();
    let mut writer = BoundedPngWriter {
        bytes: Vec::new(),
        cancelled: cancel,
    };
    image::codecs::png::PngEncoder::new(&mut writer)
        .write_image(
            rgba.as_raw(),
            display_width,
            display_height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|_| {
            if cancel.load(Ordering::Acquire) {
                ImageFailure::Cancelled
            } else {
                ImageFailure::OutputLimit
            }
        })?;
    cancelled(cancel)?;
    let poster = animation_poster(bytes, codec);
    let mut limitations = vec!["unreleased_image_capability".into()];
    if poster {
        limitations.push("poster_only_animation_unavailable".into());
    }
    if codec == RasterCodec::Tiff {
        limitations.push("first_page_only".into());
    }
    let family = if poster {
        ImageFamily::Animation
    } else {
        ImageFamily::Raster
    };
    let mut capabilities = family_capabilities(ImageFamily::Raster);
    capabilities.animate = false;
    let descriptor = ImageDescriptor {
        contract_version: IMAGE_CONTRACT_VERSION,
        family,
        codec: codec.into(),
        width,
        height,
        display_width,
        display_height,
        pixels,
        decoded_bytes,
        orientation: u16::from(orientation.to_exif()),
        color_policy: "rgba8_srgb_assumed".into(),
        profile_status: if metadata.profile_present {
            "not_applied"
        } else {
            "not_provided"
        }
        .into(),
        alpha: color.has_alpha(),
        bits_per_pixel: color.bits_per_pixel(),
        capabilities,
        limitations,
    };
    Ok(DecodedImage {
        descriptor,
        kind: ImagePreviewKind::Full,
        png_bytes: writer.bytes,
    })
}

/// Encodes an already admitted straight-alpha surface through the bounded delivery writer.
///
/// # Errors
/// Rejects inconsistent surfaces, cancellation, and delivery budget exhaustion.
pub(crate) fn rgba_preview(
    rgba: &[u8],
    width: u32,
    height: u32,
    container: ImageContainer,
    family: ImageFamily,
    cancel: &AtomicBool,
) -> Result<DecodedImage, ImageFailure> {
    cancelled(cancel)?;
    let pixels = u64::from(width) * u64::from(height);
    if width == 0 || height == 0 || pixels.checked_mul(4) != Some(rgba.len() as u64) {
        return Err(ImageFailure::Malformed);
    }
    let mut writer = BoundedPngWriter {
        bytes: Vec::new(),
        cancelled: cancel,
    };
    image::codecs::png::PngEncoder::new(&mut writer)
        .write_image(rgba, width, height, image::ExtendedColorType::Rgba8)
        .map_err(|_| {
            if cancel.load(Ordering::Acquire) {
                ImageFailure::Cancelled
            } else {
                ImageFailure::OutputLimit
            }
        })?;
    cancelled(cancel)?;
    Ok(DecodedImage {
        descriptor: ImageDescriptor {
            contract_version: IMAGE_CONTRACT_VERSION,
            family,
            codec: container,
            width,
            height,
            display_width: width,
            display_height: height,
            pixels,
            decoded_bytes: pixels * 4,
            orientation: 1,
            color_policy: "rgba8_srgb_assumed".into(),
            profile_status: "not_applied".into(),
            alpha: true,
            bits_per_pixel: 32,
            capabilities: family_capabilities(family),
            limitations: vec!["unreleased_image_capability".into()],
        },
        kind: ImagePreviewKind::Full,
        png_bytes: writer.bytes,
    })
}
