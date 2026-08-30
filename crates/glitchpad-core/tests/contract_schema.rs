use glitchpad_core::{
    contracts::{
        CONTRACT_VERSION, ContractEnvelope, DocumentIdentity, IdentityAuthority, IdentityStrength,
        SourceCapabilities, SourceDescriptor, SourceKind,
    },
    detection::{DetectionOutcome, DetectionResult, TextProfile},
    session::DocumentSession,
};

#[test]
fn source_contract_serializes_with_version_and_independent_capabilities() {
    let source = SourceDescriptor {
        identity: DocumentIdentity {
            authority: IdentityAuthority::AndroidDocument,
            scope: "provider".into(),
            token: "opaque-document-id".into(),
            strength: IdentityStrength::Strong,
        },
        display_name: "notes.md".into(),
        claimed_media_type: Some("text/markdown".into()),
        byte_length: Some(42),
        modified_unix_ms: Some(1_788_044_400_000),
        kind: SourceKind::DocumentUri,
        capabilities: SourceCapabilities {
            read: true,
            stream: true,
            metadata: true,
            ..SourceCapabilities::default()
        },
    };
    let value = serde_json::to_value(ContractEnvelope::current(source)).expect("serialize source");

    assert_eq!(value["contract_version"], CONTRACT_VERSION);
    assert_eq!(value["payload"]["kind"], "document_uri");
    assert_eq!(value["payload"]["capabilities"]["stream"], true);
    assert_eq!(value["payload"]["capabilities"]["write"], false);
}

#[test]
fn schemas_cover_source_detection_text_profile_and_session_contracts() {
    let schemas = [
        schemars::schema_for!(ContractEnvelope<SourceDescriptor>),
        schemars::schema_for!(DetectionResult),
        schemars::schema_for!(TextProfile),
        schemars::schema_for!(DocumentSession),
    ];

    for schema in schemas {
        let value = serde_json::to_value(schema).expect("serialize schema");
        assert_eq!(
            value["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
        assert!(value["type"] == "object" || value["$defs"].is_object());
    }
}

#[test]
fn every_detection_outcome_round_trips_without_case_drift() {
    let outcomes = [
        DetectionOutcome::Supported,
        DetectionOutcome::Ambiguous,
        DetectionOutcome::Unsupported,
        DetectionOutcome::Encrypted,
        DetectionOutcome::Malformed,
        DetectionOutcome::Oversized,
        DetectionOutcome::Inaccessible,
        DetectionOutcome::Binary,
        DetectionOutcome::Cancelled,
        DetectionOutcome::SourceRevised,
    ];

    for outcome in outcomes {
        let encoded = serde_json::to_string(&outcome).expect("serialize outcome");
        let decoded: DetectionOutcome =
            serde_json::from_str(&encoded).expect("deserialize outcome");
        assert_eq!(decoded, outcome);
    }
}
