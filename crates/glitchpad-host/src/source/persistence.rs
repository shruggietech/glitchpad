//! Conflict-safe desktop persistence primitives.

use std::fs;
use std::io::Write;
use std::path::Path;

use atomic_write_file::AtomicWriteFile;
use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::source::{DurabilityGuarantee, ExternalRevision};

use super::{identity::observe_revision, safe_io_error};

pub(super) fn platform_guarantee() -> DurabilityGuarantee {
    if cfg!(unix) {
        DurabilityGuarantee::AtomicFileAndDirectory
    } else {
        DurabilityGuarantee::AtomicFile
    }
}

pub(super) fn replace(
    path: &Path,
    bytes: &[u8],
    expected_revision: &ExternalRevision,
) -> Result<DurabilityGuarantee, CoreError> {
    replace_with_revision_check(path, bytes, expected_revision, |path| {
        observe_revision(path).map(|(_, revision)| revision)
    })
}

fn replace_with_revision_check<F>(
    path: &Path,
    bytes: &[u8],
    expected_revision: &ExternalRevision,
    observe_destination: F,
) -> Result<DurabilityGuarantee, CoreError>
where
    F: FnOnce(&Path) -> Result<ExternalRevision, CoreError>,
{
    let original = fs::metadata(path).map_err(|error| safe_io_error(&error, "save_metadata"))?;
    let permissions = original.permissions();
    let mut pending = AtomicWriteFile::options()
        .open(path)
        .map_err(|error| safe_io_error(&error, "save_open_temporary"))?;
    pending
        .set_permissions(permissions)
        .map_err(|error| safe_io_error(&error, "save_preserve_permissions"))?;
    pending
        .write_all(bytes)
        .map_err(|error| safe_io_error(&error, "save_write"))?;
    pending
        .flush()
        .map_err(|error| safe_io_error(&error, "save_flush"))?;
    pending
        .sync_all()
        .map_err(|error| safe_io_error(&error, "save_sync_file"))?;
    if observe_destination(path)? != *expected_revision {
        return Err(CoreError::new(
            CoreErrorCategory::Conflict,
            "The external source changed while the replacement was prepared",
            true,
            true,
        ));
    }
    pending.commit().map_err(|error| {
        CoreError::new(
            CoreErrorCategory::PartialWritePrevented,
            "The replacement did not complete; the original source was preserved",
            true,
            true,
        )
        .with_context("operation", "save_commit")
        .with_context("error_kind", format!("{:?}", error.kind()))
    })?;

    #[cfg(unix)]
    sync_parent(path)?;

    Ok(platform_guarantee())
}

#[cfg(unix)]
fn sync_parent(path: &Path) -> Result<(), CoreError> {
    let parent = path.parent().ok_or_else(|| {
        CoreError::new(
            CoreErrorCategory::InvalidInput,
            "The source does not have a parent directory",
            false,
            false,
        )
    })?;
    let directory =
        fs::File::open(parent).map_err(|error| safe_io_error(&error, "save_open_parent"))?;
    directory
        .sync_all()
        .map_err(|error| safe_io_error(&error, "save_sync_parent"))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::source::tests::TemporarySource;

    #[test]
    fn replacement_commits_complete_content_and_reports_platform_guarantee() {
        let source = TemporarySource::new(b"original");
        let (_, revision) = observe_revision(source.path()).expect("observe source");
        let guarantee =
            replace(source.path(), b"complete replacement", &revision).expect("replace");
        assert_eq!(
            fs::read(source.path()).expect("read replacement"),
            b"complete replacement"
        );
        assert_eq!(guarantee, platform_guarantee());
    }

    #[test]
    fn missing_destination_fails_without_recreating_it() {
        let source = TemporarySource::new(b"original");
        fs::remove_file(source.path()).expect("remove source before replacement");
        let revision = ExternalRevision {
            identity: glitchpad_core::contracts::DocumentIdentity {
                authority: glitchpad_core::contracts::IdentityAuthority::Synthetic,
                scope: "missing".into(),
                token: "missing".into(),
                strength: glitchpad_core::contracts::IdentityStrength::Unavailable,
            },
            byte_length: 0,
            modified_unix_nanos: None,
            change_token: None,
        };
        let error =
            replace(source.path(), b"replacement", &revision).expect_err("replacement must fail");
        assert_eq!(error.category, CoreErrorCategory::NotFound);
        assert!(!source.path().exists());
    }

    #[cfg(unix)]
    #[test]
    fn replacement_preserves_supported_unix_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let source = TemporarySource::new(b"original");
        fs::set_permissions(source.path(), fs::Permissions::from_mode(0o640))
            .expect("set source permissions");
        let (_, revision) = observe_revision(source.path()).expect("observe source");
        replace(source.path(), b"replacement", &revision).expect("replace source");
        let mode = fs::metadata(source.path())
            .expect("read replacement metadata")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o640);
    }

    #[test]
    fn destination_change_during_preparation_aborts_commit_and_cleans_temporary_file() {
        let source = TemporarySource::new(b"original");
        let (_, expected) = observe_revision(source.path()).expect("observe source");
        let error =
            replace_with_revision_check(source.path(), b"local replacement", &expected, |path| {
                fs::write(path, b"newer external replacement").expect("external replacement");
                observe_revision(path).map(|(_, revision)| revision)
            })
            .expect_err("stale prepared replacement must fail");
        assert_eq!(error.category, CoreErrorCategory::Conflict);
        assert_eq!(
            fs::read(source.path()).expect("read destination"),
            b"newer external replacement"
        );
        assert_eq!(
            fs::read_dir(source.path().parent().expect("source parent"))
                .expect("read source directory")
                .count(),
            1
        );
    }

    #[test]
    fn platform_guarantee_is_never_silent_non_atomic() {
        assert!(!platform_guarantee().requires_acknowledgement());
    }
}
