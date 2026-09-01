//! Platform file identity and external revision observation.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::time::UNIX_EPOCH;

use file_id::FileId;
use glitchpad_core::contracts::{DocumentIdentity, IdentityAuthority, IdentityStrength};
use glitchpad_core::source::ExternalRevision;

use super::safe_io_error;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct NativeIdentity {
    pub contract: DocumentIdentity,
    pub file_id: Option<FileId>,
}

pub(super) fn observe_identity(path: &Path) -> NativeIdentity {
    match file_id::get_file_id(path) {
        Ok(file_id) => NativeIdentity {
            contract: strong_contract(&file_id),
            file_id: Some(file_id),
        },
        Err(_) => NativeIdentity {
            contract: weak_path_contract(path),
            file_id: None,
        },
    }
}

pub(super) fn observe_revision(
    path: &Path,
) -> Result<(NativeIdentity, ExternalRevision), glitchpad_core::contracts::CoreError> {
    let metadata = fs::metadata(path).map_err(|error| safe_io_error(&error, "observe_revision"))?;
    if !metadata.is_file() {
        return Err(glitchpad_core::contracts::CoreError::new(
            glitchpad_core::contracts::CoreErrorCategory::UnsupportedInput,
            "The delivered desktop source is not a regular file",
            false,
            false,
        ));
    }

    let identity = observe_identity(path);
    let modified_unix_nanos = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .and_then(|value| u64::try_from(value.as_nanos()).ok());
    let revision = ExternalRevision {
        identity: identity.contract.clone(),
        byte_length: metadata.len(),
        modified_unix_nanos,
        change_token: platform_change_token(&metadata),
    };
    Ok((identity, revision))
}

fn strong_contract(file_id: &FileId) -> DocumentIdentity {
    let (scope, token) = match file_id {
        FileId::Inode {
            device_id,
            inode_number,
        } => (
            format!("unix-device-{device_id:x}"),
            format!("{inode_number:x}"),
        ),
        FileId::LowRes {
            volume_serial_number,
            file_index,
        } => (
            format!("windows-volume-{volume_serial_number:x}"),
            format!("{file_index:x}"),
        ),
        FileId::HighRes {
            volume_serial_number,
            file_id,
        } => (
            format!("windows-volume-{volume_serial_number:x}"),
            format!("{file_id:x}"),
        ),
    };
    DocumentIdentity {
        authority: IdentityAuthority::Filesystem,
        scope,
        token,
        strength: IdentityStrength::Strong,
    }
}

fn weak_path_contract(path: &Path) -> DocumentIdentity {
    let normalized = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let mut hasher = DefaultHasher::new();
    normalized.hash(&mut hasher);
    DocumentIdentity {
        authority: IdentityAuthority::Filesystem,
        scope: format!("desktop-path-{}", std::env::consts::OS),
        token: format!("{:016x}", hasher.finish()),
        strength: IdentityStrength::Weak,
    }
}

#[cfg(unix)]
#[allow(clippy::unnecessary_wraps)]
fn platform_change_token(metadata: &fs::Metadata) -> Option<String> {
    use std::os::unix::fs::MetadataExt;

    Some(format!(
        "{:x}:{:x}",
        metadata.ctime(),
        metadata.ctime_nsec()
    ))
}

#[cfg(windows)]
#[allow(clippy::unnecessary_wraps)]
fn platform_change_token(metadata: &fs::Metadata) -> Option<String> {
    use std::os::windows::fs::MetadataExt;

    Some(format!("{:x}", metadata.last_write_time()))
}

#[cfg(not(any(unix, windows)))]
fn platform_change_token(_metadata: &fs::Metadata) -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use std::fs;

    use glitchpad_core::contracts::IdentityStrength;

    use super::*;
    use crate::source::tests::TemporarySource;

    #[test]
    fn regular_file_identity_is_stable_across_observations() {
        let source = TemporarySource::new(b"identity");
        let first = observe_identity(source.path());
        let second = observe_identity(source.path());
        assert_eq!(first.contract, second.contract);
        assert_eq!(first.file_id, second.file_id);
    }

    #[test]
    fn replacing_a_file_changes_strong_identity_or_revision() {
        let source = TemporarySource::new(b"before");
        let (_, before) = observe_revision(source.path()).expect("before revision");
        fs::remove_file(source.path()).expect("remove source");
        fs::write(source.path(), b"replacement").expect("replace source");
        let (_, after) = observe_revision(source.path()).expect("after revision");
        assert_ne!(before, after);
    }

    #[test]
    fn platform_file_identity_is_strong_on_supported_desktop_targets() {
        let source = TemporarySource::new(b"strong identity");
        assert_eq!(
            observe_identity(source.path()).contract.strength,
            IdentityStrength::Strong
        );
    }
}
