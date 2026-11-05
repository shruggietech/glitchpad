# Scoped upstream compatibility patches

S043 retains the exact licensed registry sources and platform behavior of tauri-plugin-opener 2.5.5 and tauri-plugin-single-instance 2.4.5. Provenance, archive digests and source revisions are recorded in `provenance.json`; Apache-2.0/MIT license texts ship with each crate. The obsolete per-crate lockfiles and registry cache markers are omitted. The root application lockfile governs the patched graph.

Published plugin releases still use zbus 5 and its retired standalone names/wire crates. These patches migrate only Linux D-Bus operations to zbus 6 asynchronous APIs on Tauri's persistent runtime, preserving name ownership, callbacks, link validation and other platform sources. Scoped worker threads avoid nested-runtime panics for synchronous plugin callers. No advisory is ignored. Remove the patches when maintained upstream equivalents pass the same Linux single-instance, native source and package lifecycle qualification.

Upstream migration authority: [zbus 6 upgrade guide](https://z-galaxy.github.io/zbus/upgrading-to-6.html).

## 2026-11-04: Retired Android debug reply observation

S046 T052 temporarily patched Tauri 2.11.6 only to observe create-error reply formatting, enqueue and acknowledgement. T056 restores the ordinary registry Tauri reply path. Commit `45b379dd36be8a580bfc2e81efdf834df217aea3` retains the source; the verified source archive `artifacts/s046-t052-tauri-observation-source.tar.gz` and protocol diff retain the diagnosis, with hashes recorded in `provenance.json`. No diagnostic-only Tauri source remains in the dependency patch graph.

## 2026-11-04: Android user-event queue dispatch

S046 T056 retains the exact 119-file Apache-2.0 Tao 0.35.3 registry archive and its license, adding only the recorded Android channel helper and regression file. The existing Android backend source uses `poll_once` and services queued user events after every poll result because [the Android NDK contract](https://developer.android.com/ndk/reference/group/looper#alooper_pollonce) allows any result to consume a wake. Native sources remain before user work; a native-source exit suppresses dispatch, and an admitted user drain preserves sticky exit and FIFO order. Rejected queue admission returns the original event through `EventLoopClosed` without waking. No timer, retry, resume-specific queue, permission or alternative transport is added.

Existing non-Android source and the upstream Cargo manifest remain byte-identical. The application host registers the real helper tests in its existing workspace test path, using only already-locked test dependencies. Android-only cases call public Tao `run_return` and NDK looper APIs; compilation alone does not establish runtime success. Fresh strict installed-APK cancellation journeys remain required. The documented wake-contract violation does not uniquely establish the dispatch point of any historical failure.

## 2026-11-04: Android deadline classification

S046 T059 retains the raw timeout result before projecting an Android poll result into a native-source event. Only a real timeout reports `ResumeTimeReached`; Wake, Callback and native-source results retain `WaitCancelled` with the requested deadline. The common queue drain, initial iteration, exit ordering and product timing remain unchanged. Four exact-source classification fixtures exercise this distinction. Existing public Android loop cases also assert early-wake and requested-deadline behavior; their local status is compiled-only. No dependency, manifest or framework change is required.
