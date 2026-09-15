//! Independent, bounded image metadata extraction and privacy-safe wire facts.

use crate::metadata::{MetadataAvailability, MetadataValue};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub const MAX_IMAGE_METADATA_BLOCK: usize = 1024 * 1024;
pub const MAX_IMAGE_METADATA_TOTAL: usize = 4 * 1024 * 1024;
pub const MAX_IMAGE_METADATA_FACTS: usize = 256;

#[derive(Clone, Debug, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ImageMetadataObservation {
    pub key: String,
    pub family: String,
    pub tag: String,
    pub block: u32,
    pub availability: MetadataAvailability,
    pub value: Option<MetadataValue>,
    pub original: Option<ImageOriginalValue>,
    pub duplicate: bool,
}

#[derive(Clone, Debug, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum ImageOriginalValue {
    Text(String),
    Unsigned(Vec<u64>),
    Rational(Vec<(u32, u32)>),
}

#[derive(Clone, Debug, Default, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ImageMetadataReport {
    pub observations: Vec<ImageMetadataObservation>,
    pub statuses: Vec<String>,
    pub unknown_fields: u32,
    pub profile_present: bool,
    #[serde(skip)]
    pub thumbnail: Option<Vec<u8>>,
    #[serde(skip)]
    pub thumbnail_orientation: Option<u8>,
}

impl ImageMetadataReport {
    fn status(&mut self, status: &str) {
        if self.statuses.len() < MAX_IMAGE_METADATA_FACTS
            && !self.statuses.iter().any(|s| s == status)
        {
            self.statuses.push(status.into());
        }
    }

    fn unknown(&mut self) {
        self.unknown_fields = self.unknown_fields.saturating_add(1).min(4096);
    }

    fn observe(
        &mut self,
        key: &str,
        family: &str,
        tag: &str,
        block: u32,
        value: Option<(MetadataValue, ImageOriginalValue)>,
    ) {
        if self.observations.len() == MAX_IMAGE_METADATA_FACTS {
            self.status("metadata_fact_limit");
            return;
        }
        let duplicate = self.observations.iter().any(|o| o.key == key);
        let value = value.filter(|(value, _)| match key {
            "image.exposure" | "image.f_number" | "image.focal_length" => {
                matches!(value, MetadataValue::Decimal(_))
            }
            "image.iso"
            | "image.orientation"
            | "image.embedded_width"
            | "image.embedded_height" => matches!(value, MetadataValue::Integer(_)),
            _ => matches!(value, MetadataValue::Text(_)),
        });
        if let Some(previous) = self.observations.iter().find(|o| o.key == key) {
            let equal = previous.value.as_ref() == value.as_ref().map(|(v, _)| v)
                && previous.original.as_ref() == value.as_ref().map(|(_, v)| v);
            self.status(if equal {
                "metadata_duplicate"
            } else {
                "metadata_conflict"
            });
        }
        let (availability, value, original) = if key == "image.location" {
            (MetadataAvailability::Redacted, None, None)
        } else if let Some((value, original)) = value {
            (MetadataAvailability::Available, Some(value), Some(original))
        } else {
            (MetadataAvailability::Unsupported, None, None)
        };
        self.observations.push(ImageMetadataObservation {
            key: key.into(),
            family: family.into(),
            tag: tag.into(),
            block,
            availability,
            value,
            original,
            duplicate,
        });
    }
}

fn text_value(bytes: &[u8]) -> Option<(MetadataValue, ImageOriginalValue)> {
    let text = std::str::from_utf8(bytes).ok()?.trim_matches(char::from(0));
    if text.chars().count() > 1024
        || text
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    {
        return None;
    }
    Some((
        MetadataValue::Text(text.into()),
        ImageOriginalValue::Text(text.into()),
    ))
}

