//! Bounded, deterministic format detection and text profiling.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::contracts::SourceDescriptor;

/// Default maximum probe size.
pub const DEFAULT_MAX_PROBE_BYTES: usize = 65_536;
/// Default maximum number of evidence records.
pub const DEFAULT_MAX_EVIDENCE: usize = 32;

const MERMAID_DIRECTIVES: [&str; 21] = [
    "flowchart",
    "graph",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "erDiagram",
    "journey",
    "gantt",
    "pie",
    "quadrantChart",
    "requirementDiagram",
    "gitGraph",
    "mindmap",
    "timeline",
    "zenuml",
    "sankey-beta",
    "xychart-beta",
    "block-beta",
    "packet-beta",
    "architecture-beta",
];

/// Fixed structural limits for one detection request.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct DetectionLimits {
    pub max_probe_bytes: usize,
    pub max_name_bytes: usize,
    pub max_media_type_bytes: usize,
    pub max_evidence: usize,
}

impl Default for DetectionLimits {
    fn default() -> Self {
        Self {
            max_probe_bytes: DEFAULT_MAX_PROBE_BYTES,
            max_name_bytes: 4_096,
            max_media_type_bytes: 256,
            max_evidence: DEFAULT_MAX_EVIDENCE,
        }
    }
}

/// Caller-supplied bounded evidence.
#[derive(Clone, Debug)]
pub struct DetectionInput<'a> {
    pub source: &'a SourceDescriptor,
    pub probe: &'a [u8],
    pub total_length: Option<u64>,
    pub limits: DetectionLimits,
}

/// Stable detection outcome.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DetectionOutcome {
    Supported,
    Ambiguous,
    Unsupported,
    Encrypted,
    Malformed,
    Oversized,
    Inaccessible,
    Binary,
    Cancelled,
    SourceRevised,
}

/// Initial format candidates supported by the foundation.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum FormatCandidate {
    Markdown,
    Mermaid,
    PlainText,
    SourceCode { language: String },
    Binary,
}

/// Confidence attached to a format decision.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DetectionConfidence {
    Low,
    Medium,
    High,
}

/// Inspectable evidence category.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceKind {
    Signature,
    Encoding,
    Structure,
    MediaType,
    Filename,
    Limit,
    HostState,
}

/// One bounded explanation for a detection decision.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct DetectionEvidence {
    pub kind: EvidenceKind,
    pub detail: String,
}

/// Verified text encoding.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextEncoding {
    Utf8,
    Utf8Bom,
    Utf16LeBom,
    Utf16BeBom,
    Unknown,
}

/// Byte-order-mark intent.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BomIntent {
    Absent,
    Present,
    Unknown,
}

/// Observed newline representation.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NewlinePattern {
    Lf,
    Crlf,
    Cr,
    Mixed,
    None,
    Unknown,
}

/// Three-valued source fact.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Presence {
    Present,
    Absent,
    Unknown,
}

/// Lossless handling policy for undecodable bytes.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UndecodableBytes {
    None,
    RequiresUserDecision,
    Unsupported,
}

/// Source representation facts preserved for future save behavior.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct TextProfile {
    pub encoding: TextEncoding,
    pub bom: BomIntent,
    pub newlines: NewlinePattern,
    pub terminal_newline: Presence,
    pub undecodable_bytes: UndecodableBytes,
}

/// Complete deterministic detection result.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct DetectionResult {
    pub outcome: DetectionOutcome,
    pub candidate: Option<FormatCandidate>,
    pub confidence: Option<DetectionConfidence>,
    pub evidence: Vec<DetectionEvidence>,
    pub text_profile: Option<TextProfile>,
    pub bytes_examined: usize,
    pub truncated: bool,
}

impl DetectionResult {
    /// Creates a host-state outcome that does not require byte classification.
    pub fn host_outcome(outcome: DetectionOutcome, detail: impl Into<String>) -> Self {
        Self {
            outcome,
            candidate: None,
            confidence: None,
            evidence: vec![DetectionEvidence {
                kind: EvidenceKind::HostState,
                detail: detail.into(),
            }],
            text_profile: None,
            bytes_examined: 0,
            truncated: false,
        }
    }
}

