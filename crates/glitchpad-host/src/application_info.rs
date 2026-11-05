//! Read-only installed identity and lazy offline notices.
use serde::{Deserialize, Serialize};
#[derive(Debug, Deserialize, Serialize)]
pub struct InstalledApplicationInfo {
    pub package_identifier: String,
    pub version: String,
    pub version_code: Option<u64>,
    pub channel: String,
    pub platform: String,
    #[serde(default)]
    pub build_commit: Option<String>,
}
pub fn compiled_source() -> Option<String> {
    option_env!("GLITCHPAD_BUILD_COMMIT")
        .or(option_env!("GITHUB_SHA"))
        .map(str::to_owned)
}
pub fn offline_notices() -> String {
    #[cfg(target_os = "android")]
    let third_party = include_str!("../../../packaging/android/THIRD_PARTY_NOTICES.txt");
    #[cfg(target_os = "windows")]
    let third_party = include_str!("../../../packaging/windows/THIRD_PARTY_NOTICES.txt");
    #[cfg(target_os = "macos")]
    let third_party = include_str!("../../../packaging/macos/THIRD_PARTY_NOTICES.txt");
    #[cfg(not(any(target_os = "android", target_os = "windows", target_os = "macos")))]
    let third_party = include_str!("../../../packaging/linux/THIRD_PARTY_NOTICES.txt");
    format!(
        "{}

{}

{third_party}",
        include_str!("../../../LICENSE"),
        include_str!("../../../NOTICE")
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn installed_projection_requires_actual_package_facts() {
        assert!(
            serde_json::from_value::<InstalledApplicationInfo>(
                serde_json::json!({"version":"0.2.0"})
            )
            .is_err()
        );
        let info:InstalledApplicationInfo=serde_json::from_value(serde_json::json!({"package_identifier":"com.example.installed","version":"9.1","version_code":91,"channel":"debug","platform":"android"})).unwrap();
        assert_eq!(info.package_identifier, "com.example.installed");
        assert_eq!(info.version_code, Some(91));
        assert!(info.build_commit.is_none());
    }
    #[test]
    fn offline_notice_projection_contains_the_complete_distribution() {
        let notices = offline_notices();
        assert!(notices.starts_with(include_str!("../../../LICENSE")));
        assert!(notices.contains(include_str!("../../../NOTICE")));
        let platform = if cfg!(target_os = "android") {
            "android"
        } else if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else {
            "linux"
        };
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
            "../../packaging/{platform}/THIRD_PARTY_NOTICES.txt"
        ));
        assert!(notices.ends_with(&std::fs::read_to_string(path).unwrap()));
    }
}