/// Extracts only the declared image metadata subset without external authority.
#[allow(clippy::too_many_lines)] // Container walks share one aggregate metadata budget.
pub fn extract_image_metadata(bytes: &[u8]) -> ImageMetadataReport {
    let mut report = ImageMetadataReport::default();
    let mut total = 0;
    let mut block = 0;
    if bytes.starts_with(&[0xff, 0xd8]) {
        let mut offset = 2;
        for _ in 0..4096 {
            if bytes.get(offset) != Some(&0xff) {
                break;
            }
            while bytes.get(offset) == Some(&0xff) {
                offset += 1;
            }
            let Some(&marker) = bytes.get(offset) else {
                report.status("metadata_truncated");
                break;
            };
            offset += 1;
            if matches!(marker, 0xda | 0xd9) {
                break;
            }
            if matches!(marker, 0x01 | 0xd0..=0xd8) {
                continue;
            }
            let Some(size) = bytes
                .get(offset..offset + 2)
                .map(|b| usize::from(u16::from_be_bytes([b[0], b[1]])))
            else {
                report.status("metadata_truncated");
                break;
            };
            if size < 2 {
                report.status("metadata_malformed");
                break;
            }
            let Some(payload) = bytes.get(offset + 2..offset + size) else {
                report.status("metadata_truncated");
                break;
            };
            offset += size;
            if marker == 0xe1 {
                if let Some(exif) = payload.strip_prefix(b"Exif\0\0") {
                    metadata_block(&mut report, exif, "exif", &mut total, &mut block);
                } else if let Some(xmp) = payload.strip_prefix(b"http://ns.adobe.com/xap/1.0/\0") {
                    metadata_block(&mut report, xmp, "xmp", &mut total, &mut block);
                } else if payload.starts_with(b"http://ns.adobe.com/xmp/extension/\0") {
                    report.status("extended_xmp_unsupported");
                }
            } else if marker == 0xed {
                photoshop(&mut report, payload, &mut total, &mut block);
            } else if marker == 0xe2 && payload.starts_with(b"ICC_PROFILE\0") {
                report.profile_present = true;
                let parts = &payload[12..];
                if parts.starts_with(&[1, 1]) {
                    profile_metadata(&mut report, &parts[2..]);
                } else if parts.len() < 2 || parts[0] == 0 || parts[1] == 0 || parts[0] > parts[1] {
                    report.status("icc_profile_invalid");
                } else {
                    report.status("multipart_icc_profile_unsupported");
                }
            }
        }
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        let mut offset = 8;
        for _ in 0..4096 {
            let Some(header) = bytes.get(offset..offset + 8) else {
                break;
            };
            let size = usize::try_from(u32::from_be_bytes([
                header[0], header[1], header[2], header[3],
            ]))
            .unwrap_or(usize::MAX);
            let Some(end) = offset.checked_add(12).and_then(|n| n.checked_add(size)) else {
                report.status("metadata_malformed");
                break;
            };
            let Some(chunk) = bytes.get(offset + 8..end.saturating_sub(4)) else {
                report.status("metadata_truncated");
                break;
            };
            match &header[4..] {
                b"eXIf" => metadata_block(&mut report, chunk, "exif", &mut total, &mut block),
                b"iCCP" => {
                    report.profile_present = true;
                    report.status("compressed_icc_profile_unsupported");
                }
                b"iTXt" => {
                    if let Some(rest) = chunk.strip_prefix(b"XML:com.adobe.xmp\0") {
                        if rest.starts_with(&[0, 0]) {
                            let text = rest[2..].splitn(3, |b| *b == 0).nth(2);
                            if let Some(text) = text {
                                metadata_block(&mut report, text, "xmp", &mut total, &mut block);
                            } else {
                                report.status("metadata_malformed");
                            }
                        } else {
                            report.status("compressed_metadata_unsupported");
                        }
                    }
                }
                b"zTXt" => report.status("compressed_metadata_unsupported"),
                b"IEND" => break,
                _ => {}
            }
            offset = end;
        }
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        let mut offset = 12;
        for _ in 0..4096 {
            let Some(header) = bytes.get(offset..offset + 8) else {
                break;
            };
            let size = usize::try_from(u32::from_le_bytes([
                header[4], header[5], header[6], header[7],
            ]))
            .unwrap_or(usize::MAX);
            let Some(end) = offset.checked_add(8).and_then(|n| n.checked_add(size)) else {
                report.status("metadata_malformed");
                break;
            };
            let Some(chunk) = bytes.get(offset + 8..end) else {
                report.status("metadata_truncated");
                break;
            };
            match &header[..4] {
                b"EXIF" => metadata_block(
                    &mut report,
                    chunk.strip_prefix(b"Exif\0\0").unwrap_or(chunk),
                    "exif",
                    &mut total,
                    &mut block,
                ),
                b"XMP " => metadata_block(&mut report, chunk, "xmp", &mut total, &mut block),
                b"ICCP" => {
                    profile_metadata(&mut report, chunk);
                }
                _ => {}
            }
            offset = end + (size & 1);
        }
    } else if bytes.starts_with(b"II*\0") || bytes.starts_with(b"MM\0*") {
        // TIFF offsets refer to the original source. Walk bounded IFD entries rather than
        // feeding the full (potentially 128 MiB) pixel container to the Exif library.
        tiff_metadata(&mut report, bytes, &mut total, &mut block, false);
    }
    if report.observations.is_empty() && report.statuses.is_empty() {
        report.status("embedded_metadata_not_provided");
    }
    report
}

