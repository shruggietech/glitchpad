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
        "catalog_version": "v0.1.3-performance-1",
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

fn assert_android_16_cutout_overlay(workflow: &str) {
    assert!(
        workflow.contains("com.android.internal.display.cutout.emulation.corner"),
        "API 36 cutout evidence must use an overlay shipped by the Android 16 platform"
    );
    assert!(
        !workflow.contains("com.android.internal.display.cutout.emulation.top_and_right"),
        "API 36 cutout evidence must not depend on the obsolete emulator overlay package"
    );
}

fn assert_android_ime_request_paths(workspace: &std::path::Path) {
    let appframe_test = fs::read_to_string(workspace.join(
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/shell/BrandBuilderAppFrameInstrumentedTest.kt",
    ))
    .expect("read AppFrame instrumentation source");
    let main_activity = fs::read_to_string(workspace.join(
        "crates/glitchpad-host/gen/android/app/src/main/java/com/shruggietech/glitchpad/MainActivity.kt",
    ))
    .expect("read Android main activity source");
    assert!(
        appframe_test.contains("windowInsetsController")
            && appframe_test.contains("WindowInsets.Type.ime()")
            && appframe_test.contains("showSoftInput")
            && appframe_test.contains("input.focus()")
            && appframe_test.contains("document.activeElement === input")
            && appframe_test.contains("automation.injectInputEvent(down, true)")
            && appframe_test.contains("automation.injectInputEvent(up, true)")
            && appframe_test.contains("InputDevice.SOURCE_TOUCHSCREEN")
            && appframe_test.contains("input.style.top = '50%';"),
        "AppFrame evidence must focus a safely positioned WebView editor, inject a complete system touch gesture, and retain the native IME requests"
    );
    assert!(
        appframe_test
            .find("val imeSnapshot = measureIme(scenario)")
            .expect("IME evidence call")
            < appframe_test
                .find("ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE")
                .expect("landscape evidence call")
            && appframe_test.contains("hide(WindowInsets.Type.ime())")
            && appframe_test.contains("hideSoftInputFromWindow"),
        "IME evidence must run in the initially focused portrait window and clear before orientation changes"
    );

    assert!(
        main_activity.contains("installPre139WebViewImeResizeBridge()")
            && main_activity.contains("webViewMilestone >= 139")
            && main_activity.contains("WindowInsets.Type.ime()")
            && main_activity.contains("content.height - imeBottom")
            && main_activity.contains("return@setOnApplyWindowInsetsListener insets"),
        "the Android host must resize pre-139 WebViews from real modern IME insets without consuming safe-area dispatch"
    );
}

fn assert_android_fixture_ime(workspace: &std::path::Path, workflow: &str) {
    let fixture_ime = fs::read_to_string(workspace.join(
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/shell/FixtureInputMethodService.kt",
    ))
    .expect("read fixture input method source");
    let test_manifest = fs::read_to_string(
        workspace.join("crates/glitchpad-host/gen/android/app/src/androidTest/AndroidManifest.xml"),
    )
    .expect("read Android test manifest");
    assert!(
        fixture_ime.contains("class FixtureInputMethodService : InputMethodService()")
            && fixture_ime.contains("override fun onEvaluateFullscreenMode(): Boolean = false")
            && fixture_ime.contains("ViewGroup.LayoutParams.MATCH_PARENT, height"),
        "AppFrame evidence must use a bounded test-only IME with deterministic resize geometry"
    );
    assert!(
        test_manifest.contains("com.shruggietech.glitchpad.shell.FixtureInputMethodService")
            && test_manifest.contains("android.permission.BIND_INPUT_METHOD")
            && test_manifest.contains("@xml/fixture_input_method"),
        "the Android test APK must declare the deterministic fixture input method"
    );

    let fixture_ime_selection = workflow
        .find("adb shell ime set 'com.shruggietech.glitchpad.test/com.shruggietech.glitchpad.shell.FixtureInputMethodService'")
        .expect("CI must select the deterministic test input method");
    let appframe_evidence = workflow
        .rfind("com.shruggietech.glitchpad.shell.BrandBuilderAppFrameInstrumentedTest")
        .expect("AppFrame evidence invocation should be present");
    assert!(
        workflow.contains(
            "adb shell ime enable 'com.shruggietech.glitchpad.test/com.shruggietech.glitchpad.shell.FixtureInputMethodService'",
        )
            && workflow.contains(
                "adb shell settings get secure default_input_method | grep -Fqx 'com.shruggietech.glitchpad.test/com.shruggietech.glitchpad.shell.FixtureInputMethodService'",
            )
            && fixture_ime_selection < appframe_evidence,
        "CI must enable, select, and verify the fixture IME immediately before AppFrame evidence"
    );
}

#[test]
fn android_emulator_uses_supported_software_rendering() {
    let workspace = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let workflow = fs::read_to_string(workspace.join(".github/workflows/ci.yml"))
        .expect("CI workflow should be readable");
    let instrumentation =
        fs::read_to_string(workspace.join("scripts/run-android-instrumentation.sh"))
            .expect("Android instrumentation wrapper should be readable");
    let connected_tests =
        fs::read_to_string(workspace.join("scripts/run-android-connected-tests.sh"))
            .expect("Android connected-test wrapper should be readable");
    let performance_test = fs::read_to_string(workspace.join(
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/performance/PerformanceInstrumentedTest.kt",
    ))
    .expect("Android performance test should be readable");

    assert!(
        workflow.contains("-gpu swiftshader -feature -Vulkan"),
        "Android instrumentation must use the supported software renderer with Vulkan disabled"
    );
    assert_android_16_cutout_overlay(&workflow);
    assert_android_ime_request_paths(&workspace);
    assert_android_fixture_ime(&workspace, &workflow);
    assert!(
        !workflow.contains("swiftshader_indirect"),
        "deprecated indirect rendering reintroduces emulator teardown crashes"
    );
    assert!(
        instrumentation.contains("for attempt in 1 2; do"),
        "standalone instrumentation may be confirmed once, but must not retry without a strict bound"
    );
    assert!(
        instrumentation.contains(
            "if grep -Fq \"$marker\" \"$output\" || grep -Fq \"$marker\" \"$logcat_output\"; then"
        ),
        "standalone instrumentation retries must accept semantic evidence emitted before Tauri process teardown"
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
        connected_tests.contains(
            "-Pandroid.testInstrumentationRunnerArguments.notClass=com.shruggietech.glitchpad.performance.PerformanceInstrumentedTest",
        ),
        "provider tests must not share a process with the legacy WebView performance test"
    );
    assert!(
        connected_tests
            .contains("com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest",),
        "standalone delivery tests must not share a process with the connected provider suite"
    );
    assert!(
        connected_tests
            .contains("com.shruggietech.glitchpad.shell.BrandBuilderAppFrameInstrumentedTest",),
        "standalone AppFrame tests must not tear down the shared connected provider suite"
    );
    assert!(
        connected_tests.contains("for attempt in 1 2; do"),
        "connected-test recovery must remain bounded to one retry"
    );
    assert!(
        connected_tests.contains("adb shell pm clear com.shruggietech.glitchpad"),
        "connected-test recovery must clear app state after an instrumentation-process crash"
    );
    assert!(
        connected_tests.contains("connected-suite-attempt-${attempt}-logcat.txt"),
        "failed connected-test attempts must preserve logcat evidence in the runner temp directory"
    );
    assert!(
        workflow.contains("bash scripts/run-android-connected-tests.sh"),
        "the emulator runner must invoke connected-test retries through one shell command"
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
