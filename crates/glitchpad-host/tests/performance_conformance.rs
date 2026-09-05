use glitchpad_lib::android_source::AndroidSourceHost;
use glitchpad_lib::performance::{
    MAX_MEMORY_SAMPLES, NativeLeaseSnapshot, PerformanceSampleError, current_working_set_bytes,
    sample_working_set_with, working_set_bytes_for_pid,
};
use std::process::{Child, Command, Stdio};
use std::time::Duration;
use std::{env, fs, thread};

use chrono::{SecondsFormat, Utc};
use serde_json::json;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(not(mobile))]
use glitchpad_lib::source::DesktopSourceHost;

#[test]
fn memory_sampler_contract_is_bounded_and_content_free() {
    let samples = sample_working_set_with(5, current_working_set_bytes).unwrap();
    assert_eq!(samples.len(), 5);
    assert!(samples.iter().all(|sample| *sample > 0));
    assert_eq!(
        sample_working_set_with(MAX_MEMORY_SAMPLES + 1, current_working_set_bytes),
        Err(PerformanceSampleError::InvalidSampleCount)
    );
}

struct ChildGuard(Child);

impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[test]
#[ignore = "requires a packaged release executable and reference-profile host"]
fn desktop_reference_working_set_receipt() {
    let executable = env::var_os("GLITCHPAD_REFERENCE_EXECUTABLE")
        .unwrap_or_else(|| panic!("reference_executable_required"));
    let build_id = env::var("GLITCHPAD_REFERENCE_BUILD_ID")
        .unwrap_or_else(|_| panic!("reference_build_id_required"));
    assert!(
        !build_id.is_empty()
            && build_id.len() <= 128
            && build_id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"._:+-".contains(&byte)),
        "reference_build_id_invalid"
    );

    let mut command = Command::new(executable);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    let child = command
        .spawn()
        .unwrap_or_else(|_| panic!("reference_process_launch_failed"));
    let mut child = ChildGuard(child);
    thread::sleep(Duration::from_secs(5));
    assert!(
        child
            .0
            .try_wait()
            .unwrap_or_else(|_| panic!("reference_process_status_failed"))
            .is_none(),
        "reference_process_exited_before_sampling"
    );

    let process_id = child.0.id();
    let samples = sample_working_set_with(5, || {
        let sample = working_set_bytes_for_pid(process_id)?;
        thread::sleep(Duration::from_millis(100));
        Ok(sample)
    })
    .unwrap_or_else(|_| panic!("reference_process_sampling_failed"));
    let mut sorted = samples.clone();
    sorted.sort_unstable();
    let maximum = *sorted.last().unwrap();
    let classification = if maximum <= 167_772_160 {
        "pass"
    } else if maximum <= 262_144_000 {
        "warning"
    } else {
        "failure"
    };
    let evidence = json!({
        "schema_version": 1,
        "catalog_version": "v0.1.0-performance-1",
        "metric_id": "idle_desktop_working_set",
        "scenario_id": "idle_application",
        "profile_id": "desktop_reference_v1",
        "evidence_class": "reference",
        "build_profile": "release",
        "build_id": build_id,
        "runtime_version": "packaged-desktop-v1",
        "cold_state": false,
        "method": "desktop-packaged-process-v1",
        "samples": samples,
        "median": sorted[2],
        "p95": maximum,
        "maximum": maximum,
        "peak_memory_bytes": maximum,
        "invariants": {},
        "classification": classification,
        "cleanup_complete": true,
        "measured_at": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
    });
    println!("performance_evidence={evidence}");
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

#[test]
fn android_emulator_uses_supported_software_rendering() {
    let workspace = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let workflow = fs::read_to_string(workspace.join(".github/workflows/ci.yml"))
        .expect("CI workflow should be readable");
    let instrumentation =
        fs::read_to_string(workspace.join("scripts/run-android-instrumentation.sh"))
            .expect("Android instrumentation wrapper should be readable");
    let performance_test = fs::read_to_string(workspace.join(
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/performance/PerformanceInstrumentedTest.kt",
    ))
    .expect("Android performance test should be readable");

    assert!(
        workflow.contains("-gpu swiftshader -feature -Vulkan"),
        "Android instrumentation must use the supported software renderer with Vulkan disabled"
    );
    assert!(
        !workflow.contains("swiftshader_indirect"),
        "deprecated indirect rendering reintroduces emulator teardown crashes"
    );
    assert!(
        instrumentation.contains("for attempt in 1 2; do"),
        "standalone instrumentation may be confirmed once, but must not retry without a strict bound"
    );
    assert!(
        instrumentation.contains("if grep -Fq \"$marker\" \"$output\"; then"),
        "standalone instrumentation retries must depend on required semantic evidence"
    );
    assert!(
        instrumentation.contains("adb logcat -d -t 2000"),
        "failed standalone instrumentation attempts must preserve bounded logcat evidence"
    );
    assert!(
        workflow.contains("bash scripts/run-android-instrumentation.sh"),
        "the emulator runner must invoke the multiline retry logic through one shell command"
    );
    assert!(
        performance_test.contains("SystemClock.elapsedRealtime() + 60_000L"),
        "settled-memory sampling must allow a cold hosted API 36 WebView to initialize"
    );
    assert!(
        workflow.contains(
            "-Pandroid.testInstrumentationRunnerArguments.notClass=com.shruggietech.glitchpad.performance.PerformanceInstrumentedTest",
        ),
        "provider tests must not share a process with the legacy WebView performance test"
    );
    let restoration = workflow
        .rfind("restoration-verify.txt")
        .expect("restoration verification should be present");
    let performance = workflow
        .rfind("-e class com.shruggietech.glitchpad.performance.PerformanceInstrumentedTest")
        .expect("isolated performance instrumentation should be present");
    assert!(
        performance > restoration,
        "legacy WebView performance instrumentation must run last"
    );
    assert!(
        workflow.contains(
            "node scripts/check-performance.mjs --android-instrumentation-output \"$RUNNER_TEMP/performance-evidence.txt\"",
        ),
        "CI must validate the emitted performance receipt even if legacy WebView teardown crashes"
    );
    assert!(
        !workflow.contains("grep -Fq 'OK (1 test)' \"$RUNNER_TEMP/performance-evidence.txt\""),
        "legacy WebView process teardown must not replace receipt validation"
    );
}

#[test]
fn android_performance_evidence_precedes_process_teardown() {
    let workspace = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let instrumentation = fs::read_to_string(workspace.join(
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/performance/PerformanceInstrumentedTest.kt",
    ))
    .expect("Android performance instrumentation should be readable");

    assert!(
        instrumentation
            .contains("val scenario = ActivityScenario.launch(MainActivity::class.java)"),
        "the Tauri activity must remain alive while instrumentation publishes its result"
    );
    assert!(
        !instrumentation.contains(".use { scenario ->")
            && !instrumentation.contains("scenario.close()"),
        "explicit ActivityScenario teardown kills the Tauri process before JUnit records success"
    );
}
