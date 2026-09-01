# Contract: Android Test Evidence

## Required runtime matrix

| Runtime | ABI | Evidence |
| --- | --- | --- |
| Android API 24 | x86_64 emulator | Connected instrumentation, controlled provider, cold boot, process-restoration phases |
| Android API 36 | x86_64 emulator | Connected instrumentation, controlled provider, cold boot, process-restoration phases |
| Android API 36 compile/package | ARM64 target | Existing debug APK packaging job |

## Controlled provider fixtures

The instrumentation test APK supplies a controlled `DocumentsProvider` enabled only for test delivery. Its fixture documents cover durable seekable content, stream-only pipe content, omitted metadata, directory and virtual sources, read-only sources, renamed metadata, revision mutation, provider disappearance, persistence rejection, successful create/write, short write, close error, and provider exception.

## Required scenarios

- Cold-start `ACTION_VIEW` and duplicate-safe single-item `ACTION_SEND` acquisition.
- Running-activity `onNewIntent` redelivery through the same queue and identity policy.
- Rejection of unsupported actions, text-only or multi-item share, directory, virtual, missing, and unreadable sources.
- Temporary grant behavior and successful or rejected persisted picker grant behavior.
- Bounded range reads for seekable content and bounded stream reads for pipe content.
- Metadata with absent size or time and strong-versus-weak identity comparison.
- Provider rename, revision mutation, failure, disappearance, and grant revocation revalidation.
- Open picker result and Save As create picker result, cancellation, successful complete write, short write, and close or provider failure.
- Two-phase process restoration: seed persisted and temporary sources, force-stop the target process, relaunch, then prove persisted authority is revalidated and temporary authority requires redelivery.
- Static assertion that interface payloads, logs, and stable errors contain no raw content URI or filesystem path.

## CI behavior

API jobs are independent and do not replace the existing Android package build. Emulator runs use hardware acceleration, cold boot, no snapshots, no visible window, no audio, and a bounded boot timeout. The workflow pins every third-party action to an immutable commit. On failure, the job uploads JUnit XML, instrumentation output, emulator logcat, and relevant Gradle reports without provider content or URI disclosure.

## Completion rule

S011 is not verified until both API jobs and the ARM64 package job complete successfully on the pull-request head. A skipped, cancelled, unfinished, or manually inferred run is not evidence.
