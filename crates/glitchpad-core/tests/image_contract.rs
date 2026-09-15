use glitchpad_core::images::{ImageFamily, ImageLimits, admit_surface, family_capabilities};

#[test]
fn every_family_has_explicit_read_only_capabilities() {
    for family in [
        ImageFamily::Raster,
        ImageFamily::Animation,
        ImageFamily::Svg,
        ImageFamily::Ico,
    ] {
        let actions = family_capabilities(family);
        assert!(!actions.edit && !actions.save);
        assert_eq!(actions.view, family == ImageFamily::Raster);
        assert!(!actions.animate && !actions.select_entry && !actions.export_entry);
    }
}

#[test]
fn exact_pixel_boundaries_and_checked_arithmetic_are_enforced() {
    let limits = ImageLimits::desktop();
    assert!(admit_surface(10_000, 10_000, 4, 0, &limits).is_ok());
    assert!(admit_surface(10_001, 10_000, 4, 0, &limits).is_err());
    assert!(admit_surface(20_001, 10_000, 4, 0, &limits).is_err());
    assert!(admit_surface(0, 1, 4, 0, &limits).is_err());
    assert!(admit_surface(u32::MAX, u32::MAX, 8, u64::MAX, &limits).is_err());
    assert!(admit_surface(10_000, 10_000, 4, 0, &ImageLimits::android()).is_err());
}

#[test]
fn all_family_states_and_immutable_budgets_are_schema_defined() {
    use glitchpad_core::images::{
        ImageFamilyState, ImagePreviewKind, SvgPreviewOutput, image_resource_policy,
    };
    let states = [
        ImageFamilyState::Raster {
            preview: ImagePreviewKind::Thumbnail,
        },
        ImageFamilyState::Animation {
            paused: true,
            selected_frame: 0,
            frame_count: None,
            loop_count: None,
            frame_duration_ms: None,
            max_composited_frames: 2,
        },
        ImageFamilyState::Svg {
            output: SvgPreviewOutput::Unavailable,
            external_resources: false,
            scripts: false,
            max_nodes: 50_000,
            max_depth: 128,
        },
        ImageFamilyState::Ico {
            entries: vec![],
            selected_entry: None,
            selected_entry_export: false,
        },
    ];
    for state in states {
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(
            serde_json::from_str::<ImageFamilyState>(&json).unwrap(),
            state
        );
    }
    let policy = image_resource_policy(ImageLimits::desktop());
    assert_eq!(policy.full_pixels, 100_000_000);
    assert_eq!(policy.refuse_pixels, 200_000_000);
    assert_eq!(policy.concurrent_decodes, 1);
    assert_eq!(policy.cancellation_scheduling_ms, 250);
    assert!(
        serde_json::to_string(&schemars::schema_for!(ImageFamilyState))
            .unwrap()
            .contains("selected_entry_export")
    );
    assert!(
        serde_json::to_string(&schemars::schema_for!(
            glitchpad_core::images::ImageResourcePolicy
        ))
        .unwrap()
        .contains("metadata_total_bytes")
    );
}
