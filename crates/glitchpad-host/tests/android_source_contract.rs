use glitchpad_android_source::models::{BridgeDelivery, BridgeRejection, DeliveryBatch};
use glitchpad_core::source::{
    IntegrityHasher, IntegrityRequestId, IntegrityStartRequest, IntegrityState,
    MAX_INTEGRITY_SOURCE_BYTES, MAX_INTEGRITY_STEP_BYTES,
};
use glitchpad_lib::android_source::AndroidSourceHost;
use uuid::Uuid;

fn delivery(token: &str, strength: &str, length: Option<u64>) -> BridgeDelivery {
    BridgeDelivery {
        bridge_token: format!("bridge-{token}"),
        delivery_kind: "view".into(),
        identity_scope: "fixture.provider".into(),
        identity_token: token.into(),
        identity_strength: strength.into(),
        display_name: "fixture.txt".into(),
        media_type: Some("text/plain".into()),
        byte_length: length,
        modified_unix_ms: Some(42),
        read_granted: true,
        write_granted: true,
        persisted_read: false,
        persisted_write: false,
        seekable: true,
    }
}

#[test]
fn android_source_contract_preserves_provider_facts_without_write_inference() {
    let host = AndroidSourceHost::new_for_tests();
    let summary = host
        .accept_delivery(&delivery("document", "strong", None))
        .expect("accept provider delivery");

    assert_eq!(summary.descriptor.byte_length, None);
    assert!(summary.descriptor.capabilities.read);
    assert!(summary.descriptor.capabilities.seek);
    assert!(!summary.descriptor.capabilities.write);
    assert!(!summary.descriptor.capabilities.replace_atomically);
}

#[test]
fn android_delivery_batch_is_bounded_before_registration() {
    let host = AndroidSourceHost::new_for_tests();
    let oversized = DeliveryBatch {
        deliveries: (0..65)
            .map(|index| delivery(&format!("document-{index}"), "strong", Some(1)))
            .collect(),
        rejections: Vec::new(),
    };

    assert!(host.accept_batch(&oversized).is_err());
}

#[test]
fn only_strong_provider_identity_deduplicates() {
    let host = AndroidSourceHost::new_for_tests();
    let first = host
        .accept_delivery(&delivery("same", "strong", Some(4)))
        .unwrap();
    let same = host
        .accept_delivery(&delivery("same", "strong", Some(4)))
        .unwrap();
    let weak_one = host
        .accept_delivery(&delivery("weak", "weak", Some(4)))
        .unwrap();
    let weak_two = host
        .accept_delivery(&delivery("weak", "weak", Some(4)))
        .unwrap();

    assert_eq!(first.source_id, same.source_id);
    assert_ne!(weak_one.source_id, weak_two.source_id);
}

#[test]
fn duplicate_strong_delivery_refreshes_safe_provider_facts() {
    let host = AndroidSourceHost::new_for_tests();
    let first = host
        .accept_delivery(&delivery("refresh", "strong", Some(4)))
        .unwrap();
    let refreshed = host
        .accept_delivery(&delivery("refresh", "strong", Some(8)))
        .unwrap();

    assert_eq!(first.source_id, refreshed.source_id);
    assert_eq!(refreshed.external_revision.byte_length, Some(8));
    assert_eq!(
        host.query_metadata(&first.source_id).unwrap().byte_length,
        Some(8)
    );
}

#[test]
fn delivery_drain_preserves_safe_native_rejections() {
    let host = AndroidSourceHost::new_for_tests();
    let drain = host
        .accept_drain(&DeliveryBatch {
            deliveries: vec![delivery("accepted", "strong", Some(1))],
            rejections: vec![BridgeRejection {
                code: "permission_revoked".into(),
                retryable: true,
            }],
        })
        .unwrap();

    assert_eq!(drain.sources.len(), 1);
    assert_eq!(drain.rejections.len(), 1);
    assert_eq!(drain.rejections[0].code, "permission_revoked");
    assert!(drain.rejections[0].retryable);
}

#[test]
fn metadata_snapshot_is_revision_bound_and_contains_no_native_locator() {
    let host = AndroidSourceHost::new_for_tests();
    let source = host
        .accept_delivery(&delivery("private-document-id", "strong", None))
        .unwrap();

    let snapshot = host.query_metadata_snapshot(&source.source_id).unwrap();
    assert_eq!(snapshot.source_id, source.source_id);
    assert_eq!(
        snapshot.external_revision.byte_length,
        source.external_revision.byte_length
    );
    assert_eq!(
        snapshot.external_revision.modified_unix_nanos,
        source.external_revision.modified_unix_nanos
    );
    assert_eq!(
        snapshot.external_revision.identity.token,
        source.source_id.0
    );
    assert_eq!(snapshot.byte_length, None);
    assert_eq!(snapshot.modified_unix_nanos, Some(42_000_000));
    assert_eq!(snapshot.created_unix_nanos, None);
    assert_eq!(snapshot.accessed_unix_nanos, None);
    let wire = serde_json::to_string(&snapshot).unwrap();
    assert!(!wire.contains("private-document-id"));
    assert!(!wire.contains("fixture.provider"));
    assert!(!wire.contains("bridge-private-document-id"));
    assert!(!wire.contains("content://"));
}

