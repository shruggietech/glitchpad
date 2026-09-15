use glitchpad_core::image_metadata::extract_image_metadata;

fn jpeg_block(marker: u8, payload: &[u8]) -> Vec<u8> {
    let mut source = vec![0xff, 0xd8, 0xff, marker];
    source.extend_from_slice(&u16::try_from(payload.len() + 2).unwrap().to_be_bytes());
    source.extend_from_slice(payload);
    source.extend_from_slice(&[0xff, 0xd9]);
    source
}

#[test]
fn xmp_known_values_and_location_redaction_are_independent() {
    let xml = br#"<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/" xmlns:exif="http://ns.adobe.com/exif/1.0/" tiff:Make="Example Camera" exif:GPSLatitude="51,31N" /></rdf:RDF></x:xmpmeta>"#;
    let mut payload = b"http://ns.adobe.com/xap/1.0/\0".to_vec();
    payload.extend_from_slice(xml);
    let report = extract_image_metadata(&jpeg_block(0xe1, &payload));
    assert!(
        report
            .observations
            .iter()
            .any(|o| o.key == "image.camera_make")
    );
    let json = serde_json::to_string(&report).unwrap();
    assert!(!json.contains("51,31N"));
    assert!(
        report
            .observations
            .iter()
            .any(|o| o.key == "image.location" && o.value.is_none() && o.original.is_none())
    );
}

#[test]
fn entities_and_unknown_fields_never_expose_payloads() {
    for xml in [
        "<!DOCTYPE x [<!ENTITY secret SYSTEM 'https://example.test/private'>]><x>&secret;</x>",
        "<x xmlns='urn:unknown'>PRIVATE_UNKNOWN_CONTENT</x>",
    ] {
        let mut payload = b"http://ns.adobe.com/xap/1.0/\0".to_vec();
        payload.extend_from_slice(xml.as_bytes());
        let report = extract_image_metadata(&jpeg_block(0xe1, &payload));
        assert!(!report.statuses.is_empty() || report.unknown_fields > 0);
        assert!(
            !serde_json::to_string(&report)
                .unwrap()
                .contains("PRIVATE_UNKNOWN_CONTENT")
        );
    }
}

#[test]
fn duplicates_conflicts_and_unknown_nested_values_are_bounded() {
    let xml = br#"<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:tiff="http://ns.adobe.com/tiff/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><rdf:Description tiff:Make="Camera"><tiff:Make>Other</tiff:Make><dc:title><rdf:Alt><rdf:li>Public title</rdf:li></rdf:Alt><secret xmlns="urn:unknown">PRIVATE_UNKNOWN_CONTENT</secret></dc:title></rdf:Description></rdf:RDF>"#;
    let mut payload = b"http://ns.adobe.com/xap/1.0/\0".to_vec();
    payload.extend_from_slice(xml);
    let report = extract_image_metadata(&jpeg_block(0xe1, &payload));
    assert!(report.statuses.iter().any(|s| s == "metadata_conflict"));
    assert!(report.observations.iter().any(|o| o.duplicate));
    assert!(
        !serde_json::to_string(&report)
            .unwrap()
            .contains("PRIVATE_UNKNOWN_CONTENT")
    );
}

#[test]
fn photoshop_iptc_known_fields_and_location_use_checked_record_lengths() {
    let mut records = vec![0x1c, 1, 90, 0, 3, 0x1b, b'%', b'G'];
    for (dataset, text) in [
        (5, "Synthetic title"),
        (90, "PRIVATE_CITY"),
        (25, "keyword"),
    ] {
        records.extend_from_slice(&[0x1c, 2, dataset]);
        records.extend_from_slice(&u16::try_from(text.len()).unwrap().to_be_bytes());
        records.extend_from_slice(text.as_bytes());
    }
    let mut payload = b"Photoshop 3.0\08BIM\x04\x04\0\0".to_vec();
    payload.extend_from_slice(&u32::try_from(records.len()).unwrap().to_be_bytes());
    payload.extend_from_slice(&records);
    let report = extract_image_metadata(&jpeg_block(0xed, &payload));
    assert!(
        report
            .observations
            .iter()
            .any(|o| o.key == "image.title" && o.family == "iptc")
    );
    assert!(
        !serde_json::to_string(&report)
            .unwrap()
            .contains("PRIVATE_CITY")
    );
    assert!(
        report
            .observations
            .iter()
            .any(|o| o.key == "image.location" && o.value.is_none())
    );
}

