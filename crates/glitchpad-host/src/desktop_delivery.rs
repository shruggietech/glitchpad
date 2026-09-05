//! Native-only desktop delivery ingress and path-free interface queue.

use std::collections::{HashSet, VecDeque};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::source::{DesktopSourceSummary, SourceId};
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use crate::source::{DesktopDelivery, DesktopDeliveryKind, DesktopSourceHost};

const MAX_QUEUED_DELIVERIES: usize = 128;
const MAX_DELIVERY_DRAIN: usize = 64;
const GOVERNED_EXTENSIONS: &[&str] = &[
    "cjs", "css", "htm", "html", "js", "json", "jsonc", "jsx", "markdown", "md", "mermaid", "mjs",
    "mmd", "py", "rs", "toml", "ts", "tsx", "txt", "yaml", "yml",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DesktopDeliveryStatus {
    Opened,
    Duplicate,
    Rejected,
}

#[derive(Clone, Debug, Serialize)]
pub struct DesktopDeliveryResult {
    pub sequence: u64,
    pub kind: DesktopDeliveryKind,
    pub status: DesktopDeliveryStatus,
    pub source: Option<DesktopSourceSummary>,
    pub error: Option<CoreError>,
}

#[derive(Default)]
struct DeliveryState {
    queued: VecDeque<DesktopDeliveryResult>,
    delivered_sources: HashSet<String>,
    reserved: usize,
    next_sequence: u64,
}

#[derive(Default)]
pub struct DesktopDeliveryQueue {
    state: Mutex<DeliveryState>,
}

impl DesktopDeliveryQueue {
    pub fn new() -> Self {
        Self::default()
    }

    /// Acquires trusted paths and queues only path-free results.
    ///
    /// # Errors
    ///
    /// Returns a safe source acquisition, queue-capacity, or synchronization error.
    pub fn enqueue_paths(
        &self,
        host: &DesktopSourceHost,
        kind: DesktopDeliveryKind,
        paths: impl IntoIterator<Item = PathBuf>,
    ) -> Result<usize, CoreError> {
        let paths = paths.into_iter().collect::<Vec<_>>();
        {
            let mut state = self.lock()?;
            let occupied = state.queued.len().saturating_add(state.reserved);
            if paths.len() > MAX_QUEUED_DELIVERIES.saturating_sub(occupied) {
                return Err(safe_error(
                    CoreErrorCategory::ResourceLimit,
                    "The desktop delivery queue reached its limit",
                ));
            }
            state.reserved = state.reserved.saturating_add(paths.len());
        }
        let mut accepted = 0;
        for path in paths {
            let acquired = if governed_extension(&path) {
                let delivery = match kind {
                    DesktopDeliveryKind::Dialog => DesktopDelivery::dialog(path),
                    DesktopDeliveryKind::Drop => DesktopDelivery::dropped(path),
                    DesktopDeliveryKind::CommandLine => DesktopDelivery::command_line(path),
                    DesktopDeliveryKind::Association => DesktopDelivery::association(path),
                };
                host.acquire(delivery)
            } else {
                Err(safe_error(
                    CoreErrorCategory::UnsupportedInput,
                    "The delivered file type is not supported",
                ))
            };
            let mut state = self.lock()?;
            state.reserved = state.reserved.saturating_sub(1);
            state.next_sequence = state.next_sequence.saturating_add(1);
            let sequence = state.next_sequence;
            let result = match acquired {
                Ok(source) => {
                    let status = if state.delivered_sources.insert(source.source_id.0.clone()) {
                        DesktopDeliveryStatus::Opened
                    } else {
                        DesktopDeliveryStatus::Duplicate
                    };
                    if status == DesktopDeliveryStatus::Opened {
                        accepted += 1;
                    }
                    DesktopDeliveryResult {
                        sequence,
                        kind,
                        status,
                        source: Some(source),
                        error: None,
                    }
                }
                Err(error) => DesktopDeliveryResult {
                    sequence,
                    kind,
                    status: DesktopDeliveryStatus::Rejected,
                    source: None,
                    error: Some(error),
                },
            };
            state.queued.push_back(result);
        }
        Ok(accepted)
    }

    /// Releases duplicate tracking after its native source is closed.
    ///
    /// # Errors
    ///
    /// Returns unavailable if synchronization fails.
    pub fn release(&self, source_id: &str) -> Result<(), CoreError> {
        self.lock()?.delivered_sources.remove(source_id);
        Ok(())
    }

    /// Resolves secondary-process arguments without reparsing command strings.
    ///
    /// # Errors
    ///
    /// Returns a safe source acquisition, queue-capacity, or synchronization error.
    pub fn enqueue_arguments(
        &self,
        host: &DesktopSourceHost,
        kind: DesktopDeliveryKind,
        arguments: impl IntoIterator<Item = OsString>,
        working_directory: &Path,
    ) -> Result<usize, CoreError> {
        let paths = arguments
            .into_iter()
            .skip(1)
            .filter(|argument| !argument.is_empty())
            .filter(|argument| !argument.to_string_lossy().starts_with('-'))
            .map(PathBuf::from)
            .filter(|path| !looks_like_url(path))
            .map(|path| {
                if path.is_absolute() {
                    path
                } else {
                    working_directory.join(path)
                }
            });
        self.enqueue_paths(host, kind, paths)
    }

    /// Removes up to `maximum` pending results in delivery order.
    ///
    /// # Errors
    ///
    /// Returns invalid input for an unbounded request or unavailable if synchronization fails.
    pub fn drain(&self, maximum: usize) -> Result<Vec<DesktopDeliveryResult>, CoreError> {
        if maximum == 0 || maximum > MAX_DELIVERY_DRAIN {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "The desktop delivery drain limit is invalid",
            ));
        }
        let mut state = self.lock()?;
        Ok((0..maximum)
            .filter_map(|_| state.queued.pop_front())
            .collect())
    }

    fn lock(&self) -> Result<MutexGuard<'_, DeliveryState>, CoreError> {
        self.state.lock().map_err(|_| {
            safe_error(
                CoreErrorCategory::Unavailable,
                "The desktop delivery queue is unavailable",
            )
        })
    }
}