#[test]
fn integrity_is_incremental_revision_bound_and_retires_terminal_operations() {
    let host = AndroidSourceHost::new_for_tests();
    let source = host
        .accept_delivery(&delivery("checksum", "strong", None))
        .unwrap();
    host.install_test_source_bytes(&source.source_id, b"abc".to_vec())
        .unwrap();
    let snapshot = host.query_metadata_snapshot(&source.source_id).unwrap();
    let request = IntegrityStartRequest {
        request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
        source_id: source.source_id.clone(),
        expected_external_revision: snapshot.external_revision,
    };

    let started = host.start_integrity(request.clone()).unwrap();
    assert_eq!(started.state, IntegrityState::Pending);
    let ready = host.advance_integrity(&request.request_id).unwrap();
    assert_eq!(ready.state, IntegrityState::Ready);
    assert_eq!(
        ready.sha256.as_deref(),
        Some("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    );
    assert!(host.advance_integrity(&request.request_id).is_err());

    for cycle in 0..100 {
        let mut cycle_request = request.clone();
        cycle_request.request_id = IntegrityRequestId(Uuid::new_v4().to_string());
        host.start_integrity(cycle_request.clone()).unwrap();
        assert!(
            host.cancel_integrity(&cycle_request.request_id).unwrap(),
            "cycle {cycle}"
        );
        assert!(host.advance_integrity(&cycle_request.request_id).is_err());
    }
    assert_eq!(host.active_integrity_operation_count().unwrap(), 0);
}

#[test]
fn integrity_rejects_oversized_and_discards_stale_provider_work() {
    let host = AndroidSourceHost::new_for_tests();
    let oversized = host
        .accept_delivery(&delivery(
            "oversized",
            "strong",
            Some(MAX_INTEGRITY_SOURCE_BYTES + 1),
        ))
        .unwrap();
    let oversized_progress = host
        .start_integrity(IntegrityStartRequest {
            request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
            source_id: oversized.source_id.clone(),
            expected_external_revision: host
                .query_metadata_snapshot(&oversized.source_id)
                .unwrap()
                .external_revision,
        })
        .unwrap();
    assert_eq!(oversized_progress.state, IntegrityState::Limited);
    assert_eq!(host.active_integrity_operation_count().unwrap(), 0);

    let before = delivery("stale", "strong", Some(3));
    let source = host.accept_delivery(&before).unwrap();
    host.install_test_source_bytes(&source.source_id, b"abc".to_vec())
        .unwrap();
    let snapshot = host.query_metadata_snapshot(&source.source_id).unwrap();
    let request = IntegrityStartRequest {
        request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
        source_id: source.source_id.clone(),
        expected_external_revision: snapshot.external_revision,
    };
    host.start_integrity(request.clone()).unwrap();
    let mut changed = before;
    changed.modified_unix_ms = Some(43);
    host.accept_delivery(&changed).unwrap();
    let stale = host.advance_integrity(&request.request_id).unwrap();
    assert_eq!(stale.state, IntegrityState::Stale);
    assert_eq!(stale.sha256, None);
    assert!(host.advance_integrity(&request.request_id).is_err());
    assert_eq!(host.active_integrity_operation_count().unwrap(), 0);
}

#[test]
fn integrity_handles_empty_and_multi_step_sources_without_whole_source_buffering() {
    let host = AndroidSourceHost::new_for_tests();
    let empty = host
        .accept_delivery(&delivery("empty", "strong", Some(0)))
        .unwrap();
    let empty_snapshot = host.query_metadata_snapshot(&empty.source_id).unwrap();
    let empty_progress = host
        .start_integrity(IntegrityStartRequest {
            request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
            source_id: empty.source_id,
            expected_external_revision: empty_snapshot.external_revision,
        })
        .unwrap();
    assert_eq!(empty_progress.state, IntegrityState::Ready);
    assert_eq!(
        empty_progress.sha256.as_deref(),
        Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    );

    let bytes = vec![0x5a; usize::try_from(MAX_INTEGRITY_STEP_BYTES).unwrap() + 3];
    let source = host
        .accept_delivery(&delivery(
            "multi-step",
            "strong",
            Some(u64::try_from(bytes.len()).unwrap()),
        ))
        .unwrap();
    host.install_test_source_bytes(&source.source_id, bytes.clone())
        .unwrap();
    let snapshot = host.query_metadata_snapshot(&source.source_id).unwrap();
    let request = IntegrityStartRequest {
        request_id: IntegrityRequestId(Uuid::new_v4().to_string()),
        source_id: source.source_id,
        expected_external_revision: snapshot.external_revision,
    };
    host.start_integrity(request.clone()).unwrap();
    let first = host.advance_integrity(&request.request_id).unwrap();
    assert_eq!(first.state, IntegrityState::Pending);
    assert_eq!(first.processed_bytes, MAX_INTEGRITY_STEP_BYTES);
    let ready = host.advance_integrity(&request.request_id).unwrap();
    let mut expected = IntegrityHasher::default();
    expected.update(&bytes);
    assert_eq!(ready.state, IntegrityState::Ready);
    assert_eq!(ready.sha256, Some(expected.finalize()));
    assert_eq!(host.active_integrity_operation_count().unwrap(), 0);
}