/// Detects a supported initial format using only caller-supplied bounded evidence.
#[allow(clippy::too_many_lines)]
pub fn detect(input: &DetectionInput<'_>) -> DetectionResult {
    let limits = input.limits;
    let name = input.source.display_name.as_str();
    let media_type = input
        .source
        .claimed_media_type
        .as_deref()
        .unwrap_or_default();
    if input.probe.len() > limits.max_probe_bytes
        || name.len() > limits.max_name_bytes
        || media_type.len() > limits.max_media_type_bytes
        || limits.max_evidence == 0
    {
        return result_with_evidence(
            DetectionOutcome::Oversized,
            None,
            None,
            EvidenceKind::Limit,
            "Detection input exceeds a structural limit",
            input.probe.len().min(limits.max_probe_bytes),
            false,
        );
    }

    let truncated = input
        .total_length
        .is_some_and(|length| length > input.probe.len() as u64);
    if is_encrypted(input.probe) {
        return result_with_evidence(
            DetectionOutcome::Encrypted,
            None,
            Some(DetectionConfidence::High),
            EvidenceKind::Signature,
            "Encrypted content signature",
            input.probe.len(),
            truncated,
        );
    }
    if (input.probe.starts_with(&[0xFF, 0xFE]) || input.probe.starts_with(&[0xFE, 0xFF]))
        && !(input.probe.len() - 2).is_multiple_of(2)
    {
        return result_with_evidence(
            DetectionOutcome::Malformed,
            None,
            Some(DetectionConfidence::High),
            EvidenceKind::Encoding,
            "Malformed UTF-16 byte sequence",
            input.probe.len(),
            truncated,
        );
    }
    if input.probe.starts_with(&[0x1F, 0x8B]) {
        return result_with_evidence(
            DetectionOutcome::Unsupported,
            None,
            Some(DetectionConfidence::High),
            EvidenceKind::Signature,
            "Unsupported Gzip container signature",
            input.probe.len(),
            truncated,
        );
    }
    if binary_signature(input.probe).is_some() {
        return result_with_evidence(
            DetectionOutcome::Binary,
            Some(FormatCandidate::Binary),
            Some(DetectionConfidence::High),
            EvidenceKind::Signature,
            binary_signature(input.probe).unwrap_or("Binary content signature"),
            input.probe.len(),
            truncated,
        );
    }

    let extension = extension(name).to_ascii_lowercase();
    let decoded = decode_text(input.probe, truncated);
    let (text, profile, encoding_detail) = match decoded {
        Ok(value) => value,
        Err(profile) if text_extension_hint(extension.as_str()).is_some() => {
            return DetectionResult {
                outcome: DetectionOutcome::Ambiguous,
                candidate: text_extension_hint(extension.as_str()),
                confidence: Some(DetectionConfidence::Low),
                evidence: bounded_evidence(
                    vec![
                        DetectionEvidence {
                            kind: EvidenceKind::Encoding,
                            detail:
                                "Bytes are not losslessly decodable as a supported text encoding"
                                    .into(),
                        },
                        DetectionEvidence {
                            kind: EvidenceKind::Filename,
                            detail: format!("Text-like filename extension .{extension}"),
                        },
                    ],
                    limits.max_evidence,
                ),
                text_profile: Some(profile),
                bytes_examined: input.probe.len(),
                truncated,
            };
        }
        Err(profile) => {
            return DetectionResult {
                outcome: DetectionOutcome::Binary,
                candidate: Some(FormatCandidate::Binary),
                confidence: Some(DetectionConfidence::Medium),
                evidence: vec![DetectionEvidence {
                    kind: EvidenceKind::Encoding,
                    detail: "Undecodable bytes without compatible text evidence".into(),
                }],
                text_profile: Some(profile),
                bytes_examined: input.probe.len(),
                truncated,
            };
        }
    };

    let mut evidence = vec![DetectionEvidence {
        kind: EvidenceKind::Encoding,
        detail: encoding_detail,
    }];
    let trimmed = text.trim_start_matches(['\u{feff}', ' ', '\t', '\r', '\n']);
    if matches!(extension.as_str(), "mmd" | "mermaid") && mermaid_directive(trimmed).is_none() {
        evidence.push(DetectionEvidence {
            kind: EvidenceKind::Filename,
            detail: format!(
                "Mermaid filename extension .{extension} without a verified diagram declaration"
            ),
        });
        return DetectionResult {
            outcome: DetectionOutcome::Ambiguous,
            candidate: Some(FormatCandidate::Mermaid),
            confidence: Some(DetectionConfidence::Low),
            evidence: bounded_evidence(evidence, limits.max_evidence),
            text_profile: Some(profile),
            bytes_examined: input.probe.len(),
            truncated,
        };
    }
    if !media_type.is_empty() {
        evidence.push(DetectionEvidence {
            kind: EvidenceKind::MediaType,
            detail: format!("Claimed media type {media_type}"),
        });
    }

    let (candidate, confidence, structural_detail) = if mermaid_directive(trimmed).is_some() {
        (
            FormatCandidate::Mermaid,
            DetectionConfidence::High,
            "Standalone Mermaid directive",
        )
    } else if markdown_structure(trimmed)
        || matches!(extension.as_str(), "md" | "markdown" | "mdown")
    {
        (
            FormatCandidate::Markdown,
            if markdown_structure(trimmed) {
                DetectionConfidence::High
            } else {
                DetectionConfidence::Medium
            },
            "Markdown structure or compatible filename",
        )
    } else if let Some(language) = source_language(extension.as_str()) {
        (
            FormatCandidate::SourceCode {
                language: language.into(),
            },
            DetectionConfidence::Medium,
            "Recognized source-language filename",
        )
    } else {
        (
            FormatCandidate::PlainText,
            DetectionConfidence::Medium,
            "Losslessly decoded general text",
        )
    };

    evidence.push(DetectionEvidence {
        kind: EvidenceKind::Structure,
        detail: structural_detail.into(),
    });
    if !extension.is_empty() {
        evidence.push(DetectionEvidence {
            kind: EvidenceKind::Filename,
            detail: format!("Filename extension .{extension}"),
        });
    }

    DetectionResult {
        outcome: DetectionOutcome::Supported,
        candidate: Some(candidate),
        confidence: Some(confidence),
        evidence: bounded_evidence(evidence, limits.max_evidence),
        text_profile: Some(profile),
        bytes_examined: input.probe.len(),
        truncated,
    }
}