fn profile_metadata(report: &mut ImageMetadataReport, bytes: &[u8]) {
    report.profile_present = true;
    if bytes.len() > MAX_IMAGE_METADATA_BLOCK {
        report.status("icc_profile_block_limit");
        return;
    }
    if bytes.len() < 128 || bytes.get(36..40) != Some(b"acsp") {
        report.status("icc_profile_invalid");
        return;
    }
    let size = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    if usize::try_from(size) != Ok(bytes.len()) {
        report.status("icc_profile_invalid");
        return;
    }
    if !matches!(bytes[8], 2 | 4) || !matches!(&bytes[16..20], b"RGB " | b"GRAY") {
        report.status("icc_profile_unsupported");
        return;
    }
    report.status("icc_profile_not_applied");
}

fn metadata_block(
    report: &mut ImageMetadataReport,
    bytes: &[u8],
    family: &str,
    total: &mut usize,
    block: &mut u32,
) {
    if bytes.len() > MAX_IMAGE_METADATA_BLOCK
        || total.saturating_add(bytes.len()) > MAX_IMAGE_METADATA_TOTAL
    {
        report.status("metadata_block_limit");
        return;
    }
    *total += bytes.len();
    *block += 1;
    if *block > 4096 {
        report.status("metadata_block_limit");
        return;
    }
    match family {
        "exif" => exif_metadata(report, bytes, *block),
        "xmp" => xmp_metadata(report, bytes, *block),
        "iptc" => iptc_metadata(report, bytes, *block),
        _ => {}
    }
}

fn exif_key(tag: u16) -> Option<(&'static str, &'static str)> {
    Some(match tag {
        0x010f => ("image.camera_make", "Make"),
        0x0110 => ("image.camera_model", "Model"),
        0x0131 => ("image.software", "Software"),
        0x9003 | 0x9004 | 0x0132 => ("image.captured", "CaptureTime"),
        0x013b => ("image.artist", "Artist"),
        0x010e => ("image.description", "ImageDescription"),
        0x829a => ("image.exposure", "ExposureTime"),
        0x829d => ("image.f_number", "FNumber"),
        0x920a => ("image.focal_length", "FocalLength"),
        0x8827 => ("image.iso", "Sensitivity"),
        0x0112 => ("image.orientation", "Orientation"),
        0xa002 => ("image.embedded_width", "PixelXDimension"),
        0xa003 => ("image.embedded_height", "PixelYDimension"),
        _ => return None,
    })
}

fn exif_metadata(report: &mut ImageMetadataReport, bytes: &[u8], block: u32) {
    let mut total = 0;
    let mut ifd_block = block;
    tiff_metadata(report, bytes, &mut total, &mut ifd_block, true);
    let parsed = exif::Reader::new()
        .continue_on_error(true)
        .read_raw(bytes.to_vec())
        .or_else(|error| error.distill_partial_result(|_| report.status("exif_partial")));
    let Ok(parsed) = parsed else {
        report.status("exif_malformed");
        return;
    };
    report.thumbnail_orientation = parsed
        .get_field(exif::Tag::Orientation, exif::In::THUMBNAIL)
        .and_then(|f| f.value.get_uint(0))
        .and_then(|n| u8::try_from(n).ok())
        .filter(|n| (1..=8).contains(n));
    let start = parsed
        .get_field(exif::Tag::JPEGInterchangeFormat, exif::In::THUMBNAIL)
        .and_then(|f| f.value.get_uint(0))
        .and_then(|n| usize::try_from(n).ok());
    let length = parsed
        .get_field(exif::Tag::JPEGInterchangeFormatLength, exif::In::THUMBNAIL)
        .and_then(|f| f.value.get_uint(0))
        .and_then(|n| usize::try_from(n).ok());
    if let (Some(start), Some(length)) = (start, length) {
        if length <= MAX_IMAGE_METADATA_BLOCK {
            report.thumbnail = start
                .checked_add(length)
                .and_then(|end| bytes.get(start..end))
                .map(<[u8]>::to_vec);
        } else {
            report.status("thumbnail_block_limit");
        }
    }
}

