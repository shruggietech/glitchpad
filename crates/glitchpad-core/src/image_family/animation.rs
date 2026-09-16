//! Incremental composition with one source and at most two composited canvases.

use super::{FamilyPreview, check, u16le, u32le};
use crate::images::{
    ImageContainer, ImageFailure, ImageFamily, ImageFamilyState, ImageLimits,
    MAX_IMAGE_SOURCE_BYTES, admit_surface, rgba_preview,
};
use std::{
    io::Cursor,
    num::NonZeroU64,
    sync::{Arc, atomic::AtomicBool},
    time::{Duration, Instant},
};

#[derive(Clone, Debug)]
struct Inventory {
    width: u32,
    height: u32,
    durations: Vec<u32>,
    loops: Option<u32>,
}

pub fn animated_webp(bytes: &[u8]) -> bool {
    bytes.get(12..16) == Some(b"VP8X") && bytes.get(20).is_some_and(|flag| flag & 2 != 0)
}

fn u24(bytes: &[u8], at: usize) -> Result<u32, ImageFailure> {
    let b = bytes.get(at..at + 3).ok_or(ImageFailure::Truncated)?;
    Ok(u32::from(b[0]) | (u32::from(b[1]) << 8) | (u32::from(b[2]) << 16))
}

fn timing(durations: &mut Vec<u32>, duration: u32) -> Result<(), ImageFailure> {
    if durations.len() >= 1024
        || duration > 60_000
        || durations.iter().map(|n| u64::from(*n)).sum::<u64>() + u64::from(duration) > 1_800_000
    {
        return Err(ImageFailure::Oversized);
    }
    durations.push(duration);
    Ok(())
}

fn rect(width: u32, height: u32, x: u32, y: u32, w: u32, h: u32) -> Result<(), ImageFailure> {
    if w == 0
        || h == 0
        || x.checked_add(w).is_none_or(|n| n > width)
        || y.checked_add(h).is_none_or(|n| n > height)
    {
        Err(ImageFailure::Malformed)
    } else {
        Ok(())
    }
}

fn subblocks(bytes: &[u8], mut at: usize) -> Result<usize, ImageFailure> {
    loop {
        let size = usize::from(*bytes.get(at).ok_or(ImageFailure::Truncated)?);
        at += 1;
        if size == 0 {
            return Ok(at);
        }
        at = at.checked_add(size).ok_or(ImageFailure::Oversized)?;
        if at > bytes.len() {
            return Err(ImageFailure::Truncated);
        }
    }
}

