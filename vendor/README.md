# Scoped Linux D-Bus compatibility patches

S043 retains the exact licensed registry sources and platform behavior of tauri-plugin-opener 2.5.5 and tauri-plugin-single-instance 2.4.5. Provenance, archive digests and source revisions are recorded in `provenance.json`; Apache-2.0/MIT license texts ship with each crate. The obsolete per-crate lockfiles and registry cache markers are omitted. The root application lockfile governs the patched graph.

Published plugin releases still use zbus 5 and its retired standalone names/wire crates. These patches migrate only Linux D-Bus operations to zbus 6 asynchronous APIs on Tauri's persistent runtime, preserving name ownership, callbacks, link validation and other platform sources. Scoped worker threads avoid nested-runtime panics for synchronous plugin callers. No advisory is ignored. Remove the patches when maintained upstream equivalents pass the same Linux single-instance, native source and package lifecycle qualification.

Upstream migration authority: [zbus 6 upgrade guide](https://z-galaxy.github.io/zbus/upgrading-to-6.html).
