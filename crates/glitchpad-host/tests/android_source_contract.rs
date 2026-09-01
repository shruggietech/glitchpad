use glitchpad_android_source::models::{BridgeDelivery, DeliveryBatch};
use glitchpad_lib::android_source::AndroidSourceHost;

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
