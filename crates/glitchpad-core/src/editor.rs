//! Platform-independent text editor limits and language evidence.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::detection::DetectionConfidence;

/// Largest source that may enter the editable text renderer.
pub const EDITABLE_TEXT_MAX_BYTES: u64 = 32 * 1024 * 1024;
/// Largest source that may enter the read-only large-text renderer.
pub const LARGE_TEXT_MAX_BYTES: u64 = 256 * 1024 * 1024;
/// A line above this size disables syntax parsing for the document.
pub const SYNTAX_LINE_MAX_BYTES: u64 = 2 * 1024 * 1024;
/// Maximum evidence and conflict facts retained for a language decision.
pub const MAX_LANGUAGE_EVIDENCE: usize = 16;

/// Text renderer selected from actual source bounds.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextEditorMode {
    Editable,
    LargeReadOnly,
    Refused,
}

/// Stable reason attached to a text mode decision.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextModeReason {
    WithinEditableLimit,
    LargeSource,
    SourceTooLarge,
    ExtremeLine,
}

/// Complete bounded decision for text rendering capability.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct TextModeDecision {
    pub mode: TextEditorMode,
    pub syntax_allowed: bool,
    pub observed_bytes: u64,
    pub longest_line_bytes: Option<u64>,
    pub reason: TextModeReason,
}

/// Chooses editable, large read-only, or refused behavior from observed bounds.
pub const fn decide_text_mode(
    observed_bytes: u64,
    longest_line_bytes: Option<u64>,
) -> TextModeDecision {
    if observed_bytes > LARGE_TEXT_MAX_BYTES {
        return TextModeDecision {
            mode: TextEditorMode::Refused,
            syntax_allowed: false,
            observed_bytes,
            longest_line_bytes,
            reason: TextModeReason::SourceTooLarge,
        };
    }
    if observed_bytes > EDITABLE_TEXT_MAX_BYTES {
        return TextModeDecision {
            mode: TextEditorMode::LargeReadOnly,
            syntax_allowed: false,
            observed_bytes,
            longest_line_bytes,
            reason: TextModeReason::LargeSource,
        };
    }
    let extreme_line = matches!(longest_line_bytes, Some(length) if length > SYNTAX_LINE_MAX_BYTES);
    TextModeDecision {
        mode: TextEditorMode::Editable,
        syntax_allowed: !extreme_line,
        observed_bytes,
        longest_line_bytes,
        reason: if extreme_line {
            TextModeReason::ExtremeLine
        } else {
            TextModeReason::WithinEditableLimit
        },
    }
}

/// Canonical non-executing language modes supported by S013.
#[derive(
    Clone, Copy, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize,
)]
#[serde(rename_all = "snake_case")]
pub enum LanguageId {
    PlainText,
    Rust,
    TypeScript,
    JavaScript,
    Python,
    Json,
    Toml,
    Yaml,
    Css,
    Html,
}

/// Source of one bounded language fact.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LanguageEvidenceKind {
    ExactFilename,
    Extension,
    Shebang,
    Modeline,
    Content,
}

/// One content-free explanation for a language candidate.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct LanguageEvidence {
    pub kind: LanguageEvidenceKind,
    pub language: LanguageId,
    pub detail: String,
}

/// Whether a language decision came from evidence or an explicit session choice.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LanguageDecisionOrigin {
    Automatic,
    SessionOverride,
}

/// Stable language selection with retained supporting and contradictory facts.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct LanguageDecision {
    pub language: LanguageId,
    pub confidence: DetectionConfidence,
    pub evidence: Vec<LanguageEvidence>,
    pub conflicts: Vec<LanguageEvidence>,
    pub origin: LanguageDecisionOrigin,
}

impl LanguageDecision {
    /// Applies an explicit session-only language selection without changing evidence.
    #[must_use]
    pub fn with_session_override(mut self, language: LanguageId) -> Self {
        self.language = language;
        self.confidence = DetectionConfidence::High;
        self.origin = LanguageDecisionOrigin::SessionOverride;
        self
    }
}