fn xmp_key(namespace: &str, local: &str) -> Option<(&'static str, &'static str)> {
    match (namespace, local) {
        ("http://ns.adobe.com/tiff/1.0/", "Make") => Some(("image.camera_make", "Make")),
        ("http://ns.adobe.com/tiff/1.0/", "Model") => Some(("image.camera_model", "Model")),
        ("http://ns.adobe.com/xap/1.0/", "CreatorTool") => Some(("image.software", "CreatorTool")),
        ("http://ns.adobe.com/exif/1.0/", "DateTimeOriginal") => {
            Some(("image.captured", "DateTimeOriginal"))
        }
        ("http://purl.org/dc/elements/1.1/", "creator") => Some(("image.artist", "Creator")),
        ("http://purl.org/dc/elements/1.1/", "title") => Some(("image.title", "Title")),
        ("http://purl.org/dc/elements/1.1/", "description") => {
            Some(("image.description", "Description"))
        }
        ("http://purl.org/dc/elements/1.1/", "subject") => Some(("image.keywords", "Keywords")),
        ("http://ns.adobe.com/exif/1.0/", name) if name.starts_with("GPS") => {
            Some(("image.location", "GPS"))
        }
        ("http://ns.adobe.com/photoshop/1.0/", "City" | "State" | "Country" | "Location") => {
            Some(("image.location", "Location"))
        }
        (
            "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
            | "http://iptc.org/std/Iptc4xmpExt/2008-02-29/",
            _,
        ) => Some(("image.location", "ProtectedIPTC")),
        _ => None,
    }
}

