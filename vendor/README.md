# Scoped upstream compatibility and diagnostic patches

S043 retains the exact licensed registry sources and platform behavior of tauri-plugin-opener 2.5.5 and tauri-plugin-single-instance 2.4.5. Provenance, archive digests and source revisions are recorded in `provenance.json`; Apache-2.0/MIT license texts ship with each crate. The obsolete per-crate lockfiles and registry cache markers are omitted. The root application lockfile governs the patched graph.

Published plugin releases still use zbus 5 and its retired standalone names/wire crates. These patches migrate only Linux D-Bus operations to zbus 6 asynchronous APIs on Tauri's persistent runtime, preserving name ownership, callbacks, link validation and other platform sources. Scoped worker threads avoid nested-runtime panics for synchronous plugin callers. No advisory is ignored. Remove the patches when maintained upstream equivalents pass the same Linux single-instance, native source and package lifecycle qualification.

Upstream migration authority: [zbus 6 upgrade guide](https://z-galaxy.github.io/zbus/upgrading-to-6.html).

## 2026-11-04: Android debug reply observation

S046 T052 retains every packaged byte of Tauri 2.11.6 and its original Apache-2.0/MIT licenses except the recorded `src/ipc/protocol.rs` delta. Only Android debug builds of the `create_android_document` error response emit fixed, nonprivate formatting/enqueue/ACK stages and request the existing evaluation callback for the identical formatted reply script. Callback receipt is an ACK only; its raw return value is discarded and does not prove JavaScript callback lookup or Promise rejection. Logging errors are ignored. Release builds and other command outcomes retain the existing evaluation path. This records the unresolved native-host-to-JavaScript completion boundary and implements no transport repair, new permission or alternate dispatcher. Remove the observation patch after that actual boundary is resolved and required Android qualification is complete.