/// Detects a bounded non-executing language selection.
pub fn detect_language(display_name: &str, probe: &str) -> LanguageDecision {
    let mut candidates = Vec::new();
    if let Some(language) = exact_filename_language(display_name) {
        candidates.push(evidence(
            LanguageEvidenceKind::ExactFilename,
            language,
            "Recognized exact filename",
        ));
    }
    if let Some(language) = extension_language(display_name) {
        candidates.push(evidence(
            LanguageEvidenceKind::Extension,
            language,
            "Recognized filename extension",
        ));
    }
    if let Some(language) = shebang_language(probe) {
        candidates.push(evidence(
            LanguageEvidenceKind::Shebang,
            language,
            "Recognized interpreter declaration",
        ));
    }
    if let Some(language) = modeline_language(probe) {
        candidates.push(evidence(
            LanguageEvidenceKind::Modeline,
            language,
            "Recognized bounded editor modeline",
        ));
    }
    if let Some(language) = content_language(probe) {
        candidates.push(evidence(
            LanguageEvidenceKind::Content,
            language,
            "Recognized bounded content structure",
        ));
    }
    candidates.truncate(MAX_LANGUAGE_EVIDENCE);

    let selected = select_language(&candidates);
    let evidence = candidates
        .iter()
        .filter(|fact| fact.language == selected)
        .cloned()
        .collect::<Vec<_>>();
    let conflicts = candidates
        .into_iter()
        .filter(|fact| fact.language != selected)
        .take(MAX_LANGUAGE_EVIDENCE.saturating_sub(evidence.len()))
        .collect::<Vec<_>>();
    let confidence = match (selected, evidence.len(), conflicts.is_empty()) {
        (LanguageId::PlainText, _, _) | (_, 0, _) => DetectionConfidence::Low,
        (_, count, true) if count >= 2 => DetectionConfidence::High,
        (_, _, true) => DetectionConfidence::Medium,
        _ => DetectionConfidence::Low,
    };

    LanguageDecision {
        language: selected,
        confidence,
        evidence,
        conflicts,
        origin: LanguageDecisionOrigin::Automatic,
    }
}

fn evidence(kind: LanguageEvidenceKind, language: LanguageId, detail: &str) -> LanguageEvidence {
    LanguageEvidence {
        kind,
        language,
        detail: detail.to_owned(),
    }
}

fn select_language(candidates: &[LanguageEvidence]) -> LanguageId {
    let priority = |kind| match kind {
        LanguageEvidenceKind::Modeline => 5,
        LanguageEvidenceKind::Shebang => 4,
        LanguageEvidenceKind::ExactFilename => 3,
        LanguageEvidenceKind::Extension => 2,
        LanguageEvidenceKind::Content => 1,
    };
    candidates
        .iter()
        .max_by_key(|candidate| {
            let count = candidates
                .iter()
                .filter(|other| other.language == candidate.language)
                .count();
            (count, priority(candidate.kind))
        })
        .map_or(LanguageId::PlainText, |candidate| candidate.language)
}

fn exact_filename_language(display_name: &str) -> Option<LanguageId> {
    let filename = display_name
        .rsplit(['/', '\\'])
        .next()?
        .to_ascii_lowercase();
    match filename.as_str() {
        "cargo.toml" | "pyproject.toml" => Some(LanguageId::Toml),
        "package.json" | "tsconfig.json" => Some(LanguageId::Json),
        _ => None,
    }
}

fn extension_language(display_name: &str) -> Option<LanguageId> {
    let extension = display_name.rsplit_once('.')?.1.to_ascii_lowercase();
    match extension.as_str() {
        "rs" => Some(LanguageId::Rust),
        "ts" | "tsx" => Some(LanguageId::TypeScript),
        "js" | "jsx" | "mjs" | "cjs" => Some(LanguageId::JavaScript),
        "py" | "pyw" => Some(LanguageId::Python),
        "json" | "jsonc" => Some(LanguageId::Json),
        "toml" => Some(LanguageId::Toml),
        "yaml" | "yml" => Some(LanguageId::Yaml),
        "css" => Some(LanguageId::Css),
        "html" | "htm" => Some(LanguageId::Html),
        _ => None,
    }
}

fn shebang_language(probe: &str) -> Option<LanguageId> {
    let first = probe.lines().next()?.trim().to_ascii_lowercase();
    if !first.starts_with("#!") {
        return None;
    }
    if first.contains("python") {
        Some(LanguageId::Python)
    } else if first.contains("node") || first.contains("deno") || first.contains("bun") {
        Some(LanguageId::JavaScript)
    } else {
        None
    }
}

fn modeline_language(probe: &str) -> Option<LanguageId> {
    let lines = probe.lines().collect::<Vec<_>>();
    lines
        .iter()
        .take(5)
        .chain(lines.iter().rev().take(5))
        .find_map(|line| {
            let line = line.to_ascii_lowercase();
            canonical_language_name(&line).filter(|_| {
                line.contains("mode:") || line.contains("ft=") || line.contains("filetype=")
            })
        })
}