#[allow(clippy::too_many_lines)] // Namespace resolution, staged facts, and entity rejection form one transaction.
fn xmp_metadata(report: &mut ImageMetadataReport, bytes: &[u8], block: u32) {
    use quick_xml::{events::Event, name::ResolveResult, reader::NsReader};
    let Ok(xml) = std::str::from_utf8(bytes) else {
        report.status("xmp_encoding_unsupported");
        return;
    };
    let mut reader = NsReader::from_str(xml);
    let mut stack: Vec<XmpNode> = Vec::new();
    let mut staged = ImageMetadataReport::default();
    for _ in 0..8192 {
        let Ok(event) = reader.read_event() else {
            report.status("xmp_malformed");
            return;
        };
        match event {
            Event::Start(ref element) | Event::Empty(ref element) => {
                if stack.len() >= 32 {
                    report.status("xmp_depth_limit");
                    return;
                }
                let (namespace, local) = reader.resolver().resolve_element(element.name());
                let rdf_container = matches!(&namespace, ResolveResult::Bound(ns) if ns.as_ref() == "http://www.w3.org/1999/02/22-rdf-syntax-ns#")
                    && matches!(local.as_ref(), "Bag" | "Seq" | "Alt" | "li");
                let key = match namespace {
                    ResolveResult::Bound(ns) => xmp_key(ns.as_ref(), local.as_ref()),
                    _ => None,
                };
                let structural = matches!(&namespace, ResolveResult::Bound(ns) if ns.as_ref() == "http://www.w3.org/1999/02/22-rdf-syntax-ns#")
                    && matches!(
                        local.as_ref(),
                        "RDF" | "Description" | "Bag" | "Seq" | "Alt" | "li"
                    )
                    || matches!(&namespace, ResolveResult::Bound(ns) if ns.as_ref() == "adobe:ns:meta/")
                        && local.as_ref() == "xmpmeta";
                if key.is_none() && !structural {
                    staged.unknown();
                }
                for (index, attribute) in element.attributes().take(257).enumerate() {
                    if index == 256 {
                        report.status("xmp_attribute_limit");
                        return;
                    }
                    let Ok(attribute) = attribute else {
                        report.status("xmp_malformed");
                        return;
                    };
                    let (namespace, local) = reader.resolver().resolve_attribute(attribute.key);
                    if let ResolveResult::Bound(ns) = namespace
                        && let Some((key, tag)) = xmp_key(ns.as_ref(), local.as_ref())
                    {
                        let value = if key == "image.location" {
                            None
                        } else {
                            attribute
                                .normalized_value(quick_xml::XmlVersion::Implicit1_0)
                                .ok()
                                .and_then(|v| text_value(v.as_bytes()))
                        };
                        staged.observe(key, "xmp", tag, block, value);
                    } else if attribute.key.as_ref() != "xmlns"
                        && !attribute.key.as_ref().starts_with("xmlns:")
                    {
                        staged.unknown();
                    }
                }
                if matches!(event, Event::Start(_)) {
                    stack.push(XmpNode {
                        key: key.or_else(|| {
                            if rdf_container {
                                stack.last().and_then(|n| n.key)
                            } else {
                                None
                            }
                        }),
                        text: String::new(),
                    });
                } else if let Some(("image.location", tag)) = key {
                    staged.observe("image.location", "xmp", tag, block, None);
                }
            }
            Event::Text(text) => {
                if !append_xmp_text(&mut stack, &text.xml10_content()) {
                    report.status("xmp_value_limit");
                    return;
                }
            }
            Event::CData(text) => {
                if !append_xmp_text(&mut stack, text.as_ref()) {
                    report.status("xmp_value_limit");
                    return;
                }
            }
            Event::End(_) => {
                if let Some(node) = stack.pop()
                    && let Some((key, tag)) = node.key
                {
                    if key == "image.location" {
                        staged.observe(key, "xmp", tag, block, None);
                    } else if !node.text.trim().is_empty() {
                        staged.observe(
                            key,
                            "xmp",
                            tag,
                            block,
                            text_value(node.text.trim().as_bytes()),
                        );
                    }
                }
            }
            Event::GeneralRef(reference) => {
                let text = match reference.as_ref() {
                    "amp" => "&",
                    "lt" => "<",
                    "gt" => ">",
                    "apos" => "'",
                    "quot" => "\"",
                    _ => {
                        report.status("xmp_entities_unsupported");
                        return;
                    }
                };
                if !append_xmp_text(&mut stack, text) {
                    report.status("xmp_value_limit");
                    return;
                }
            }
            Event::DocType(_) => {
                report.status("xmp_entities_unsupported");
                return;
            }
            Event::Eof => {
                if !stack.is_empty() {
                    report.status("xmp_malformed");
                    return;
                }
                for observation in staged.observations {
                    let value = observation.value.zip(observation.original);
                    report.observe(&observation.key, "xmp", &observation.tag, block, value);
                }
                report.unknown_fields = report
                    .unknown_fields
                    .saturating_add(staged.unknown_fields)
                    .min(4096);
                for status in staged.statuses {
                    report.status(&status);
                }
                return;
            }
            _ => {}
        }
    }
    report.status("xmp_event_limit");
}

struct XmpNode {
    key: Option<(&'static str, &'static str)>,
    text: String,
}

fn append_xmp_text(stack: &mut [XmpNode], text: &str) -> bool {
    let Some(node) = stack.last_mut() else {
        return true;
    };
    if node.key.is_none() || matches!(node.key, Some(("image.location", _))) {
        return true;
    }
    if node.text.len().saturating_add(text.len()) > 4096
        || node
            .text
            .chars()
            .count()
            .saturating_add(text.chars().count())
            > 1024
    {
        return false;
    }
    node.text.push_str(text);
    true
}

fn photoshop(report: &mut ImageMetadataReport, bytes: &[u8], total: &mut usize, block: &mut u32) {
    let Some(bytes) = bytes.strip_prefix(b"Photoshop 3.0\0") else {
        return;
    };
    let mut offset = 0;
    for _ in 0..4096 {
        if bytes.get(offset..offset + 4) != Some(b"8BIM") {
            break;
        }
        let Some(header) = bytes.get(offset + 4..offset + 7) else {
            report.status("iptc_truncated");
            break;
        };
        let id = u16::from_be_bytes([header[0], header[1]]);
        let name = usize::from(header[2]) + 1;
        let length_offset = offset + 6 + name + (name & 1);
        let Some(size) = bytes.get(length_offset..length_offset + 4).map(|b| {
            usize::try_from(u32::from_be_bytes(b.try_into().unwrap())).unwrap_or(usize::MAX)
        }) else {
            report.status("iptc_truncated");
            break;
        };
        let Some(end) = length_offset
            .checked_add(4)
            .and_then(|n| n.checked_add(size))
        else {
            report.status("iptc_malformed");
            break;
        };
        let Some(payload) = bytes.get(length_offset + 4..end) else {
            report.status("iptc_truncated");
            break;
        };
        if id == 0x0404 {
            metadata_block(report, payload, "iptc", total, block);
        }
        offset = end + (size & 1);
    }
}

