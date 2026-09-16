#![cfg(not(mobile))]

use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use glitchpad_core::contracts::{CoreErrorCategory, IdentityStrength};
use glitchpad_core::source::{
    DurabilityGuarantee, IntegrityRequestId, IntegrityStartRequest, IntegrityState,
    OverwriteAuthorization, RevalidationStatus, SaveOperationId, SaveRequest, SourceState,
};
use glitchpad_lib::source::{DesktopDelivery, DesktopSourceHost};
use uuid::Uuid;

struct TemporarySource {
    directory: PathBuf,
    path: PathBuf,
}

impl TemporarySource {
    fn new(bytes: &[u8]) -> Self {
        Self::named("source.md", bytes)
    }

    fn named(name: &str, bytes: &[u8]) -> Self {
        let directory = std::env::temp_dir().join(format!("glitchpad-s006-{}", Uuid::new_v4()));
        fs::create_dir(&directory).expect("create temporary directory");
        let path = directory.join(name);
        fs::write(&path, bytes).expect("write temporary source");
        Self { directory, path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

#[test]
fn mermaid_deliveries_preserve_source_bytes_and_claim_the_registered_media_type() {
    for name in ["diagram.mmd", "diagram.mermaid"] {
        let source = TemporarySource::named(name, b"flowchart LR\nA-->B\n");
        let host = DesktopSourceHost::new();
        let summary = host
            .acquire(DesktopDelivery::association(source.path()))
            .expect("acquire Mermaid source");
        assert_eq!(
            summary.descriptor.claimed_media_type.as_deref(),
            Some("text/vnd.mermaid")
        );
        assert!(summary.descriptor.restoration_reference.is_some());
        let lease = host
            .open_stream(&summary.source_id, 0, 64)
            .expect("open Mermaid stream");
        assert_eq!(
            host.read_stream(&lease.stream_id, 64)
                .expect("read Mermaid source")
                .bytes,
            b"flowchart LR\nA-->B\n"
        );
    }
}

impl Drop for TemporarySource {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

#[test]
fn raster_corpus_converges_through_registered_desktop_source_authority() {
    for extension in ["png", "jpg", "webp", "bmp", "tiff"] {
        let host = DesktopSourceHost::new();
        let bytes = fs::read(format!("../../fixtures/images/original.{extension}")).unwrap();
        let file = TemporarySource::named(&format!("original.{extension}"), &bytes);
        let source = host.acquire(DesktopDelivery::dialog(file.path())).unwrap();
        let cancelled = std::sync::atomic::AtomicBool::new(false);
        let actual = host
            .read_image_bytes(
                &source.source_id,
                &source.external_revision,
                &cancelled,
                false,
            )
            .unwrap();
        let preview = glitchpad_core::images::decode_image(
            &actual,
            &glitchpad_core::images::ImageLimits::desktop(),
            &cancelled,
        )
        .unwrap();
        assert_eq!(
            (preview.descriptor.width, preview.descriptor.height),
            (4, 3)
        );
        assert_eq!(actual, bytes);
        assert_eq!(fs::read(file.path()).unwrap(), bytes);
        assert_eq!(host.resource_snapshot().unwrap().streams, 0);
    }
}

#[test]
fn image_families_and_generated_icon_export_preserve_desktop_source_authority() {
    let cancel = std::sync::atomic::AtomicBool::new(false);
    for (name, selection) in [
        ("original.svg", 0),
        ("original.gif", 3),
        ("animated.webp", 1),
        ("entries.ico", 1),
    ] {
        let bytes = fs::read(format!("../../fixtures/images/{name}")).unwrap();
        let file = TemporarySource::named(name, &bytes);
        let alias = file.directory.join("original-alias");
        fs::hard_link(file.path(), &alias).unwrap();
        let host = DesktopSourceHost::new();
        let source = host.acquire(DesktopDelivery::dialog(file.path())).unwrap();
        let actual = host
            .read_image_bytes(&source.source_id, &source.external_revision, &cancel, false)
            .unwrap();
        let preview = glitchpad_core::image_family::decode_family(
            &actual,
            selection,
            &glitchpad_core::images::ImageLimits::desktop(),
            &cancel,
        )
        .unwrap()
        .preview;
        assert_eq!(
            (preview.descriptor.width, preview.descriptor.height),
            (4, 3)
        );
        if name == "entries.ico" {
            assert!(
                host.prepare_image_export_destination(
                    &source.source_id,
                    &source.external_revision,
                    file.path()
                )
                .is_err()
            );
            assert!(
                host.prepare_image_export_destination(
                    &source.source_id,
                    &source.external_revision,
                    &alias
                )
                .is_err()
            );
            let destination = file.directory.join("selected.png");
            host.export_image_png(
                &source.source_id,
                &source.external_revision,
                &destination,
                None,
                &preview.png_bytes,
                &cancel,
            )
            .unwrap();
            assert_eq!(fs::read(&destination).unwrap(), preview.png_bytes);
            assert!(
                host.image_revision_matches(&source.source_id, &source.external_revision)
                    .unwrap()
            );
            cancel.store(true, std::sync::atomic::Ordering::Release);
            assert!(
                host.export_image_png(
                    &source.source_id,
                    &source.external_revision,
                    &file.directory.join("cancelled.png"),
                    None,
                    &preview.png_bytes,
                    &cancel
                )
                .is_err()
            );
            assert!(!file.directory.join("cancelled.png").exists());
            cancel.store(false, std::sync::atomic::Ordering::Release);
        }
        assert_eq!(actual, bytes);
        assert_eq!(fs::read(file.path()).unwrap(), bytes);
        assert_eq!(host.resource_snapshot().unwrap().streams, 0);
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
fn one_thousand_stale_save_attempts_preserve_the_external_revision() {
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
    for _ in 0..1_000 {
        assert_eq!(
            host.save(SaveRequest {
                operation_id: glitchpad_core::source::SaveOperationId(1),
                source_id: summary.source_id.clone(),
                expected_external_revision: summary.external_revision.clone(),
                expected_session_revision: 1,
                bytes: b"local revision".to_vec(),
                durability_acknowledgement: None,
                overwrite_authorization: None,
            })
            .expect_err("stale save must fail")
            .category,
            CoreErrorCategory::Conflict
        );
    }
    assert_eq!(
        fs::read(source.path()).expect("read preserved external source"),
        b"external revision"
    );
}

#[test]
fn matched_revalidation_adopts_the_revision_for_subsequent_save() {
    let source = TemporarySource::new(b"original");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    fs::write(source.path(), b"accepted external revision").expect("mutate source");
    let changed = host
        .revalidate(&summary.source_id, &summary.external_revision)
        .expect("observe changed revision");
    assert_eq!(changed.status, RevalidationStatus::Changed);
    let accepted = changed.current.expect("current revision");
    let matched = host
        .revalidate(&summary.source_id, &accepted)
        .expect("accept current revision");
    assert_eq!(matched.status, RevalidationStatus::Match);
    let receipt = host
        .save(SaveRequest {
            operation_id: glitchpad_core::source::SaveOperationId(2),
            source_id: summary.source_id,
            expected_external_revision: accepted,
            expected_session_revision: 1,
            bytes: b"local revision after acceptance".to_vec(),
            durability_acknowledgement: None,
            overwrite_authorization: None,
        })
        .expect("save after accepting current revision");
    assert_eq!(receipt.previous_external_revision, matched.current.unwrap());
    assert_eq!(
        fs::read(source.path()).expect("read saved source"),
        b"local revision after acceptance"
    );
}

#[test]
fn reviewed_external_revision_requires_an_exact_second_overwrite_confirmation() {
    let source = TemporarySource::new(b"original");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    fs::write(source.path(), b"external revision").expect("mutate source");
    let reviewed = host
        .revalidate(&summary.source_id, &summary.external_revision)
        .expect("review external revision")
        .current
        .expect("current revision");
    let guarantee = if cfg!(unix) {
        DurabilityGuarantee::AtomicFileAndDirectory
    } else {
        DurabilityGuarantee::AtomicFile
    };
    let mut request = SaveRequest {
        operation_id: SaveOperationId(3),
        source_id: summary.source_id.clone(),
        expected_external_revision: reviewed.clone(),
        expected_session_revision: 1,
        bytes: b"confirmed local revision".to_vec(),
        durability_acknowledgement: None,
        overwrite_authorization: None,
    };

    assert_eq!(
        host.save(request.clone())
            .expect_err("overwrite requires confirmation")
            .category,
        CoreErrorCategory::AcknowledgementRequired
    );
    assert_eq!(
        fs::read(source.path()).expect("external revision remains"),
        b"external revision"
    );

    request.overwrite_authorization = Some(OverwriteAuthorization {
        source_id: summary.source_id,
        reviewed_external_revision: reviewed.clone(),
        session_revision: 1,
        durability: guarantee,
    });
    let receipt = host.save(request).expect("confirmed overwrite");
    assert_eq!(receipt.previous_external_revision, reviewed);
    assert_eq!(
        fs::read(source.path()).expect("read confirmed revision"),
        b"confirmed local revision"
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
    let pending_integrity = integrity_request(&summary);
    host.start_integrity(pending_integrity.clone())
        .expect("start integrity operation");
    fs::write(source.path(), b"after watcher mutation").expect("mutate watched source");

    let deadline = Instant::now() + Duration::from_secs(5);
    let event = loop {
        if let Some(event) = host
            .drain_events(&summary.source_id, 32)
            .expect("drain events")
            .into_iter()
            .find(|event| {
                matches!(
                    event.state,
                    SourceState::Changed | SourceState::WatcherOverflow
                )
            })
        {
            break event;
        }
        assert!(Instant::now() < deadline, "watcher did not report mutation");
        thread::sleep(Duration::from_millis(25));
    };
    assert_eq!(event.sequence, 1);
    assert!(event.revalidation_required);
    assert!(
        !serde_json::to_string(&event)
            .expect("serialize event")
            .contains(&source.path().to_string_lossy().to_string())
    );
    assert_eq!(host.active_integrity_operation_count().unwrap(), 0);
    assert!(
        host.advance_integrity(&pending_integrity.request_id)
            .is_err()
    );
}

fn integrity_request(
    summary: &glitchpad_core::source::DesktopSourceSummary,
) -> IntegrityStartRequest {
    IntegrityStartRequest {
        request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
        source_id: summary.source_id.clone(),
        expected_external_revision: summary.external_revision.clone(),
    }
}

#[test]
fn metadata_snapshot_is_revision_bound_and_path_free() {
    let source = TemporarySource::named("private-source-name.md", b"metadata");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    let snapshot = host
        .query_metadata_snapshot(&summary.source_id)
        .expect("query metadata snapshot");
    assert_eq!(snapshot.source_id, summary.source_id);
    assert_ne!(snapshot.external_revision, summary.external_revision);
    assert_eq!(
        snapshot.external_revision.identity.token,
        summary.source_id.0
    );
    assert_eq!(snapshot.byte_length, Some(8));
    assert_eq!(snapshot.display_name, "private-source-name.md");
    let serialized = serde_json::to_string(&snapshot).expect("serialize snapshot");
    assert!(!serialized.contains(&source.directory.to_string_lossy().to_string()));
    assert!(!serialized.contains(&summary.external_revision.identity.scope));
    assert!(!serialized.contains(&summary.external_revision.identity.token));
    let request = IntegrityStartRequest {
        request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
        source_id: summary.source_id,
        expected_external_revision: snapshot.external_revision,
    };
    assert_eq!(
        host.start_integrity(request.clone()).unwrap().state,
        IntegrityState::Pending
    );
    assert_eq!(
        host.advance_integrity(&request.request_id).unwrap().state,
        IntegrityState::Ready
    );
}

#[test]
fn metadata_snapshot_observes_external_changes_without_accepting_them_for_document_writes() {
    let source = TemporarySource::named("source.md", b"old");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    fs::write(source.path(), b"new metadata bytes").expect("mutate source");

    let snapshot = host
        .query_metadata_snapshot(&summary.source_id)
        .expect("observe changed metadata");

    assert_ne!(snapshot.external_revision, summary.external_revision);
    assert_eq!(snapshot.byte_length, Some(18));
    let integrity_request = IntegrityStartRequest {
        request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
        source_id: summary.source_id.clone(),
        expected_external_revision: snapshot.external_revision,
    };
    assert_eq!(
        host.start_integrity(integrity_request.clone())
            .expect("hash the inspected revision")
            .state,
        IntegrityState::Pending
    );
    assert_eq!(
        host.advance_integrity(&integrity_request.request_id)
            .expect("finish inspected revision integrity")
            .state,
        IntegrityState::Ready
    );
    assert_eq!(
        host.start_integrity(IntegrityStartRequest {
            request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
            source_id: summary.source_id,
            expected_external_revision: summary.external_revision,
        })
        .expect_err("changed source remains unaccepted for document work")
        .category,
        CoreErrorCategory::Conflict
    );
}

#[test]
fn integrity_hashes_empty_and_multi_step_sources() {
    let empty = TemporarySource::new(b"");
    let host = DesktopSourceHost::new();
    let empty_summary = host
        .acquire(DesktopDelivery::dialog(empty.path()))
        .expect("acquire empty source");
    let empty_result = host
        .start_integrity(integrity_request(&empty_summary))
        .expect("hash empty source");
    assert_eq!(empty_result.state, IntegrityState::Ready);
    assert_eq!(
        empty_result.sha256.as_deref(),
        Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    );

    let bytes = vec![b'a'; 1024 * 1024 + 7];
    let source = TemporarySource::new(&bytes);
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire multi-step source");
    let request = integrity_request(&summary);
    assert_eq!(
        host.start_integrity(request.clone()).unwrap().state,
        IntegrityState::Pending
    );
    let first = host.advance_integrity(&request.request_id).unwrap();
    assert_eq!(first.state, IntegrityState::Pending);
    assert_eq!(first.processed_bytes, 1024 * 1024);
    let ready = host.advance_integrity(&request.request_id).unwrap();
    assert_eq!(ready.state, IntegrityState::Ready);
    assert_eq!(ready.processed_bytes, bytes.len() as u64);
    assert_eq!(
        ready.sha256.as_deref(),
        Some("d068b86fa9718c9ef56229139facc172e9698d68c6248bd86a04857a262ae79e")
    );
}

#[test]
fn revised_source_never_publishes_an_integrity_digest() {
    let source = TemporarySource::new(&vec![b'a'; 1024 * 1024 + 1]);
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    let request = integrity_request(&summary);
    host.start_integrity(request.clone()).unwrap();
    assert_eq!(
        host.advance_integrity(&request.request_id).unwrap().state,
        IntegrityState::Pending
    );
    fs::write(source.path(), b"revised").expect("revise source");
    let stale = host.advance_integrity(&request.request_id).unwrap();
    assert_eq!(stale.state, IntegrityState::Stale);
    assert!(stale.sha256.is_none());
    assert_eq!(host.active_integrity_operation_count().unwrap(), 0);
}

#[test]
fn known_oversized_source_is_limited_before_reading() {
    let source = TemporarySource::new(b"");
    fs::OpenOptions::new()
        .write(true)
        .open(source.path())
        .expect("open sparse fixture")
        .set_len(glitchpad_core::source::MAX_INTEGRITY_SOURCE_BYTES + 1)
        .expect("size sparse fixture");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire oversized source");
    let limited = host
        .start_integrity(integrity_request(&summary))
        .expect("classify oversized source");
    assert_eq!(limited.state, IntegrityState::Limited);
    assert_eq!(limited.error_code.as_deref(), Some("source_too_large"));
    assert!(limited.sha256.is_none());
    assert_eq!(host.active_integrity_operation_count().unwrap(), 0);
}

#[test]
fn cancel_and_close_retire_integrity_state_idempotently() {
    let source = TemporarySource::new(b"pending integrity");
    let host = DesktopSourceHost::new();
    let summary = host
        .acquire(DesktopDelivery::dialog(source.path()))
        .expect("acquire source");
    for _ in 0..100 {
        let request = integrity_request(&summary);
        host.start_integrity(request.clone()).unwrap();
        assert!(host.cancel_integrity(&request.request_id).unwrap());
        assert!(!host.cancel_integrity(&request.request_id).unwrap());
    }
    let request = integrity_request(&summary);
    host.start_integrity(request).unwrap();
    host.close(&summary.source_id).unwrap();
    assert_eq!(host.active_integrity_operation_count().unwrap(), 0);
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