fn gif_inventory(bytes: &[u8], cancel: &AtomicBool) -> Result<(Inventory, Vec<u8>), ImageFailure> {
    let width = u32::from(u16le(bytes, 6)?);
    let height = u32::from(u16le(bytes, 8)?);
    let flag = *bytes.get(10).ok_or(ImageFailure::Truncated)?;
    let mut at = 13
        + if flag & 128 != 0 {
            3 * (1_usize << ((flag & 7) + 1))
        } else {
            0
        };
    let prefix = bytes.get(..at).ok_or(ImageFailure::Truncated)?;
    let mut sanitized = Vec::with_capacity(bytes.len());
    sanitized.extend_from_slice(prefix);
    let (mut durations, mut loops, mut delay) = (Vec::new(), None, 0);
    loop {
        check(cancel)?;
        let start = at;
        match *bytes.get(at).ok_or(ImageFailure::Truncated)? {
            0x3b => {
                sanitized.push(0x3b);
                break;
            }
            0x21 => {
                let label = *bytes.get(at + 1).ok_or(ImageFailure::Truncated)?;
                at = subblocks(bytes, at + 2)?;
                if label == 0xf9 {
                    if bytes.get(start + 2) != Some(&4) || at != start + 8 {
                        return Err(ImageFailure::Malformed);
                    }
                    delay = u32::from(u16le(bytes, start + 4)?) * 10;
                    sanitized.extend_from_slice(&bytes[start..at]);
                } else if label == 0xff && bytes.get(start + 3..start + 14) == Some(b"NETSCAPE2.0")
                {
                    if bytes.get(start + 14..start + 16) != Some(&[3, 1]) {
                        return Err(ImageFailure::Malformed);
                    }
                    loops = Some(u32::from(u16le(bytes, start + 16)?));
                    sanitized.extend_from_slice(&bytes[start..at]);
                }
                // Unregistered application/comment metadata cannot allocate inside the pixel decoder.
            }
            0x2c => {
                rect(
                    width,
                    height,
                    u32::from(u16le(bytes, at + 1)?),
                    u32::from(u16le(bytes, at + 3)?),
                    u32::from(u16le(bytes, at + 5)?),
                    u32::from(u16le(bytes, at + 7)?),
                )?;
                let local = *bytes.get(at + 9).ok_or(ImageFailure::Truncated)?;
                at += 10
                    + if local & 128 != 0 {
                        3 * (1_usize << ((local & 7) + 1))
                    } else {
                        0
                    };
                if bytes.get(at).is_none_or(|n| !(2..=8).contains(n)) {
                    return Err(ImageFailure::Malformed);
                }
                at = subblocks(bytes, at + 1)?;
                timing(&mut durations, delay)?;
                delay = 0;
                sanitized.extend_from_slice(&bytes[start..at]);
            }
            _ => return Err(ImageFailure::Malformed),
        }
    }
    if durations.is_empty() || at + 1 != bytes.len() {
        return Err(ImageFailure::Malformed);
    }
    Ok((
        Inventory {
            width,
            height,
            durations,
            loops,
        },
        sanitized,
    ))
}