fn iptc_metadata(report: &mut ImageMetadataReport, bytes: &[u8], block: u32) {
    let mut offset = 0;
    let mut utf8 = false;
    for _ in 0..4096 {
        let Some(header) = bytes.get(offset..offset + 5) else {
            if offset != bytes.len() {
                report.status("iptc_truncated");
            }
            break;
        };
        if header[0] != 0x1c {
            report.status("iptc_malformed");
            break;
        }
        let record = header[1];
        let dataset = header[2];
        let short = u16::from_be_bytes([header[3], header[4]]);
        offset += 5;
        let size = if short & 0x8000 != 0 {
            let count = usize::from(short & 0x7fff);
            if !(1..=4).contains(&count) {
                report.status("iptc_malformed");
                break;
            }
            let Some(length) = bytes.get(offset..offset + count) else {
                report.status("iptc_truncated");
                break;
            };
            offset += count;
            length
                .iter()
                .fold(0usize, |n, b| (n << 8) | usize::from(*b))
        } else {
            usize::from(short)
        };
        let Some(end) = offset.checked_add(size) else {
            report.status("iptc_malformed");
            break;
        };
        let Some(value) = bytes.get(offset..end) else {
            report.status("iptc_truncated");
            break;
        };
        offset = end;
        if record == 1 && dataset == 90 {
            utf8 = value == b"\x1b%G";
            continue;
        }
        let key = match (record, dataset) {
            (2, 5) => Some(("image.title", "ObjectName")),
            (2, 25) => Some(("image.keywords", "Keywords")),
            (2, 80) => Some(("image.artist", "Byline")),
            (2, 120) => Some(("image.description", "Caption")),
            (2, 90 | 92 | 95 | 100 | 101 | 103) => Some(("image.location", "Location")),
            _ => None,
        };
        if let Some((key, tag)) = key {
            let normalized = if key == "image.location" {
                None
            } else if utf8 || value.is_ascii() {
                text_value(value)
            } else {
                report.status("iptc_encoding_unsupported");
                None
            };
            report.observe(key, "iptc", tag, block, normalized);
        } else {
            report.unknown();
        }
    }
}

