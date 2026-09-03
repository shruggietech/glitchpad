use glitchpad_lib::android_source::AndroidSourceHost;
use glitchpad_lib::performance::{
    MAX_MEMORY_SAMPLES, NativeLeaseSnapshot, PerformanceSampleError, current_working_set_bytes,
    sample_working_set_with,
};

#[cfg(not(mobile))]
use glitchpad_lib::source::DesktopSourceHost;

#[test]
fn memory_collection_is_bounded_and_content_free() {
    let samples = sample_working_set_with(5, current_working_set_bytes).unwrap();
    println!("idle_desktop_working_set_samples={samples:?}");
    assert_eq!(samples.len(), 5);
    assert!(samples.iter().all(|sample| *sample > 0));
    assert_eq!(
        sample_working_set_with(MAX_MEMORY_SAMPLES + 1, current_working_set_bytes),
        Err(PerformanceSampleError::InvalidSampleCount)
    );
}

#[test]
fn empty_native_registries_report_no_retained_leases() {
    let android = AndroidSourceHost::new_for_tests();
    assert_eq!(
        android.resource_snapshot().unwrap(),
        NativeLeaseSnapshot::default()
    );

    #[cfg(not(mobile))]
    {
        let desktop = DesktopSourceHost::new();
        assert_eq!(
            desktop.resource_snapshot().unwrap(),
            NativeLeaseSnapshot::default()
        );
    }
}
