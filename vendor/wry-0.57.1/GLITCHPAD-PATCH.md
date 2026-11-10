# Glitchpad native print completion patch

Base: crates.io wry0.57.1, archive SHA256759c50ddad0ef9913bb5496cb9d509a50433a3b78cb0238d61105526589cf0e9. Original MIT/Apache-2.0 licenses remain in this directory.

S049 adds a fixed native print-completed notification on WebKitGTK cancellation/failure/finish and after the macOS native modal print operation. The Linux callback emits exactly once, including failed-then-finished signal sequences. Windows is unchanged. The notification acknowledges native completion only, with no paper-output claim. macOS uses a modal native panel rather than the asynchronous sheet so completion owns the raster lifetime. Carry and requalify these two methods when updating Wry; see specs/049-pdf-viewer-foundation/research.md R24.

The 2026-11-09 dependency convergence carries the same two print methods onto upstream 0.57.1. No print lifetime or completion contract changes.