fn result_with_evidence(
    outcome: DetectionOutcome,
    candidate: Option<FormatCandidate>,
    confidence: Option<DetectionConfidence>,
    kind: EvidenceKind,
    detail: &str,
    bytes_examined: usize,
    truncated: bool,
) -> DetectionResult {
    DetectionResult {
        outcome,
        candidate,
        confidence,
        evidence: vec![DetectionEvidence {
            kind,
            detail: detail.into(),
        }],
        text_profile: None,
        bytes_examined,
        truncated,
    }
}

fn bounded_evidence(
    mut evidence: Vec<DetectionEvidence>,
    maximum: usize,
) -> Vec<DetectionEvidence> {
    evidence.truncate(maximum);
    evidence
}

fn is_encrypted(probe: &[u8]) -> bool {
    probe.starts_with(b"Salted__") || probe.starts_with(b"-----BEGIN PGP MESSAGE-----")
}

fn binary_signature(probe: &[u8]) -> Option<&'static str> {
    if probe.starts_with(b"%PDF-") {
        Some("PDF signature")
    } else if probe.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("PNG signature")
    } else if probe.starts_with(b"PK\x03\x04") {
        Some("ZIP container signature")
    } else if probe.len() >= 12 && &probe[..4] == b"RIFF" && &probe[8..12] == b"WEBP" {
        Some("WebP signature")
    } else {
        None
    }
}