#[test]
fn malformed_and_oversized_blocks_cannot_block_safe_raster_preview() {
    use glitchpad_core::images::{ImageLimits, decode_image};
    use std::sync::atomic::AtomicBool;
    let original = include_bytes!("../../../fixtures/images/original.jpg");
    let mut source = jpeg_block(0xe1, b"Exif\0\0INVALID_EXIF");
    source.truncate(source.len() - 2);
    source.extend_from_slice(&original[2..]);
    assert!(
        extract_image_metadata(&source)
            .statuses
            .iter()
            .any(|s| s == "exif_malformed")
    );
    assert!(decode_image(&source, &ImageLimits::desktop(), &AtomicBool::new(false)).is_ok());
    let mut large = b"RIFF\0\0\0\0WEBPXMP ".to_vec();
    large.extend_from_slice(&1_048_577u32.to_le_bytes());
    large.resize(large.len() + 1_048_577, b'x');
    assert!(
        extract_image_metadata(&large)
            .statuses
            .iter()
            .any(|s| s == "metadata_block_limit")
    );
    for length in 0..source.len().min(256) {
        let _ = extract_image_metadata(&source[..length]);
    }
}

#[test]
fn icc_profile_policy_classifies_valid_invalid_and_unsupported_headers() {
    for (signature, color, expected) in [
        (
            b"acsp".as_slice(),
            b"RGB ".as_slice(),
            "icc_profile_not_applied",
        ),
        (b"NOPE", b"RGB ", "icc_profile_invalid"),
        (b"acsp", b"CMYK", "icc_profile_unsupported"),
    ] {
        let mut profile = vec![0; 128];
        profile[..4].copy_from_slice(&128u32.to_be_bytes());
        profile[8] = 4;
        profile[16..20].copy_from_slice(color);
        profile[36..40].copy_from_slice(signature);
        let mut payload = b"ICC_PROFILE\0\x01\x01".to_vec();
        payload.extend_from_slice(&profile);
        let report = extract_image_metadata(&jpeg_block(0xe2, &payload));
        assert!(report.profile_present);
        assert!(report.statuses.iter().any(|s| s == expected));
    }
}

#[test]
fn xmp_scalar_text_preserves_comments_cdata_and_predefined_entities() {
    let xml = br#"<dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">A <!-- safe comment -->&amp; <![CDATA[<B>]]></dc:title>"#;
    let mut payload = b"http://ns.adobe.com/xap/1.0/\0".to_vec();
    payload.extend_from_slice(xml);
    let report = extract_image_metadata(&jpeg_block(0xe1, &payload));
    assert_eq!(report.observations.len(), 1);
    assert_eq!(
        report.observations[0].value,
        Some(glitchpad_core::metadata::MetadataValue::Text(
            "A & <B>".into()
        ))
    );
}

#[test]
fn exif_and_tiff_numeric_original_arrays_are_preserved() {
    let tiff = b"II*\0\x08\0\0\0\x01\0\x27\x88\x03\0\x02\0\0\0\x64\0\xc8\0\0\0\0\0".to_vec();
    let mut exif = b"Exif\0\0".to_vec();
    exif.extend_from_slice(&tiff);
    for report in [
        extract_image_metadata(&tiff),
        extract_image_metadata(&jpeg_block(0xe1, &exif)),
    ] {
        let fact = report
            .observations
            .iter()
            .find(|o| o.key == "image.iso")
            .unwrap();
        assert_eq!(
            fact.original,
            Some(glitchpad_core::image_metadata::ImageOriginalValue::Unsigned(vec![100, 200]))
        );
    }
}

fn put_ifd(bytes: &mut [u8], offset: usize, entries: &[(u16, u16, u32, u32)], next: u32) {
    bytes[offset..offset + 2].copy_from_slice(&u16::try_from(entries.len()).unwrap().to_le_bytes());
    for (index, (tag, kind, count, value)) in entries.iter().enumerate() {
        let start = offset + 2 + index * 12;
        bytes[start..start + 2].copy_from_slice(&tag.to_le_bytes());
        bytes[start + 2..start + 4].copy_from_slice(&kind.to_le_bytes());
        bytes[start + 4..start + 8].copy_from_slice(&count.to_le_bytes());
        bytes[start + 8..start + 12].copy_from_slice(&value.to_le_bytes());
    }
    let end = offset + 2 + entries.len() * 12;
    bytes[end..end + 4].copy_from_slice(&next.to_le_bytes());
}

