//! Narrow external-link boundary for confirmed Markdown navigation.

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use tauri_plugin_opener::OpenerExt;

const MAX_TARGET_CHARS: usize = 2_048;

fn invalid_target() -> CoreError {
    CoreError::new(
        CoreErrorCategory::CapabilityDenied,
        "The external destination is not permitted",
        false,
        true,
    )
}

fn normalize_target(target: &str) -> Result<String, CoreError> {
    let target = target.trim();
    if target.is_empty()
        || target.chars().count() > MAX_TARGET_CHARS
        || target.starts_with("//")
        || target.contains('\\')
        || target.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}'
                )
        })
    {
        return Err(invalid_target());
    }
    let parsed = url::Url::parse(target).map_err(|_| invalid_target())?;
    if !matches!(parsed.scheme(), "http" | "https" | "mailto")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || (parsed.scheme() == "mailto"
            && (parsed.path().is_empty() || parsed.path().contains(',')))
    {
        return Err(invalid_target());
    }
    Ok(parsed.to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
/// Opens a user-confirmed web or mail destination through the operating system.
///
/// # Errors
///
/// Returns a capability error when the destination fails the host policy, or an
/// unavailable error when the operating system cannot open the destination.
pub fn open_external_link(app: tauri::AppHandle, target: String) -> Result<(), CoreError> {
    let target = normalize_target(&target)?;
    app.opener().open_url(target, None::<&str>).map_err(|_| {
        CoreError::new(
            CoreErrorCategory::Unavailable,
            "The external destination could not be opened",
            true,
            true,
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_normalized_disclosed_schemes() {
        assert_eq!(
            normalize_target("HTTPS://Example.COM/path").unwrap(),
            "https://example.com/path"
        );
        assert_eq!(
            normalize_target("mailto:reader@example.com").unwrap(),
            "mailto:reader@example.com"
        );
    }

    #[test]
    fn rejects_unsafe_ambiguous_or_credentialed_targets() {
        for target in [
            "javascript:alert(1)",
            "data:text/html,owned",
            "https://user:secret@example.com",
            "//example.com/path",
            "https://example.com\\other",
            "https://example.com/\u{202e}other",
        ] {
            assert_eq!(
                normalize_target(target).unwrap_err().category,
                CoreErrorCategory::CapabilityDenied
            );
        }
    }
}