fn governed_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .is_some_and(|extension| GOVERNED_EXTENSIONS.contains(&extension.as_str()))
}

fn looks_like_url(path: &Path) -> bool {
    let value = path.as_os_str().to_string_lossy();
    value.contains("://") || value.starts_with("file:")
}

fn safe_error(category: CoreErrorCategory, summary: &str) -> CoreError {
    CoreError::new(category, summary, false, true)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn drain_desktop_deliveries(
    queue: tauri::State<'_, DesktopDeliveryQueue>,
    maximum: usize,
) -> Result<Vec<DesktopDeliveryResult>, CoreError> {
    queue.drain(maximum)
}

#[tauri::command]
pub(crate) async fn choose_desktop_sources(
    app: tauri::AppHandle,
) -> Result<Vec<DesktopDeliveryResult>, CoreError> {
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .add_filter("Markdown", &["md", "markdown"])
            .add_filter("Mermaid", &["mmd", "mermaid"])
            .add_filter(
                "Text and source",
                &[
                    "txt", "cjs", "css", "htm", "html", "js", "json", "jsonc", "jsx", "mjs", "py",
                    "rs", "toml", "ts", "tsx", "yaml", "yml",
                ],
            )
            .blocking_pick_files()
    })
    .await
    .map_err(|_| {
        safe_error(
            CoreErrorCategory::Unavailable,
            "The native file dialog failed",
        )
    })?;
    let Some(selected) = selected else {
        return Ok(Vec::new());
    };
    let paths = selected
        .into_iter()
        .filter_map(|path| path.into_path().ok())
        .collect::<Vec<_>>();
    let host = app.state::<DesktopSourceHost>();
    let queue = app.state::<DesktopDeliveryQueue>();
    queue.enqueue_paths(&host, DesktopDeliveryKind::Dialog, paths)?;
    let mut results = queue.drain(MAX_DELIVERY_DRAIN)?;
    results.extend(queue.drain(MAX_DELIVERY_DRAIN)?);
    Ok(results)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn close_desktop_source(
    host: tauri::State<'_, DesktopSourceHost>,
    queue: tauri::State<'_, DesktopDeliveryQueue>,
    source_id: SourceId,
) -> Result<(), CoreError> {
    host.close(&source_id)?;
    queue.release(&source_id.0)
}

