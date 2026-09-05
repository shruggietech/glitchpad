#![cfg(not(mobile))]

use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use glitchpad_lib::desktop_delivery::{DesktopDeliveryQueue, DesktopDeliveryStatus};
use glitchpad_lib::source::{DesktopDeliveryKind, DesktopSourceHost};

struct FixtureRoot(PathBuf);

impl FixtureRoot {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "glitchpad-s019-conformance-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir(&root).expect("create fixture root");
        Self(root)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for FixtureRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn dialog_drop_association_and_command_line_share_one_ordered_path_private_boundary() {
    let root = FixtureRoot::new();
    let names = [
        "dialog.md",
        "drop.mmd",
        "association.txt",
        "command line.rs",
    ];
    let paths = names.map(|name| {
        let path = root.path().join(name);
        fs::write(&path, b"bounded source").expect("write fixture");
        path
    });
    let host = DesktopSourceHost::new();
    let queue = DesktopDeliveryQueue::new();

    queue
        .enqueue_paths(&host, DesktopDeliveryKind::Dialog, [paths[0].clone()])
        .expect("dialog");
    queue
        .enqueue_paths(&host, DesktopDeliveryKind::Drop, [paths[1].clone()])
        .expect("drop");
    queue
        .enqueue_paths(&host, DesktopDeliveryKind::Association, [paths[2].clone()])
        .expect("association");
    queue
        .enqueue_arguments(
            &host,
            DesktopDeliveryKind::CommandLine,
            [OsString::from("Glitchpad.exe"), OsString::from(names[3])],
            root.path(),
        )
        .expect("command line");

    let results = queue.drain(64).expect("drain");
    assert_eq!(results.len(), 4);
    assert!(
        results
            .iter()
            .all(|result| result.status == DesktopDeliveryStatus::Opened)
    );
    assert_eq!(
        results
            .iter()
            .filter_map(|result| result.source.as_ref())
            .map(|source| source.descriptor.display_name.as_str())
            .collect::<Vec<_>>(),
        names
    );
    assert!(
        results
            .windows(2)
            .all(|pair| pair[0].sequence < pair[1].sequence)
    );
    let serialized = serde_json::to_string(&results).expect("serialize safe results");
    assert!(!serialized.contains(root.path().to_string_lossy().as_ref()));
}