#[test]
fn gps_tiff_descendants_siblings_and_shared_ifds_never_expose_values() {
    let secret = b"PRIVATE LOCATION\0";
    for shared in [false, true] {
        for reverse in [false, true] {
            let mut tiff = vec![0; 100];
            tiff[..8].copy_from_slice(b"II*\0\x08\0\0\0");
            if shared {
                let mut root = vec![(0x8825, 4, 1, 38), (0x8769, 4, 1, 56)];
                if reverse {
                    root.reverse();
                }
                put_ifd(&mut tiff, 8, &root, 0);
                put_ifd(&mut tiff, 38, &[(0x8769, 4, 1, 56)], 0);
                put_ifd(
                    &mut tiff,
                    56,
                    &[(0x010e, 2, u32::try_from(secret.len()).unwrap(), 100)],
                    0,
                );
            } else {
                put_ifd(&mut tiff, 8, &[(0x8825, 4, 1, 26)], 0);
                put_ifd(&mut tiff, 26, &[(0x8769, 4, 1, 44)], 62);
                put_ifd(
                    &mut tiff,
                    44,
                    &[(0x010e, 2, u32::try_from(secret.len()).unwrap(), 100)],
                    0,
                );
                put_ifd(
                    &mut tiff,
                    62,
                    &[(0x010f, 2, u32::try_from(secret.len()).unwrap(), 100)],
                    0,
                );
            }
            tiff.extend_from_slice(secret);
            let report = extract_image_metadata(&tiff);
            assert!(!serde_json::to_string(&report).unwrap().contains("PRIVATE"));
            assert!(
                report
                    .observations
                    .iter()
                    .any(|o| o.key == "image.location")
            );
        }
    }
}

#[test]
fn gps_linked_capture_time_in_jpeg_exif_is_redacted() {
    let secret = b"PRIVATE LOCATION\0";
    let mut tiff = vec![0; 100];
    tiff[..8].copy_from_slice(b"II*\0\x08\0\0\0");
    put_ifd(&mut tiff, 8, &[(0x8825, 4, 1, 38), (0x8769, 4, 1, 56)], 0);
    put_ifd(&mut tiff, 38, &[(0x8769, 4, 1, 56)], 0);
    put_ifd(
        &mut tiff,
        56,
        &[(0x9003, 2, u32::try_from(secret.len()).unwrap(), 100)],
        0,
    );
    tiff.extend_from_slice(secret);
    let mut payload = b"Exif\0\0".to_vec();
    payload.extend_from_slice(&tiff);
    let report = extract_image_metadata(&jpeg_block(0xe1, &payload));
    assert!(!serde_json::to_string(&report).unwrap().contains("PRIVATE"));
}

#[test]
fn gps_payload_alias_in_ordinary_exif_is_redacted() {
    for reverse in [false, true] {
        for (pointer, secret) in [(96, "51"), (100, "51"), (108, "30"), (124, "51")] {
            let mut tiff = vec![0; 100];
            tiff[..8].copy_from_slice(b"II*\0\x08\0\0\0");
            let mut roots = [(0x8825, 4, 1, 38), (0x8769, 4, 1, 56)];
            if reverse {
                roots.reverse();
            }
            put_ifd(&mut tiff, 8, &roots, 0);
            put_ifd(&mut tiff, 38, &[(0x0002, 5, 3, 100)], 0);
            put_ifd(&mut tiff, 56, &[(0x829a, 5, 1, pointer)], 0);
            for (numerator, denominator) in [(51u32, 1u32), (30, 1), (26, 1), (7, 1)] {
                tiff.extend_from_slice(&numerator.to_le_bytes());
                tiff.extend_from_slice(&denominator.to_le_bytes());
            }
            let mut payload = b"Exif\0\0".to_vec();
            payload.extend_from_slice(&tiff);
            for source in [&tiff, &jpeg_block(0xe1, &payload)] {
                let serialized = serde_json::to_string(&extract_image_metadata(source)).unwrap();
                assert!(!serialized.contains(secret));
                if pointer == 124 {
                    assert!(
                        serialized.contains("7.00000000"),
                        "adjacent public value was withheld"
                    );
                }
            }
            // An invalid sensitive extent must not publish ordinary values first.
            put_ifd(&mut tiff, 38, &[(0x0002, 5, 3, 200)], 0);
            let report = extract_image_metadata(&tiff);
            assert!(
                report
                    .statuses
                    .iter()
                    .any(|status| status == "tiff_metadata_truncated")
            );
            assert!(
                !serde_json::to_string(&report)
                    .unwrap()
                    .contains("7.00000000")
            );
        }
    }
}
