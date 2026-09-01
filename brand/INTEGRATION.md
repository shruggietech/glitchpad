# Repository integration

Glitchpad brand canon 1.0.0 was imported from the approved `glitchpad-brand.zip` delivery. Files named in `manifest.json` are governed inputs and must remain byte-for-byte identical unless a newly approved canon replaces the delivery.

Production surfaces may consume approved files from `logos/`, `favicons/`, `fonts/`, `tokens/`, `components/`, and `nextjs/`. The `concepts/` and `qc/` trees are design history and verification evidence, not production asset sources. Generated reference material under `build/`, `guidelines/`, `specimens/`, and `ui_kits/` may inform implementation but does not override `brand.json`, the token sources, or the approved logo masters.

The website copies selected canonical assets into `site/public/` so the static export is self-contained. Those copies must be reproducible from this directory and are validated against the canon. The integration intentionally uses `next/font/local` with bundled WOFF2 files instead of `brand/nextjs/fonts.ts`, whose Google-font imports conflict with the canon's no-remote-font requirement.

Run `pnpm check:brand` from the repository root to verify manifest checksums, UTF-8 integrity, font licensing, README banner usage, and forbidden production references. The upstream receipt can be reproduced with `python brand/build/verify.py brand` when Python and its declared dependencies are available.

To update the brand, replace the complete governed delivery with a separately approved canon, retain its provenance and verification receipt, refresh the selected `site/public/` copies, and review every production integration in the same change. Do not regenerate or edit individual governed files in place.
