# Glitchpad native print completion patch

Base: crates.io wry0.55.1, archive SHA256186f9871daa55fd9c016578b810d149de58367113db7fb72b462d2323ce19514. Original MIT/Apache-2.0 licenses remain in this directory.

S049 adds a fixed native print-completed notification on WebKitGTK cancellation/failure/finish and after the macOS native modal print operation. The Linux callback emits exactly once, including failed-then-finished signal sequences. Windows is unchanged. The notification acknowledges native completion only, with no paper-output claim. macOS uses a modal native panel rather than the asynchronous sheet so completion owns the raster lifetime. Carry and requalify these two methods when updating Wry; see specs/049-pdf-viewer-foundation/research.md R24.