#[allow(clippy::too_many_lines)] // Checked IFD offsets and source-slice lifetimes remain together.
fn tiff_metadata(
    report: &mut ImageMetadataReport,
    bytes: &[u8],
    total: &mut usize,
    block: &mut u32,
    primary_only: bool,
) {
    let little = bytes.starts_with(b"II");
    let read16 = |offset: usize| {
        bytes.get(offset..offset.checked_add(2)?).map(|b| {
            if little {
                u16::from_le_bytes(b.try_into().unwrap())
            } else {
                u16::from_be_bytes(b.try_into().unwrap())
            }
        })
    };
    let read32 = |offset: usize| {
        bytes.get(offset..offset.checked_add(4)?).and_then(|b| {
            usize::try_from(if little {
                u32::from_le_bytes(b.try_into().unwrap())
            } else {
                u32::from_be_bytes(b.try_into().unwrap())
            })
            .ok()
        })
    };
    let Some(first) = read32(4) else {
        report.status("tiff_metadata_truncated");
        return;
    };
    // Classify the graph before publishing any value: aliases must not make GPS
    // sensitivity depend on whether an ordinary pointer was traversed first.
    let mut sensitivity = std::collections::BTreeMap::new();
    let mut classify = vec![(first, false, true)];
    let mut classified_entries = 0usize;
    while let Some((offset, mut gps, mut primary)) = classify.pop() {
        if offset == 0 {
            continue;
        }
        if let Some((previous_gps, previous_primary)) = sensitivity.get(&offset) {
            if (*previous_gps || !gps) && (*previous_primary || !primary) {
                continue;
            }
            gps |= previous_gps;
            primary |= previous_primary;
        }
        sensitivity.insert(offset, (gps, primary));
        if sensitivity.len() > 32 {
            report.status("tiff_ifd_limit");
            return;
        }
        let Some(count) = read16(offset).map(usize::from) else {
            report.status("tiff_metadata_truncated");
            return;
        };
        for index in 0..count {
            classified_entries += 1;
            if classified_entries > 4096 {
                report.status("tiff_entry_limit");
                return;
            }
            let Some(entry) = offset
                .checked_add(2)
                .and_then(|n| index.checked_mul(12).and_then(|i| n.checked_add(i)))
            else {
                report.status("tiff_metadata_malformed");
                return;
            };
            let (Some(tag), Some(pointer)) = (read16(entry), read32(entry + 8)) else {
                report.status("tiff_metadata_truncated");
                return;
            };
            if matches!(tag, 0x8769 | 0x8825) {
                classify.push((pointer, gps || tag == 0x8825, primary));
            }
        }
        let Some(next) = count
            .checked_mul(12)
            .and_then(|n| offset.checked_add(2)?.checked_add(n))
            .and_then(read32)
        else {
            report.status("tiff_metadata_truncated");
            return;
        };
        classify.push((next, gps, false));
    }
    // Separate IFDs can alias GPS payload bytes, so classify sensitive extents
    // before reading or normalizing any ordinary metadata value.
    let mut protected = Vec::new();
    for (&offset, &(gps, _)) in &sensitivity {
        if !gps {
            continue;
        }
        let Some(count) = read16(offset).map(usize::from) else {
            report.status("tiff_metadata_truncated");
            return;
        };
        let Some(end) = count
            .checked_mul(12)
            .and_then(|length| offset.checked_add(6)?.checked_add(length))
            .filter(|end| *end <= bytes.len())
        else {
            report.status("tiff_metadata_truncated");
            return;
        };
        protected.push((offset, end));
        for index in 0..count {
            let Some(entry) = offset
                .checked_add(2)
                .and_then(|start| index.checked_mul(12)?.checked_add(start))
            else {
                report.status("tiff_metadata_malformed");
                return;
            };
            let (Some(kind), Some(count), Some(pointer)) = (
                entry.checked_add(2).and_then(read16),
                entry.checked_add(4).and_then(read32),
                entry.checked_add(8).and_then(read32),
            ) else {
                report.status("tiff_metadata_truncated");
                return;
            };
            let unit = match kind {
                1 | 2 | 6 | 7 => 1,
                3 | 8 => 2,
                4 | 9 | 11 | 13 => 4,
                5 | 10 | 12 => 8,
                _ => {
                    report.status("tiff_metadata_malformed");
                    return;
                }
            };
            let Some(length) = count.checked_mul(unit) else {
                report.status("metadata_block_limit");
                return;
            };
            if length > MAX_IMAGE_METADATA_BLOCK
                || total.saturating_add(length) > MAX_IMAGE_METADATA_TOTAL
            {
                report.status("metadata_block_limit");
                return;
            }
            let Some(start) = (if length <= 4 {
                entry.checked_add(8)
            } else {
                Some(pointer)
            }) else {
                report.status("tiff_metadata_malformed");
                return;
            };
            let Some(end) = start.checked_add(length).filter(|end| *end <= bytes.len()) else {
                report.status("tiff_metadata_truncated");
                return;
            };
            *total += length;
            protected.push((start, end));
        }
    }
    let mut pending = vec![first];
    let mut visited = std::collections::BTreeSet::new();
    let mut entries = 0usize;
    while let Some(offset) = pending.pop() {
        let (gps, primary) = sensitivity.get(&offset).copied().unwrap_or((false, false));
        if offset == 0 {
            continue;
        }
        if !visited.insert(offset) {
            continue;
        }
        if visited.len() > 32 {
            report.status("tiff_ifd_limit");
            break;
        }
        let Some(count) = read16(offset).map(usize::from) else {
            report.status("tiff_metadata_truncated");
            continue;
        };
        for index in 0..count {
            entries += 1;
            if entries > 4096 {
                report.status("tiff_entry_limit");
                return;
            }
            let Some(entry) = offset
                .checked_add(2)
                .and_then(|n| index.checked_mul(12).and_then(|i| n.checked_add(i)))
            else {
                report.status("tiff_metadata_malformed");
                return;
            };
            let (Some(tag), Some(kind), Some(count), Some(pointer)) = (
                read16(entry),
                read16(entry + 2),
                read32(entry + 4),
                read32(entry + 8),
            ) else {
                report.status("tiff_metadata_truncated");
                break;
            };
            if matches!(tag, 0x8769 | 0x8825) {
                pending.push(pointer);
                continue;
            }
            if gps {
                report.observe("image.location", "exif", "GPS", *block, None);
                continue;
            }
            if (primary_only && !primary) || (tag == 0x0112 && offset != first) {
                report.unknown();
                continue;
            }
            if !matches!(tag, 700 | 33723 | 34675) && exif_key(tag).is_none() {
                report.unknown();
                continue;
            }
            let unit = match kind {
                1 | 2 | 7 => 1,
                3 => 2,
                4 => 4,
                5 => 8,
                _ => {
                    report.unknown();
                    continue;
                }
            };
            let Some(length) = count.checked_mul(unit) else {
                report.status("metadata_block_limit");
                continue;
            };
            if length > MAX_IMAGE_METADATA_BLOCK
                || total.saturating_add(length) > MAX_IMAGE_METADATA_TOTAL
            {
                report.status("metadata_block_limit");
                continue;
            }
            let start = if length <= 4 { entry + 8 } else { pointer };
            let Some(end) = start.checked_add(length).filter(|end| *end <= bytes.len()) else {
                report.status("tiff_metadata_truncated");
                continue;
            };
            *total += length;
            if protected
                .iter()
                .any(|&(begin, protected_end)| start < protected_end && begin < end)
            {
                report.observe("image.location", "exif", "GPSPayloadAlias", *block, None);
                continue;
            }
            let data = &bytes[start..end];
            if tag == 700 {
                xmp_metadata(report, data, *block);
                continue;
            }
            if tag == 33723 {
                iptc_metadata(report, data, *block);
                continue;
            }
            if tag == 34675 {
                profile_metadata(report, data);
                continue;
            }
            let Some((key, name)) = exif_key(tag) else {
                report.unknown();
                continue;
            };
            let value = match kind {
                2 => text_value(data),
                3..=5 => tiff_numeric_value(data, kind, little),
                _ => None,
            };
            report.observe(key, "exif", name, *block, value);
        }
        if let Some(next) = count
            .checked_mul(12)
            .and_then(|n| offset.checked_add(2)?.checked_add(n))
            .and_then(read32)
        {
            pending.push(next);
        }
        *block += 1;
    }
}

