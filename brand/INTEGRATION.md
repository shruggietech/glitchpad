# Repository integration

Glitchpad brand 1.1.0 under ShruggieTech canon 1.2.1 was imported from the successful `verified-brand-kits` artifact produced by upstream commit `1681fcd444ff851d5bffc2cf67e23bbcedd753cd` in Build run `34137139742`. That commit also produced the Pages deployment served at `https://brand.shruggie.tech`.

The published distribution was checked independently before import. All 181 downloadable logo, favicon, icon, and specimen files exposed below `https://brand.shruggie.tech/glitchpad/downloads/files/` matched the upstream build artifact byte-for-byte. The separately generated seven-page PDF had the same size but nondeterministic bytes across the Build and Pages jobs, so `brand/brand-guide.pdf` retains the manifest-bound Build artifact copy.

Files named in `manifest.json` are immutable governed inputs. `INTEGRATION.md` is the sole project-owned file inside this directory and is intentionally excluded from the upstream manifest. Do not regenerate, optimize, recolor, resize, or edit governed files in place.

The public site copies approved fonts, lockups, the social preview, and web icons from this directory. Desktop packages copy the Windows ICO, macOS ICNS, and approved web raster sizes. Android copies the supplied legacy, adaptive, and monochrome resources into both Tauri icon inputs and the generated Android project. Every mapping is enforced by `scripts/check-brand.mjs` as an exact byte comparison.

Run `pnpm check:brand` for manifest, provenance, encoding, licensing, stale-file, README, site, desktop, and Android integration validation. Run the complete `cargo xtask check` gate before describing the update as verified.