fn decode_text(
    probe: &[u8],
    truncated: bool,
) -> Result<(String, TextProfile, String), TextProfile> {
    let decoded = if let Some(bytes) = probe.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        decode_utf8(bytes, truncated).map(|text| (text, TextEncoding::Utf8Bom, BomIntent::Present))
    } else if let Some(bytes) = probe.strip_prefix(&[0xFF, 0xFE]) {
        decode_utf16(bytes, true).map(|text| (text, TextEncoding::Utf16LeBom, BomIntent::Present))
    } else if let Some(bytes) = probe.strip_prefix(&[0xFE, 0xFF]) {
        decode_utf16(bytes, false).map(|text| (text, TextEncoding::Utf16BeBom, BomIntent::Present))
    } else {
        decode_utf8(probe, truncated).map(|text| (text, TextEncoding::Utf8, BomIntent::Absent))
    };

    match decoded {
        Ok((text, encoding, bom)) => {
            let profile = text_profile(&text, encoding, bom, truncated);
            Ok((text, profile, format!("Verified {encoding:?}")))
        }
        Err(()) => Err(TextProfile {
            encoding: TextEncoding::Unknown,
            bom: BomIntent::Unknown,
            newlines: NewlinePattern::Unknown,
            terminal_newline: Presence::Unknown,
            undecodable_bytes: UndecodableBytes::RequiresUserDecision,
        }),
    }
}

fn decode_utf8(bytes: &[u8], truncated: bool) -> Result<String, ()> {
    match std::str::from_utf8(bytes) {
        Ok(text) => Ok(text.to_owned()),
        Err(error) if truncated && error.error_len().is_none() => {
            std::str::from_utf8(&bytes[..error.valid_up_to()])
                .map(str::to_owned)
                .map_err(|_| ())
        }
        Err(_) => Err(()),
    }
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> Result<String, ()> {
    if !bytes.len().is_multiple_of(2) {
        return Err(());
    }
    let units = bytes.chunks_exact(2).map(|chunk| {
        let pair = [chunk[0], chunk[1]];
        if little_endian {
            u16::from_le_bytes(pair)
        } else {
            u16::from_be_bytes(pair)
        }
    });
    std::char::decode_utf16(units)
        .collect::<Result<String, _>>()
        .map_err(|_| ())
}

fn text_profile(
    text: &str,
    encoding: TextEncoding,
    bom: BomIntent,
    truncated: bool,
) -> TextProfile {
    let crlf = text.match_indices("\r\n").count();
    let without_crlf = text.replace("\r\n", "");
    let lf = without_crlf.matches('\n').count();
    let cr = without_crlf.matches('\r').count();
    let kinds = usize::from(crlf > 0) + usize::from(lf > 0) + usize::from(cr > 0);
    let newlines = match (kinds, crlf > 0, lf > 0, cr > 0) {
        (0, _, _, _) => NewlinePattern::None,
        (1, true, _, _) => NewlinePattern::Crlf,
        (1, _, true, _) => NewlinePattern::Lf,
        (1, _, _, true) => NewlinePattern::Cr,
        _ => NewlinePattern::Mixed,
    };
    TextProfile {
        encoding,
        bom,
        newlines,
        terminal_newline: if truncated {
            Presence::Unknown
        } else if text.ends_with(['\n', '\r']) {
            Presence::Present
        } else {
            Presence::Absent
        },
        undecodable_bytes: UndecodableBytes::None,
    }
}

fn extension(name: &str) -> &str {
    name.rsplit_once('.')
        .map_or("", |(_, extension)| extension)
        .trim()
}

fn mermaid_directive(text: &str) -> Option<&str> {
    let mut lines = text.lines().map(str::trim);
    let first = lines.next()?;
    if first == "---" {
        for line in lines.by_ref() {
            if line == "---" {
                break;
            }
        }
    } else if !first.is_empty() && !first.starts_with("%%") {
        let directive = first.split_whitespace().next()?;
        return MERMAID_DIRECTIVES.contains(&directive).then_some(directive);
    }
    for line in lines {
        if line.is_empty() || line.starts_with("%%") {
            continue;
        }
        let directive = line.split_whitespace().next()?;
        return MERMAID_DIRECTIVES.contains(&directive).then_some(directive);
    }
    None
}

fn markdown_structure(text: &str) -> bool {
    text.starts_with("# ")
        || text.starts_with("## ")
        || text.starts_with("- ")
        || text.starts_with("* ")
        || text.starts_with("> ")
        || text.contains("```\n")
        || text.contains("](")
}

fn source_language(extension: &str) -> Option<&'static str> {
    match extension.to_ascii_lowercase().as_str() {
        "rs" => Some("rust"),
        "ts" | "tsx" => Some("typescript"),
        "js" | "jsx" => Some("javascript"),
        "py" => Some("python"),
        "json" => Some("json"),
        "toml" => Some("toml"),
        "yaml" | "yml" => Some("yaml"),
        "css" => Some("css"),
        "html" | "htm" => Some("html"),
        _ => None,
    }
}

