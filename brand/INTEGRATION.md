# Repository integration

Glitchpad brand 1.1.0 under ShruggieTech canon 1.2.1 was imported from the successful `verified-brand-kits` artifact produced by upstream commit `737cc1e88f3ddf50950a50897f68cdd131bf0167` in Build run `34314125097` (artifact `10089799642`). That commit also produced the Pages deployment served at `https://brand.shruggie.tech`.

The artifact was retrieved on 2026-09-09. Its upstream manifest SHA-256 is `071deeb7e8983e8695e0f8d1f84beb11fed9749f02eab3959141309a92c47f33`; the integrated manifest SHA-256 is `c11a9a324d56666e6eb361b3b1f84bbd9db61cdd514ff3d48ed4ea123c6d279d` after the deterministic legal-link correction described below. All 253 governed files were verified against the upstream manifest before import. Publicly exposed derivative manifests and the repaired lockup were independently compared with the live download surface; their digests are recorded in `INTEGRATION.json`.

One deterministic integration correction intentionally differs from the artifact bytes: `brand/README.md` replaces the artifact-layout-relative `../../LICENSE-BRAND.md` target with the immutable upstream URL at the pinned commit so the legal terms remain reachable from this repository. `brand/manifest.json` governs the corrected file bytes. This correction is performed only by `scripts/sync-brand-kit.mjs`, never by hand.

Files named in `manifest.json` are immutable governed inputs. `INTEGRATION.md` and `INTEGRATION.json` are the only project-owned files inside this directory and are intentionally excluded from the upstream manifest. Do not regenerate, optimize, recolor, resize, or edit governed files in place.

The public site copies approved fonts, lockups, the social preview, and web icons from this directory. Desktop packages copy the Windows ICO, macOS ICNS, and approved web raster sizes. Android copies the supplied legacy, adaptive, and monochrome resources into both Tauri icon inputs and the generated Android project. Every mapping is enforced by `scripts/check-brand.mjs` as an exact byte comparison.

Run `pnpm check:brand` for manifest, provenance, receipt, encoding, licensing, stale-file, README, site, desktop, and Android integration validation. Run `pnpm check:brand:freshness` only when network access is intentionally available to compare the recorded public derivatives with `brand.shruggie.tech`. Run the complete `cargo xtask check` gate before describing the update as verified.