fn webp_frame_headers(payload: &[u8], width: u32, height: u32) -> Result<(), ImageFailure> {
    if payload.get(15).is_none_or(|flags| flags & !3 != 0) {
        return Err(ImageFailure::Malformed);
    }
    let (mut at, mut alpha, mut image) = (16_usize, false, false);
    while at < payload.len() {
        let tag = payload.get(at..at + 4).ok_or(ImageFailure::Truncated)?;
        let length =
            usize::try_from(u32le(payload, at + 4)?).map_err(|_| ImageFailure::Oversized)?;
        let end = at
            .checked_add(8)
            .and_then(|n| n.checked_add(length))
            .ok_or(ImageFailure::Oversized)?;
        let encoded = payload.get(at + 8..end).ok_or(ImageFailure::Truncated)?;
        if tag == b"ALPH" && !alpha && !image && !encoded.is_empty() {
            alpha = true;
        } else {
            if image || (alpha && tag != b"VP8 ") {
                return Err(ImageFailure::Malformed);
            }
            let dimensions = match tag {
                b"VP8 "
                    if encoded.get(3..6) == Some(&[0x9d, 1, 0x2a])
                        && encoded.first().is_some_and(|n| n & 1 == 0) =>
                {
                    (
                        u32::from(u16le(encoded, 6)? & 0x3fff),
                        u32::from(u16le(encoded, 8)? & 0x3fff),
                    )
                }
                b"VP8L" if encoded.first() == Some(&0x2f) => {
                    let packed = u32le(encoded, 1)?;
                    if packed >> 29 != 0 {
                        return Err(ImageFailure::Malformed);
                    }
                    ((packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1)
                }
                _ => return Err(ImageFailure::Malformed),
            };
            if dimensions != (width, height) {
                return Err(ImageFailure::Malformed);
            }
            image = true;
        }
        at = end.checked_add(length & 1).ok_or(ImageFailure::Oversized)?;
        if at > payload.len() {
            return Err(ImageFailure::Truncated);
        }
    }
    if image {
        Ok(())
    } else {
        Err(ImageFailure::Malformed)
    }
}

fn webp_inventory(bytes: &[u8], cancel: &AtomicBool) -> Result<(Inventory, Vec<u8>), ImageFailure> {
    if bytes.get(..4) != Some(b"RIFF")
        || bytes.get(8..12) != Some(b"WEBP")
        || u64::from(u32le(bytes, 4)?) + 8 != bytes.len() as u64
    {
        return Err(ImageFailure::Malformed);
    }
    let (mut width, mut height, mut loops, mut durations) = (0, 0, Some(1), Vec::new());
    let mut sanitized = Vec::with_capacity(bytes.len());
    sanitized.extend_from_slice(&bytes[..12]);
    let mut at = 12;
    let mut chunks = 0;
    while at < bytes.len() {
        check(cancel)?;
        chunks += 1;
        if chunks > 4096 {
            return Err(ImageFailure::Oversized);
        }
        let length = usize::try_from(u32le(bytes, at + 4)?).map_err(|_| ImageFailure::Oversized)?;
        let end = at
            .checked_add(8)
            .and_then(|n| n.checked_add(length))
            .ok_or(ImageFailure::Oversized)?;
        let payload = bytes.get(at + 8..end).ok_or(ImageFailure::Truncated)?;
        match bytes.get(at..at + 4).ok_or(ImageFailure::Truncated)? {
            b"VP8X" => {
                if length != 10 {
                    return Err(ImageFailure::Malformed);
                }
                width = u24(payload, 4)? + 1;
                height = u24(payload, 7)? + 1;
            }
            b"ANIM" => {
                if length != 6 {
                    return Err(ImageFailure::Malformed);
                }
                loops = Some(u32::from(u16le(payload, 4)?));
            }
            b"ANMF" => {
                webp_frame_headers(payload, u24(payload, 6)? + 1, u24(payload, 9)? + 1)?;
                rect(
                    width,
                    height,
                    u24(payload, 0)? * 2,
                    u24(payload, 3)? * 2,
                    u24(payload, 6)? + 1,
                    u24(payload, 9)? + 1,
                )?;
                timing(&mut durations, u24(payload, 12)?)?;
            }
            b"ICCP" | b"EXIF" | b"XMP " if length > 1024 * 1024 => {
                return Err(ImageFailure::Metadata);
            }
            _ => {}
        }
        let padded = end.checked_add(length & 1).ok_or(ImageFailure::Oversized)?;
        let chunk = bytes.get(at..padded).ok_or(ImageFailure::Truncated)?;
        if !matches!(&bytes[at..at + 4], b"ICCP" | b"EXIF" | b"XMP ") {
            sanitized.extend_from_slice(chunk);
        }
        at = padded;
    }
    if durations.is_empty() {
        return Err(ImageFailure::Malformed);
    }
    let riff_size = u32::try_from(sanitized.len() - 8).map_err(|_| ImageFailure::Oversized)?;
    sanitized[4..8].copy_from_slice(&riff_size.to_le_bytes());
    if sanitized.get(12..16) == Some(b"VP8X") {
        sanitized[20] &= !(0x20 | 0x08 | 0x04);
    }
    Ok((
        Inventory {
            width,
            height,
            durations,
            loops,
        },
        sanitized,
    ))
}

#[derive(Clone)]
struct SharedEncoded(Arc<Vec<u8>>);

impl AsRef<[u8]> for SharedEncoded {
    fn as_ref(&self) -> &[u8] {
        self.0.as_slice()
    }
}

enum Decoder {
    Gif {
        reader: Box<gif::Decoder<Cursor<SharedEncoded>>>,
        canvas: Vec<u8>,
        previous: Option<Vec<u8>>,
        patch: Vec<u8>,
        disposal: gif::DisposalMethod,
        rect: (u32, u32, u32, u32),
    },
    Webp {
        reader: image_webp::WebPDecoder<Cursor<SharedEncoded>>,
        output: Vec<u8>,
        rgba: Vec<u8>,
    },
}

pub struct AnimationContext {
    encoded: SharedEncoded,
    inventory: Inventory,
    container: ImageContainer,
    decoder: Decoder,
    next: u32,
}

impl AnimationContext {
    pub fn frame_count(&self) -> u32 {
        u32::try_from(self.inventory.durations.len()).unwrap_or(1024)
    }
    /// Checks the entire bounded frame directory before constructing any surface or codec.
    ///
    /// # Errors
    /// Refuses malformed frame ranges, excessive timing/counts, or resource admission failure.
    pub fn new(
        bytes: &[u8],
        limits: &ImageLimits,
        cancel: &AtomicBool,
    ) -> Result<Self, ImageFailure> {
        if bytes.len() as u64 > MAX_IMAGE_SOURCE_BYTES {
            return Err(ImageFailure::Oversized);
        }
        let encoded_bytes = bytes.len() as u64;
        if encoded_bytes
            .checked_mul(3)
            .and_then(|n| n.checked_add(64 * 1024 * 1024))
            .is_none_or(|n| n > limits.peak_bytes)
        {
            return Err(ImageFailure::Allocation);
        }
        let mut admission = *limits;
        admission.peak_bytes = limits
            .peak_bytes
            .checked_sub(encoded_bytes)
            .ok_or(ImageFailure::Allocation)?;
        let container = if bytes.starts_with(b"GIF") {
            ImageContainer::Gif
        } else {
            ImageContainer::Webp
        };
        let (inventory, encoded) = if container == ImageContainer::Gif {
            gif_inventory(bytes, cancel)?
        } else {
            webp_inventory(bytes, cancel)?
        };
        admit_surface(
            inventory.width,
            inventory.height,
            if container == ImageContainer::Gif {
                8
            } else {
                16
            },
            bytes.len() as u64,
            &admission,
        )?;
        let encoded = SharedEncoded(Arc::new(encoded));
        let decoder = Self::decoder(encoded.clone(), &inventory, container)?;
        Ok(Self {
            encoded,
            inventory,
            container,
            decoder,
            next: 0,
        })
    }

    fn decoder(
        encoded: SharedEncoded,
        inventory: &Inventory,
        container: ImageContainer,
    ) -> Result<Decoder, ImageFailure> {
        let rgba_size =
            usize::try_from(u64::from(inventory.width) * u64::from(inventory.height) * 4)
                .map_err(|_| ImageFailure::Allocation)?;
        if container == ImageContainer::Gif {
            let mut options = gif::DecodeOptions::new();
            options.set_color_output(gif::ColorOutput::RGBA);
            options.set_memory_limit(gif::MemoryLimit::Bytes(
                NonZeroU64::new(rgba_size as u64).ok_or(ImageFailure::Malformed)?,
            ));
            options.check_frame_consistency(true);
            options.check_lzw_end_code(true);
            options.allow_unknown_blocks(false);
            let reader = options
                .read_info(Cursor::new(encoded))
                .map_err(|_| ImageFailure::Malformed)?;
            Ok(Decoder::Gif {
                reader: Box::new(reader),
                canvas: vec![0; rgba_size],
                previous: None,
                patch: Vec::new(),
                disposal: gif::DisposalMethod::Keep,
                rect: (0, 0, 0, 0),
            })
        } else {
            let mut reader = image_webp::WebPDecoder::new(Cursor::new(encoded))
                .map_err(|_| ImageFailure::Malformed)?;
            reader.set_memory_limit(1024 * 1024);
            reader
                .set_background_color([0, 0, 0, 0])
                .map_err(|_| ImageFailure::Malformed)?;
            if reader.dimensions() != (inventory.width, inventory.height)
                || reader.num_frames() as usize != inventory.durations.len()
            {
                return Err(ImageFailure::Malformed);
            }
            let size = reader
                .output_buffer_size()
                .ok_or(ImageFailure::Allocation)?;
            if size > rgba_size {
                return Err(ImageFailure::Allocation);
            }
            Ok(Decoder::Webp {
                reader,
                output: vec![0; size],
                rgba: vec![0; rgba_size],
            })
        }
    }

    fn advance(&mut self, cancel: &AtomicBool) -> Result<(), ImageFailure> {
        match &mut self.decoder {
            Decoder::Gif {
                reader,
                canvas,
                previous,
                patch,
                disposal,
                rect: old_rect,
            } => {
                if *disposal == gif::DisposalMethod::Background {
                    let (x, y, w, h) = *old_rect;
                    for row in y..y + h {
                        let at = ((row * self.inventory.width + x) * 4) as usize;
                        canvas[at..at + (w * 4) as usize].fill(0);
                    }
                } else if *disposal == gif::DisposalMethod::Previous
                    && let Some(saved) = previous.take()
                {
                    *canvas = saved;
                }
                let frame = reader
                    .next_frame_info()
                    .map_err(|_| ImageFailure::Malformed)?
                    .ok_or(ImageFailure::Truncated)?;
                let (x, y, w, h) = (
                    u32::from(frame.left),
                    u32::from(frame.top),
                    u32::from(frame.width),
                    u32::from(frame.height),
                );
                rect(self.inventory.width, self.inventory.height, x, y, w, h)?;
                *disposal = frame.dispose;
                *old_rect = (x, y, w, h);
                if *disposal == gif::DisposalMethod::Previous {
                    *previous = Some(canvas.clone());
                } else {
                    *previous = None;
                }
                let size = reader.buffer_size();
                if size as u64 != u64::from(w) * u64::from(h) * 4 || size > canvas.len() {
                    return Err(ImageFailure::Malformed);
                }
                patch.resize(size, 0);
                reader
                    .read_into_buffer(patch)
                    .map_err(|_| ImageFailure::Malformed)?;
                for row in 0..h {
                    check(cancel)?;
                    for col in 0..w {
                        let from = ((row * w + col) * 4) as usize;
                        if patch[from + 3] != 0 {
                            let to = (((row + y) * self.inventory.width + col + x) * 4) as usize;
                            canvas[to..to + 4].copy_from_slice(&patch[from..from + 4]);
                        }
                    }
                }
            }
            Decoder::Webp {
                reader,
                output,
                rgba,
            } => {
                reader
                    .read_frame(output)
                    .map_err(|_| ImageFailure::Malformed)?;
                if reader.has_alpha() {
                    rgba.copy_from_slice(output);
                } else {
                    for (from, to) in output.chunks_exact(3).zip(rgba.chunks_exact_mut(4)) {
                        to[..3].copy_from_slice(from);
                        to[3] = 255;
                    }
                }
            }
        }
        Ok(())
    }

    /// Advances incrementally; backward selection reconstructs and replays without cached frames.
    ///
    /// # Errors
    /// Stops on cancellation, five-second work deadline, codec failure, or out-of-range selection.
    pub fn frame(
        &mut self,
        selection: u32,
        cancel: &AtomicBool,
    ) -> Result<FamilyPreview, ImageFailure> {
        if selection as usize >= self.inventory.durations.len() {
            return Err(ImageFailure::Malformed);
        }
        let deadline = Instant::now() + Duration::from_secs(5);
        if selection < self.next {
            self.decoder = Self::decoder(self.encoded.clone(), &self.inventory, self.container)?;
            self.next = 0;
        }
        while self.next <= selection {
            check(cancel)?;
            if Instant::now() > deadline {
                return Err(ImageFailure::Deadline);
            }
            self.advance(cancel)?;
            self.next += 1;
        }
        check(cancel)?;
        if Instant::now() > deadline {
            return Err(ImageFailure::Deadline);
        }
        let rgba = match &self.decoder {
            Decoder::Gif { canvas, .. } => canvas,
            Decoder::Webp { rgba, .. } => rgba,
        };
        let mut preview = rgba_preview(
            rgba,
            self.inventory.width,
            self.inventory.height,
            self.container,
            ImageFamily::Animation,
            cancel,
        )?;
        preview
            .descriptor
            .limitations
            .push("transparent_animation_background".into());
        Ok(FamilyPreview {
            preview,
            state: ImageFamilyState::Animation {
                paused: true,
                selected_frame: selection,
                frame_count: u32::try_from(self.inventory.durations.len()).ok(),
                loop_count: self.inventory.loops,
                frame_duration_ms: self.inventory.durations.get(selection as usize).copied(),
                max_composited_frames: 2,
            },
        })
    }
}