fn text_extension_hint(extension: &str) -> Option<FormatCandidate> {
    if matches!(
        extension.to_ascii_lowercase().as_str(),
        "md" | "markdown" | "mdown"
    ) {
        Some(FormatCandidate::Markdown)
    } else if matches!(extension.to_ascii_lowercase().as_str(), "mmd" | "mermaid") {
        Some(FormatCandidate::Mermaid)
    } else if let Some(language) = source_language(extension) {
        Some(FormatCandidate::SourceCode {
            language: language.into(),
        })
    } else if matches!(extension.to_ascii_lowercase().as_str(), "txt" | "text") {
        Some(FormatCandidate::PlainText)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{
        DocumentIdentity, IdentityAuthority, IdentityStrength, SourceCapabilities, SourceKind,
    };

    fn source(name: &str) -> SourceDescriptor {
        SourceDescriptor {
            restoration_reference: None,
            identity: DocumentIdentity {
                authority: IdentityAuthority::Synthetic,
                scope: "tests".into(),
                token: name.into(),
                strength: IdentityStrength::Strong,
            },
            display_name: name.into(),
            claimed_media_type: None,
            byte_length: None,
            modified_unix_ms: None,
            kind: SourceKind::Memory,
            capabilities: SourceCapabilities {
                read: true,
                ..SourceCapabilities::default()
            },
        }
    }

    fn detected(name: &str, bytes: &[u8], total: Option<u64>) -> DetectionResult {
        detect(&DetectionInput {
            source: &source(name),
            probe: bytes,
            total_length: total,
            limits: DetectionLimits::default(),
        })
    }

    #[test]
    fn detects_initial_text_formats_and_uses_content_before_extension() {
        assert_eq!(
            detected("readme.md", b"# Heading\n", None).candidate,
            Some(FormatCandidate::Markdown)
        );
        assert_eq!(
            detected("diagram.txt", b"flowchart TB\n A --> B\n", None).candidate,
            Some(FormatCandidate::Mermaid)
        );
        assert_eq!(
            detected(
                "diagram.mermaid",
                b"---\ntitle: Example\n---\nflowchart LR\nA-->B\n",
                None
            )
            .candidate,
            Some(FormatCandidate::Mermaid)
        );
        let ambiguous_mermaid = detected("empty.mmd", b"", None);
        assert_eq!(ambiguous_mermaid.outcome, DetectionOutcome::Ambiguous);
        assert_eq!(ambiguous_mermaid.candidate, Some(FormatCandidate::Mermaid));
        assert_eq!(
            detected("notes.txt", b"ordinary notes", None).candidate,
            Some(FormatCandidate::PlainText)
        );
        assert_eq!(
            detected("README.MD", b"ordinary notes", None).candidate,
            Some(FormatCandidate::Markdown)
        );
        assert_eq!(
            detected("main.rs", b"fn main() {}", None).candidate,
            Some(FormatCandidate::SourceCode {
                language: "rust".into()
            })
        );
        assert_eq!(
            detected("fake.md", b"%PDF-1.7", None).outcome,
            DetectionOutcome::Binary
        );
    }

    #[test]
    fn bounds_probe_and_records_truncation_deterministically() {
        let bytes = vec![b'a'; DEFAULT_MAX_PROBE_BYTES];
        let first = detected("large.txt", &bytes, Some(1_000_000));
        let second = detected("large.txt", &bytes, Some(1_000_000));
        assert!(first.truncated);
        assert_eq!(first.bytes_examined, DEFAULT_MAX_PROBE_BYTES);
        assert_eq!(first, second);

        let oversized = vec![b'a'; DEFAULT_MAX_PROBE_BYTES + 1];
        assert_eq!(
            detected("too-large.txt", &oversized, None).outcome,
            DetectionOutcome::Oversized
        );
    }

    #[test]
    fn represents_every_terminal_outcome() {
        assert_eq!(
            detected("secret.txt", b"Salted__cipher", None).outcome,
            DetectionOutcome::Encrypted
        );
        assert_eq!(
            detected("broken.txt", &[0xFF, 0xFE, 0x61], None).outcome,
            DetectionOutcome::Malformed
        );
        assert_eq!(
            detected("archive.gz", &[0x1F, 0x8B, 0x08], None).outcome,
            DetectionOutcome::Unsupported
        );
        for outcome in [
            DetectionOutcome::Inaccessible,
            DetectionOutcome::Cancelled,
            DetectionOutcome::SourceRevised,
        ] {
            assert_eq!(
                DetectionResult::host_outcome(outcome, "host decision").outcome,
                outcome
            );
        }
        let represented = [
            DetectionOutcome::Supported,
            DetectionOutcome::Ambiguous,
            DetectionOutcome::Unsupported,
            DetectionOutcome::Encrypted,
            DetectionOutcome::Malformed,
            DetectionOutcome::Oversized,
            DetectionOutcome::Inaccessible,
            DetectionOutcome::Binary,
            DetectionOutcome::Cancelled,
            DetectionOutcome::SourceRevised,
        ];
        assert_eq!(represented.len(), 10);
    }

    #[test]
    fn profiles_bom_encoding_newlines_and_terminal_newline() {
        let utf8_bom = detected("bom.txt", b"\xEF\xBB\xBFa\r\nb\r\n", None);
        assert_eq!(
            utf8_bom.text_profile,
            Some(TextProfile {
                encoding: TextEncoding::Utf8Bom,
                bom: BomIntent::Present,
                newlines: NewlinePattern::Crlf,
                terminal_newline: Presence::Present,
                undecodable_bytes: UndecodableBytes::None,
            })
        );

        let little_endian = detected("le.txt", &[0xFF, 0xFE, 0x61, 0x00, 0x0A, 0x00], None);
        assert_eq!(
            little_endian
                .text_profile
                .as_ref()
                .map(|profile| profile.encoding),
            Some(TextEncoding::Utf16LeBom)
        );
        let big_endian = detected("be.txt", &[0xFE, 0xFF, 0x00, 0x61, 0x00, 0x0D], None);
        assert_eq!(
            big_endian
                .text_profile
                .as_ref()
                .map(|profile| profile.encoding),
            Some(TextEncoding::Utf16BeBom)
        );
        assert_eq!(
            detected("mixed.txt", b"a\r\nb\nc\r", None)
                .text_profile
                .as_ref()
                .map(|profile| profile.newlines),
            Some(NewlinePattern::Mixed)
        );
    }

    #[test]
    fn invalid_text_bytes_require_a_decision_without_lossy_decoding() {
        let result = detected("broken.md", &[0xFF, 0x00, 0x81], None);
        assert_eq!(result.outcome, DetectionOutcome::Ambiguous);
        assert_eq!(
            result
                .text_profile
                .as_ref()
                .map(|profile| profile.undecodable_bytes),
            Some(UndecodableBytes::RequiresUserDecision)
        );
    }

    #[test]
    fn truncated_utf8_probe_uses_only_the_complete_verified_prefix() {
        let result = detected("extensionless", b"plain \xE2\x82", Some(9));
        assert_eq!(result.outcome, DetectionOutcome::Supported);
        assert_eq!(result.candidate, Some(FormatCandidate::PlainText));
        assert_eq!(
            result.text_profile,
            Some(TextProfile {
                encoding: TextEncoding::Utf8,
                bom: BomIntent::Absent,
                newlines: NewlinePattern::None,
                terminal_newline: Presence::Unknown,
                undecodable_bytes: UndecodableBytes::None,
            })
        );

        assert_eq!(
            detected("extensionless", &[b'a', 0xFF], Some(3)).outcome,
            DetectionOutcome::Binary
        );
    }

    #[test]
    fn detection_completes_within_the_reference_budget() {
        let bytes = vec![b'a'; DEFAULT_MAX_PROBE_BYTES];
        let started = std::time::Instant::now();
        for _ in 0..100 {
            let result = detected("large.txt", &bytes, Some(1_000_000));
            assert_eq!(result.outcome, DetectionOutcome::Supported);
        }
        assert!(started.elapsed() < std::time::Duration::from_secs(10));
    }
}
