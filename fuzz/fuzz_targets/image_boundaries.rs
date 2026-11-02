#![no_main]

use glitchpad_core::image_family::{decode_family, ico_inventory, image_signature};
use glitchpad_core::image_metadata::{MAX_IMAGE_METADATA_FACTS, extract_image_metadata};
use glitchpad_core::images::{ImageLimits, MAX_IMAGE_PNG_BYTES};
use libfuzzer_sys::fuzz_target;
use std::sync::atomic::AtomicBool;

fuzz_target!(|bytes: &[u8]| {
    if bytes.len() > 65_536 {
        return;
    }
    let cancel = AtomicBool::new(bytes.first() == Some(&0xff));
    let metadata = extract_image_metadata(bytes);
    assert!(metadata.observations.len() <= MAX_IMAGE_METADATA_FACTS);
    assert!(metadata.statuses.len() <= MAX_IMAGE_METADATA_FACTS);
    let _ = image_signature(bytes);
    use glitchpad_core::contracts::{DocumentIdentity, IdentityAuthority, IdentityStrength, SourceCapabilities, SourceDescriptor, SourceKind};
    use glitchpad_core::detection::{DetectionInput, DetectionLimits, detect};
    let source = SourceDescriptor {
        restoration_reference: None,
        identity: DocumentIdentity { authority: IdentityAuthority::Synthetic, scope: "fuzz".into(), token: "source".into(), strength: IdentityStrength::Strong },
        display_name: "untrusted.md".into(), claimed_media_type: None,
        byte_length: Some(bytes.len() as u64), modified_unix_ms: None,
        kind: SourceKind::Memory, capabilities: SourceCapabilities { read: true, ..SourceCapabilities::default() },
    };
    let input = DetectionInput { source: &source, probe: bytes, total_length: Some(bytes.len() as u64), limits: DetectionLimits::default() };
    let first = detect(&input);
    assert_eq!(first, detect(&input));
    assert!(first.bytes_examined <= 65_536 && first.evidence.len() <= 32);
    let _ = glitchpad_core::editor::detect_language("untrusted.rs", &String::from_utf8_lossy(bytes));
    let _ = serde_json::from_slice::<glitchpad_core::source::SaveRequest>(bytes);
    if let Ok(entries) = ico_inventory(bytes, &cancel) {
        assert!(entries.len() <= 256);
    }
    let limits = ImageLimits {
        surface_bytes: 4 * 1024 * 1024,
        peak_bytes: 96 * 1024 * 1024,
    };
    // Exercise both normal and out-of-range frame/entry selectors. Reduced
    // harness ceilings do not change the application's supported limits.
    let selection = u32::from(bytes.last().copied().unwrap_or(0));
    if let Ok(result) = decode_family(bytes, selection, &limits, &cancel) {
        assert!(result.preview.png_bytes.len() <= MAX_IMAGE_PNG_BYTES);
        assert!(result.preview.descriptor.decoded_bytes <= limits.surface_bytes);
        assert!(!result.preview.descriptor.capabilities.edit);
        assert!(!result.preview.descriptor.capabilities.save);
    }
});
