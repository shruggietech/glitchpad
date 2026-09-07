# Brand Integration Contract

1. `brand/manifest.json` governs the imported delivery. All entries must exist with exact declared sizes and hashes.
2. `brand/INTEGRATION.md` is project-owned receipt material and is intentionally outside the upstream manifest.
3. Website files under `site/public/` are exact copies from `brand/fonts/`, `brand/logos/`, `brand/favicons/`, or `brand/icons/web/`.
4. Desktop packaging files under `crates/glitchpad-host/icons/` are exact copies from the applicable Windows, macOS, or web icon suite.
5. Android launcher resources under the Tauri icon input and generated Android resource trees are exact copies from `brand/icons/android/`.
6. No copied binary or vector asset may be resized, recolored, optimized, or otherwise regenerated in this repository.
7. Any mismatch, stale foundation reference, missing license, or version disagreement is a blocking validation failure.