fn tiff_numeric_value(
    data: &[u8],
    kind: u16,
    little: bool,
) -> Option<(MetadataValue, ImageOriginalValue)> {
    let unit = match kind {
        3 => 2,
        4 => 4,
        5 => 8,
        _ => return None,
    };
    if data.is_empty() || !data.len().is_multiple_of(unit) || data.len() / unit > 64 {
        return None;
    }
    let read32 = |b: &[u8]| {
        if little {
            u32::from_le_bytes([b[0], b[1], b[2], b[3]])
        } else {
            u32::from_be_bytes([b[0], b[1], b[2], b[3]])
        }
    };
    if kind == 5 {
        let values = data
            .chunks_exact(8)
            .map(|b| (read32(b), read32(&b[4..])))
            .collect::<Vec<_>>();
        if values.iter().any(|(_, d)| *d == 0) {
            return None;
        }
        let (n, d) = values[0];
        Some((
            MetadataValue::Decimal(format!("{:.8}", f64::from(n) / f64::from(d))),
            ImageOriginalValue::Rational(values),
        ))
    } else {
        let values = data
            .chunks_exact(unit)
            .map(|b| {
                if kind == 3 {
                    u64::from(if little {
                        u16::from_le_bytes([b[0], b[1]])
                    } else {
                        u16::from_be_bytes([b[0], b[1]])
                    })
                } else {
                    u64::from(read32(b))
                }
            })
            .collect::<Vec<_>>();
        Some((
            MetadataValue::Integer(values[0].to_string()),
            ImageOriginalValue::Unsigned(values),
        ))
    }
}
