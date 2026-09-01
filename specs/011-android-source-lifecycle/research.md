# Research: Android Source Lifecycle

**Date**: 2026-09-01

## Decision 1: Separate inbound deliveries from picker requests

**Decision**: Accept `ACTION_VIEW` and one distinct `ACTION_SEND` content item as inbound deliveries. Glitchpad initiates `ACTION_OPEN_DOCUMENT` for Open and `ACTION_CREATE_DOCUMENT` for Save As, then acquires the returned activity-result URI.

**Rationale**: Android defines Open and Create as Storage Access Framework picker requests, not external actions that third-party apps receive. Modeling them as inbound would produce invalid intent filters and incorrect grant assumptions.

**Alternatives considered**: Treat all four action strings as inbound deliveries, rejected because it conflicts with Android's action contracts; accept `ACTION_SEND_MULTIPLE`, rejected because S011 has one-source acquisition semantics.

**Primary sources**: [Intent reference](https://developer.android.com/reference/android/content/Intent), [Common intents](https://developer.android.com/guide/components/intents-common), [Shared documents and files](https://developer.android.com/training/data-storage/shared/documents-files).

## Decision 2: Use a private Tauri mobile plugin

**Decision**: Add an application-private Tauri mobile plugin crate. Kotlin owns intent, URI, `ContentResolver`, grant, descriptor, picker, and lifecycle mechanics. Rust owns all shared policy, budgets, public IDs, capabilities, revisions, errors, and commands.

**Rationale**: Tauri's supported mobile plugin boundary already forwards initial load, `onNewIntent`, and lifecycle events and serializes bounded native command results. It avoids custom JNI, unsafe code, and generated `MainActivity` coupling.

**Alternatives considered**: Override `MainActivity`, rejected because Tauri already forwards lifecycle events; custom JNI, rejected as unnecessary unsafe glue; copy provider data into a fake filesystem source, rejected because it violates direct URI modeling and can duplicate unbounded content.

**Primary sources**: [Tauri mobile plugin development](https://v2.tauri.app/develop/plugins/develop-mobile/), [Tauri mobile plugin source](https://github.com/tauri-apps/tauri/blob/ad0b98a2329e369364e81e6315824255cbd681f7/crates/tauri/src/plugin/mobile.rs), [Tauri Android activity forwarding](https://github.com/tauri-apps/tauri/blob/ad0b98a2329e369364e81e6315824255cbd681f7/crates/tauri/mobile/android-codegen/TauriActivity.kt).

## Decision 3: Persist only authority actually granted by Glitchpad-initiated pickers

**Decision**: Inbound view and share authority always remains temporary. For Open and Create results, intersect read/write bits actually returned, request only offered persistable modes, catch provider rejection, and verify the result against `persistedUriPermissions` before recording restoration eligibility.

**Rationale**: A persistable flag is only an offer, providers can reject acquisition, and held grants can later disappear after a move, deletion, or user action.

**Alternatives considered**: Trust the intent flag or provider metadata, rejected because neither proves held authority; persist inbound view/share grants, rejected because those senders did not participate in Glitchpad's picker contract.

**Primary sources**: [Persistable grant flag](https://developer.android.com/reference/android/content/Intent#FLAG_GRANT_PERSISTABLE_URI_PERMISSION), [`takePersistableUriPermission`](<https://developer.android.com/reference/android/content/ContentResolver#takePersistableUriPermission(android.net.Uri,%20int)>), [`persistedUriPermissions`](<https://developer.android.com/reference/android/content/ContentResolver#getPersistedUriPermissions()>).

## Decision 4: Use provider document identity only when it is strong

**Decision**: A `DocumentsContract` source has strong identity only when it exposes a durable document ID scoped by provider authority. Generic content URIs remain weak or unavailable. Display name, size, timestamps, MIME type, and URI text never prove equality.

**Rationale**: Document providers guarantee durable unique document IDs within their authority, while generic content providers do not promise stable URI identity. Weak evidence must not collapse sessions.

**Alternatives considered**: Hash URI strings, rejected because raw URI text can be sensitive and unstable; combine display name and size, rejected because collisions are routine and metadata may be missing.

**Primary sources**: [`DocumentsContract.Document`](https://developer.android.com/reference/android/provider/DocumentsContract.Document), [`COLUMN_DOCUMENT_ID`](https://developer.android.com/reference/android/provider/DocumentsContract.Document#COLUMN_DOCUMENT_ID).

## Decision 5: Correct unknown-size and seek assumptions

**Decision**: Make shared external-revision and metadata byte lengths optional. Query only named provider columns and tolerate absent values. Prove seek support on an opened descriptor rather than inferring it from size or provider flags; otherwise expose bounded sequential streaming only.

**Rationale**: Android providers may omit size and may return pipes even for read descriptors. Fabricating zero or seek support violates capability accuracy.

**Alternatives considered**: Preserve mandatory size with zero as unknown, rejected because zero is a valid length; infer seek from descriptor stat size, rejected because it does not prove `lseek` support.

**Primary sources**: [`openFileDescriptor`](<https://developer.android.com/reference/android/content/ContentResolver#openFileDescriptor(android.net.Uri,%20java.lang.String,%20android.os.CancellationSignal)>), [`Os.lseek`](<https://developer.android.com/reference/android/system/Os#lseek(java.io.FileDescriptor,%20long,%20int)>), [`ParcelFileDescriptor.getStatSize`](<https://developer.android.com/reference/android/os/ParcelFileDescriptor#getStatSize()>).

## Decision 6: Default unknown providers to Save As

**Decision**: Provider write flags do not enable direct replacement. Unknown third-party sources are read-only for in-place save and use `ACTION_CREATE_DOCUMENT` for Save As. A future provider-specific update path must classify the write as recoverable non-atomic, require the existing acknowledgement policy, stage the complete bounded payload, revalidate before opening, and verify after close.

**Rationale**: Android explicitly leaves descriptor mode semantics to providers and exposes no portable atomic-replace or compare-and-swap operation. A generic update could truncate external bytes and still fail.

**Alternatives considered**: Open every writable source with `rwt`, rejected because mode and truncation semantics are provider-defined; copy then overwrite, rejected because no portable atomic promotion exists.

**Primary sources**: [`ContentResolver.openFileDescriptor`](<https://developer.android.com/reference/android/content/ContentResolver#openFileDescriptor(android.net.Uri,%20java.lang.String,%20android.os.CancellationSignal)>), [Create a document provider](https://developer.android.com/guide/topics/providers/create-document-provider).

## Decision 7: Revalidate restoration and lifecycle state

**Decision**: Queue initial and redelivered intents through one native path. Persist bounded private records only for grants actually held. After activity or process recreation, cross-check held grants and query/open the provider before advertising availability; temporary sources require redelivery. Provider notifications are hints and never revision authority.

**Rationale**: Persisted grants can disappear and activity recreation does not prove process restoration. New process-local source IDs must be issued only after native authority is revalidated.

**Alternatives considered**: Serialize public source IDs across process death, rejected because they are process-local; persist temporary sources, rejected because their authority does not survive; rely on `ActivityScenario.recreate`, rejected because it does not kill the process.

**Primary sources**: [`Activity.onNewIntent`](<https://developer.android.com/reference/android/app/Activity#onNewIntent(android.content.Intent)>), [Saving UI states](https://developer.android.com/topic/libraries/architecture/saving-states).

## Decision 8: Require real provider evidence on API 24 and API 36

**Decision**: Add a controlled test `DocumentsProvider`, pure Kotlin/Rust tests, and independent headless x86_64 emulator jobs for API 24 and API 36. Process-restoration evidence uses a two-phase test with `adb shell am force-stop`, not activity recreation alone.

**Rationale**: Grant, descriptor, picker, provider failure, and process-restoration behavior cannot be proven solely with mocks. Separate jobs keep one API failure from hiding the other and retain the existing ARM64 packaging build as distinct evidence.

**Alternatives considered**: JVM-only mocks, rejected as insufficient platform evidence; one current API, rejected by issue acceptance; physical-device cloud testing, deferred to the release gate because it adds credentials and cost; cached emulator snapshots, rejected for acceptance evidence because stale state reduces determinism.

**Primary sources**: [AndroidJUnitRunner](https://developer.android.com/training/testing/instrumented-tests/androidx-test-libraries/runner), [Command-line testing](https://developer.android.com/studio/test/command-line), [GitHub-hosted runner acceleration](https://docs.github.com/en/actions/reference/runners/github-hosted-runners#hardware-acceleration), [Android Emulator command line](https://developer.android.com/studio/run/emulator-commandline).