#[tauri::command]
pub(crate) async fn save_desktop_source_as(
    app: tauri::AppHandle,
    suggested_name: String,
    bytes: Vec<u8>,
) -> Result<bool, CoreError> {
    let safe_name = Path::new(&suggested_name)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("document.txt")
        .to_owned();
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_file_name(safe_name)
            .blocking_save_file()
    })
    .await
    .map_err(|_| {
        safe_error(
            CoreErrorCategory::Unavailable,
            "The native Save As dialog failed",
        )
    })?;
    let Some(selected) = selected else {
        return Ok(false);
    };
    let path = selected.into_path().map_err(|_| {
        safe_error(
            CoreErrorCategory::UnsupportedInput,
            "The selected Save As destination is not a local file",
        )
    })?;
    app.state::<DesktopSourceHost>().save_as(&path, &bytes)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    struct FixtureRoot(PathBuf);

    impl FixtureRoot {
        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for FixtureRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn fixture(name: &str) -> (FixtureRoot, PathBuf) {
        let root = FixtureRoot(
            std::env::temp_dir().join(format!("glitchpad-s019-{}", uuid::Uuid::new_v4())),
        );
        fs::create_dir(&root.0).expect("tempdir");
        let path = root.path().join(name);
        fs::write(&path, b"hello").expect("fixture");
        (root, path)
    }

    #[test]
    fn arguments_resolve_relative_paths_and_ignore_switches_and_urls() {
        let (root, path) = fixture("hello world.md");
        let queue = DesktopDeliveryQueue::new();
        let host = DesktopSourceHost::new();
        queue
            .enqueue_arguments(
                &host,
                DesktopDeliveryKind::CommandLine,
                [
                    OsString::from("Glitchpad.exe"),
                    OsString::from("--ignored"),
                    OsString::from("https://example.com/a.md"),
                    OsString::from("hello world.md"),
                ],
                root.path(),
            )
            .expect("enqueue");
        let results = queue.drain(64).expect("drain");
        assert_eq!(results.len(), 1);
        assert_eq!(
            results[0]
                .source
                .as_ref()
                .expect("source")
                .descriptor
                .display_name,
            "hello world.md"
        );
        assert_eq!(
            path.file_name().and_then(|name| name.to_str()),
            Some("hello world.md")
        );
    }

    #[test]
    fn duplicate_delivery_is_ordered_and_path_free() {
        let (_root, path) = fixture("secret-name.txt");
        let queue = DesktopDeliveryQueue::new();
        let host = DesktopSourceHost::new();
        queue
            .enqueue_paths(&host, DesktopDeliveryKind::Drop, [path.clone()])
            .expect("first");
        queue
            .enqueue_paths(&host, DesktopDeliveryKind::Association, [path])
            .expect("second");
        let results = queue.drain(64).expect("drain");
        assert_eq!(results[0].status, DesktopDeliveryStatus::Opened);
        assert_eq!(results[1].status, DesktopDeliveryStatus::Duplicate);
        assert!(results[0].sequence < results[1].sequence);
        let encoded = serde_json::to_string(&results).expect("serialize");
        assert!(!encoded.contains(std::env::temp_dir().to_string_lossy().as_ref()));
    }

    #[test]
    fn invalid_drain_limits_fail() {
        let queue = DesktopDeliveryQueue::new();
        assert!(queue.drain(0).is_err());
        assert!(queue.drain(65).is_err());
    }

    #[test]
    fn capacity_failure_is_atomic() {
        let (root, path) = fixture("bounded.txt");
        let queue = DesktopDeliveryQueue::new();
        let host = DesktopSourceHost::new();
        let paths = (0..=MAX_QUEUED_DELIVERIES).map(|_| path.clone());
        assert!(
            queue
                .enqueue_paths(&host, DesktopDeliveryKind::Dialog, paths)
                .is_err()
        );
        assert!(queue.drain(MAX_DELIVERY_DRAIN).expect("drain").is_empty());
        drop(root);
    }

    #[test]
    fn released_source_can_be_delivered_again() {
        let (_root, path) = fixture("reopen.txt");
        let queue = DesktopDeliveryQueue::new();
        let host = DesktopSourceHost::new();
        queue
            .enqueue_paths(&host, DesktopDeliveryKind::Dialog, [path.clone()])
            .expect("first");
        let first = queue.drain(1).expect("first drain");
        let source_id = first[0]
            .source
            .as_ref()
            .expect("source")
            .source_id
            .0
            .clone();
        queue.release(&source_id).expect("release");
        queue
            .enqueue_paths(&host, DesktopDeliveryKind::Dialog, [path])
            .expect("second");
        assert_eq!(
            queue.drain(1).expect("second drain")[0].status,
            DesktopDeliveryStatus::Opened
        );
    }

    #[test]
    fn unsupported_extension_is_a_path_free_rejection() {
        let (_root, path) = fixture("rejected.csv");
        let queue = DesktopDeliveryQueue::new();
        let host = DesktopSourceHost::new();
        assert_eq!(
            queue
                .enqueue_paths(&host, DesktopDeliveryKind::Drop, [path])
                .expect("enqueue"),
            0
        );
        let result = queue.drain(1).expect("drain").pop().expect("result");
        assert_eq!(result.status, DesktopDeliveryStatus::Rejected);
        let encoded = serde_json::to_string(&result).expect("serialize");
        assert!(!encoded.contains("rejected.csv"));
    }
}
