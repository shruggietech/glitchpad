//! Conflict-safe desktop persistence primitives.

use std::fs;
use std::io::Write;
use std::path::Path;

use atomic_write_file::AtomicWriteFile;
use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::source::DurabilityGuarantee;

use super::safe_io_error;

pub(super) fn platform_guarantee() -> DurabilityGuarantee {
    if cfg!(unix) {
        DurabilityGuarantee::AtomicFileAndDirectory
    } else {
        DurabilityGuarantee::AtomicFile
    }
}

pub(super) fn replace(path: &Path, bytes: &[u8]) -> Result<DurabilityGuarantee, CoreError> {
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
    pending
        .commit()
        .map_err(|error| CoreError::new(
            CoreErrorCategory::PartialWritePrevented,
            "The replacement did not complete; the original source was preserved",
            true,
            true,
        ).with_context("operation", "save_commit").with_context("error_kind", format!("{:?}", error.kind())))?;

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
    let directory = fs::File::open(parent)
        .map_err(|error| safe_io_error(&error, "save_open_parent"))?;
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
        let guarantee = replace(source.path(), b"complete replacement").expect("replace");
        assert_eq!(
            fs::read(source.path()).expect("read replacement"),
            b"complete replacement"
        );
        assert_eq!(guarantee, platform_guarantee());
    }

    #[test]
    fn platform_guarantee_is_never_silent_non_atomic() {
        assert!(!platform_guarantee().requires_acknowledgement());
    }
}