fn canonical_language_name(value: &str) -> Option<LanguageId> {
    [
        ("typescript", LanguageId::TypeScript),
        ("javascript", LanguageId::JavaScript),
        ("python", LanguageId::Python),
        ("rust", LanguageId::Rust),
        ("json", LanguageId::Json),
        ("toml", LanguageId::Toml),
        ("yaml", LanguageId::Yaml),
        ("css", LanguageId::Css),
        ("html", LanguageId::Html),
    ]
    .into_iter()
    .find_map(|(name, language)| value.contains(name).then_some(language))
}

fn content_language(probe: &str) -> Option<LanguageId> {
    let trimmed = probe.trim_start_matches(['\u{feff}', ' ', '\t', '\r', '\n']);
    if (trimmed.starts_with('{') || trimmed.starts_with('['))
        && serde_json::from_str::<serde_json::Value>(trimmed).is_ok()
    {
        Some(LanguageId::Json)
    } else if trimmed.starts_with("fn ")
        || trimmed.starts_with("pub ")
        || trimmed.contains("fn main()")
    {
        Some(LanguageId::Rust)
    } else if trimmed.starts_with("def ") || trimmed.starts_with("class ") {
        Some(LanguageId::Python)
    } else if trimmed.starts_with("<!doctype html") || trimmed.starts_with("<html") {
        Some(LanguageId::Html)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_mode_boundaries_are_exact() {
        assert_eq!(
            decide_text_mode(EDITABLE_TEXT_MAX_BYTES, None).mode,
            TextEditorMode::Editable
        );
        assert_eq!(
            decide_text_mode(EDITABLE_TEXT_MAX_BYTES + 1, None).mode,
            TextEditorMode::LargeReadOnly
        );
        assert_eq!(
            decide_text_mode(LARGE_TEXT_MAX_BYTES, None).mode,
            TextEditorMode::LargeReadOnly
        );
        assert_eq!(
            decide_text_mode(LARGE_TEXT_MAX_BYTES + 1, None).mode,
            TextEditorMode::Refused
        );
    }

    #[test]
    fn extreme_line_disables_syntax_without_disabling_editing() {
        let decision = decide_text_mode(3 * 1024 * 1024, Some(SYNTAX_LINE_MAX_BYTES + 1));
        assert_eq!(decision.mode, TextEditorMode::Editable);
        assert!(!decision.syntax_allowed);
        assert_eq!(decision.reason, TextModeReason::ExtremeLine);
    }

    #[test]
    fn modeline_outweighs_conflicting_extension() {
        let decision = detect_language("source.py", "// -*- mode: typescript -*-\nconst x = 1;");
        assert_eq!(decision.language, LanguageId::TypeScript);
        assert_eq!(decision.conflicts.len(), 1);
        assert_eq!(decision.conflicts[0].language, LanguageId::Python);
        assert_eq!(decision.confidence, DetectionConfidence::Low);
    }

    #[test]
    fn agreeing_filename_and_content_produce_high_confidence() {
        let decision = detect_language("main.rs", "fn main() {}\n");
        assert_eq!(decision.language, LanguageId::Rust);
        assert_eq!(decision.confidence, DetectionConfidence::High);
        assert!(decision.conflicts.is_empty());
    }

    #[test]
    fn shebang_handles_extensionless_scripts() {
        let decision = detect_language("tool", "#!/usr/bin/env python3\nprint('ok')\n");
        assert_eq!(decision.language, LanguageId::Python);
        assert_eq!(decision.evidence[0].kind, LanguageEvidenceKind::Shebang);
    }

    #[test]
    fn unknown_input_is_plain_text() {
        let decision = detect_language("README", "ordinary words\n");
        assert_eq!(decision.language, LanguageId::PlainText);
        assert_eq!(decision.confidence, DetectionConfidence::Low);
        assert!(decision.evidence.is_empty());
    }

    #[test]
    fn explicit_override_is_session_scoped_data() {
        let automatic = detect_language("main.rs", "fn main() {}\n");
        let overridden = automatic.clone().with_session_override(LanguageId::Python);
        assert_eq!(overridden.language, LanguageId::Python);
        assert_eq!(overridden.origin, LanguageDecisionOrigin::SessionOverride);
        assert_eq!(automatic.origin, LanguageDecisionOrigin::Automatic);
        assert_eq!(automatic.language, LanguageId::Rust);
    }

    #[test]
    fn evidence_is_bounded_and_content_free() {
        let decision = detect_language("package.json", "{\"secret\":\"do not echo\"}");
        assert!(decision.evidence.len() + decision.conflicts.len() <= MAX_LANGUAGE_EVIDENCE);
        assert!(
            decision
                .evidence
                .iter()
                .chain(&decision.conflicts)
                .all(|fact| !fact.detail.contains("secret"))
        );
    }
}
