use glitchpad_core::images::{
    ImageFamily, ImageLimits, family_capabilities, image_resource_policy,
};

#[test]
fn every_implemented_family_is_read_only_with_precise_specialized_capabilities() {
    for family in [
        ImageFamily::Raster,
        ImageFamily::Animation,
        ImageFamily::Svg,
        ImageFamily::Ico,
    ] {
        let capabilities = family_capabilities(family);
        assert!(capabilities.view && capabilities.zoom && capabilities.inspect_metadata);
        assert!(!capabilities.edit && !capabilities.save);
        assert_eq!(capabilities.animate, family == ImageFamily::Animation);
        assert_eq!(capabilities.select_frame, family == ImageFamily::Animation);
        assert_eq!(capabilities.select_entry, family == ImageFamily::Ico);
        assert_eq!(capabilities.export_entry, family == ImageFamily::Ico);
    }
}

#[test]
fn family_resource_policy_retains_preexisting_finite_platform_boundaries() {
    for limits in [ImageLimits::desktop(), ImageLimits::android()] {
        let policy = image_resource_policy(limits);
        assert_eq!(policy.max_frames, 1024);
        assert_eq!(policy.max_composited_frames, 2);
        assert_eq!(policy.max_entries, 256);
        assert_eq!(policy.max_svg_nodes, 50_000);
        assert_eq!(policy.max_svg_depth, 128);
        assert_eq!(policy.concurrent_decodes, 1);
        assert_eq!(policy.surface_bytes, limits.surface_bytes);
        assert_eq!(policy.peak_bytes, limits.peak_bytes);
    }
}
