#![cfg(not(mobile))]

use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use glitchpad_core::contracts::{CoreErrorCategory, IdentityStrength};
use glitchpad_core::source::{RevalidationStatus, SaveRequest, SourceState};
use glitchpad_lib::source::{DesktopDelivery, DesktopSourceHost};
use uuid::Uuid;

struct TemporarySource {
    directory: PathBuf,
    path: PathBuf,
}

impl TemporarySource {
    fn new(bytes: &[u8]) -> Self {
        let directory = std::env::temp_dir().join(format!("glitchpad-s006-{}", Uuid::new_v4()));
        fs::create_dir(&directory).expect("create temporary directory");
        let path = directory.join("source.md");
        fs::write(&path, bytes).expect("write temporary source");
        Self { directory, path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TemporarySource {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

#[test]
fn every_trusted_delivery_kind_converges_on_one_strong_source() {
    let source = TemporarySource::new(b"# desktop source");
    let host = DesktopSourceHost::new();
    let deliveries = [
        DesktopDelivery::dialog(source.path()),
        DesktopDelivery::dropped(source.path()),
        DesktopDelivery::command_line(source.path()),
        DesktopDelivery::association(source.path()),
    ];
    let summaries: Vec<_> = deliveries
        .into_iter()
        .map(|delivery| host.acquire(delivery).expect("acquire trusted delivery"))
        .collect();
    assert!(
        summaries
            .iter()
            .all(|summary| summary.source_id == summaries[0].source_id)
    );
    assert_eq!(
        summaries[0].descriptor.identity.strength,
        IdentityStrength::Strong
    );
    assert!(summaries[0].descriptor.capabilities.watch);
    assert!(summaries[0].descriptor.capabilities.observe_deletion);
}

#[test]
fn bounded_stream_never_exceeds_declared_budget() {
    let source = TemporarySource::new(b"0123456789");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    let lease = host
        .open_stream(&summary.source_id, 2, 5)
        .expect("open stream");
    assert_eq!(
        host.read_stream(&lease.stream_id, 3)
            .expect("read first chunk")
            .bytes,
        b"234"
    );
    assert_eq!(
        host.read_stream(&lease.stream_id, 3)
            .expect_err("reject chunk beyond remaining budget")
            .category,
        CoreErrorCategory::BudgetExceeded
    );
    assert_eq!(
        host.read_stream(&lease.stream_id, 2)
            .expect("read remaining budget")
            .bytes,
        b"56"
    );
}

#[test]
fn external_mutation_revalidates_as_changed_and_blocks_stale_save() {
    let source = TemporarySource::new(b"original");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    fs::write(source.path(), b"external revision").expect("mutate source");
    let revalidation = host
        .revalidate(&summary.source_id, &summary.external_revision)
        .expect("revalidate source");
    assert_eq!(revalidation.status, RevalidationStatus::Changed);
    assert_eq!(
        host.save(SaveRequest {
            source_id: summary.source_id,
            expected_external_revision: summary.external_revision,
            expected_session_revision: 1,
            bytes: b"local revision".to_vec(),
            durability_acknowledgement: None,
        })
        .expect_err("stale save must fail")
        .category,
        CoreErrorCategory::Conflict
    );
    assert_eq!(
        fs::read(source.path()).expect("read preserved external source"),
        b"external revision"
    );
}

#[test]
fn native_watcher_emits_path_free_ordered_change_state() {
    let source = TemporarySource::new(b"before");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    host.start_watch(&summary.source_id).expect("start watcher");
    fs::write(source.path(), b"after watcher mutation").expect("mutate watched source");

    let deadline = Instant::now() + Duration::from_secs(5);
    let event = loop {
        if let Some(event) = host
            .drain_events(&summary.source_id, 32)
            .expect("drain events")
            .into_iter()
            .find(|event| matches!(event.state, SourceState::Changed | SourceState::WatcherOverflow))
        {
            break event;
        }
        assert!(Instant::now() < deadline, "watcher did not report mutation");
        thread::sleep(Duration::from_millis(25));
    };
    assert_eq!(event.sequence, 1);
    assert!(event.revalidation_required);
    assert!(!serde_json::to_string(&event)
        .expect("serialize event")
        .contains(&source.path().to_string_lossy().to_string()));
}

#[test]
fn external_link_policy_is_explicit_allowlisted_and_one_use() {
    let host = DesktopSourceHost::new();
    let proof = host.begin_user_activation();
    let authorization = host
        .authorize_external_link(proof, "https://example.com/read?q=1")
        .expect("authorize safe target");
    assert_eq!(
        host.consume_link_authorization(authorization.clone())
            .expect("consume authorization"),
        "https://example.com/read?q=1"
    );
    assert_eq!(
        host.consume_link_authorization(authorization)
            .expect_err("reject replay")
            .category,
        CoreErrorCategory::CapabilityDenied
    );
    let proof = host.begin_user_activation();
    assert_eq!(
        host.authorize_external_link(proof, "javascript:alert(1)")
            .expect_err("reject script target")
            .category,
        CoreErrorCategory::InvalidInput
    );
}
