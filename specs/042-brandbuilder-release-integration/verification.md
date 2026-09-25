# S042 Verification Record

## Scope and tracking

- Slice: S042, BrandBuilder Release Integration.
- Issues: #202 (release import), #203 (platform consumers), #204 (enforcement and documentation).
- Source: `shruggietech/shruggie-brand` formal release `v2.0.3`, package `glitchpad-brand-1.1.1-bb2.0.3`.
- Prior work: #156 established exact-kit integration; #196 adopted the generated AppFrame shell. Both are closed historical work, not reopened by S042.

## Source audit, 2026-09-24

The downloaded archive SHA-256 is `4cedc498d58fe6a8e7573b4c18ca97b95e27bf96c4e0eeb88712dff6545543f3`, matching the formal release `SHA256SUMS`. The untouched archive `manifest.json` SHA-256 is `e32b6211e698a4ca47c8c547a5d64975e22bb623c62e8b31fcc494a7df086910`. A Python read-only audit checked every ZIP path for duplicates, traversal, absolute paths, and symlinks, then checked the 321 governed entries' byte lengths and SHA-256 values. All checks passed.

The ZIP has 321 manifest-governed files, `manifest.json`, and three legal files outside that manifest. Those legal files are `LICENSE` (`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`), `LICENSE-BRAND.md` (`bd1107a804108bbe02955ca64000945322a6fc2456b45b795dac11a253c0023a`), and `NOTICE` (`d919688fd2c931500447418b628dfd0acf4d82c88d7eb392692bb629f7d0193f`). The release archive checksum authenticates their original bytes; the integration receipt binds them individually after import.

Against the current governed `brand/` manifest, 268 released files are byte-identical, 44 differ, nine are new, and the old BrandBuilder 1.3.0 recovery file is removed. The release adds the package bundle, migration and release-impact guidance, BrandBuilder 2.0.3 recovery bundle, and separate web maskable icons. It updates Android mipmaps and color resources and the vendored egui adapter. Existing Windows icon binaries and Web/React adapter files did not appear in the changed-file list. The release impact contract declares no identity redesign.

## Spec Kit analyze gate, 2026-09-24

The S042 spec, plan, data model, delivery contract, and tasks were compared against Constitution P1-P8 and issues #202-#204 before implementation. All eight functional requirements have task coverage: FR-001/002/003 map to T001/T004-T007/T012, FR-004 to T008-T010, FR-005 to T009-T011, FR-006 to T004/T008/T012/T014, FR-007 to T002/T013-T016, and FR-008 to T011/T014. The five success criteria have corresponding source, copy, role, validation, and issue/PR evidence tasks. No critical, high, or unresolved clarification findings remain. The discovered legal-file exception was incorporated into the spec and contract before this pass.

## Validation environment

The approved Docker daemon was unavailable at planning time. Hidden WSL had networking and Python for archive inspection and staged file import, but lacked Node and Rust. The bundled BrandBuilder `verify.py` also needs `coloraide`, which was absent from this WSL environment. The approved repository build and Node tests cannot run locally through that incomplete fallback. CI now installs the release-pinned `coloraide==8.12.1` in its Linux runner and runs both bundled recovery verifiers after `pnpm check:brand`; CI exit results will be recorded here before merge readiness is claimed.

## Import and focused checks, 2026-09-24

The staged import independently rechecked the formal archive SHA-256, `SHA256SUMS` line, source manifest SHA-256, every governed file's bytes and digest, the complete extracted inventory, and the three legal file digests before replacing `brand/`. It copied 51 mapped production assets, including both public maskable icons and ten Android resources to each package source tree. The corrected integrated manifest SHA-256 is `a6688b0d8a81aaa2e7d6a168fd5f09e8c60d24c089aa2a0ce7ee6eeb7302c217`; `brand/INTEGRATION.json` records both source and integrated digests. A second read-only Python pass confirmed all 321 integrated manifest entries, the three legal files, all 51 copy pairs, the exact `brand/` inventory, and the recovery archive checksum. The bundled `validate_glyph.py brand.json` returned exit 0 with four checks, four documented imported-geometry warnings, and zero failures. The bundled `verify.py .` could not start because `coloraide` was missing locally; no pass is claimed for that check pending CI.

The existing AppFrame Web/React adapter files were byte-identical in the release comparison, so the React shell call site remains unchanged. The released egui adapter is carried as a complete governed source but has no Glitchpad application call site. Windows and macOS package icon binaries remained byte-identical, while the mapped Android mipmaps and colors changed; Linux continues using the mapped Tauri icon source. The public site now serves four manifest-declared icon roles, with exact copies in `site/public/`. No installed application or browser behavior was field-tested locally.

`git diff --check` returned exit 0. A UTF-8/BOM/mojibake scan of the imported kit and S042 spec returned no suspects. The 512 px public maskable icon was visually inspected against its declared role. Node brand/site checks, Rust checks, packaged-host checks, the complete upstream verifier, and aggregate CI remain unverified until their GitHub jobs finish.

## PR validation follow-up, 2026-09-24

The first PR docs job passed all 30 Node brand tests and `scripts/check-brand.mjs`. The separate public-site build and test job passed. The new bundled `verify.py` step failed during icon-suite inspection because Pillow was absent from the Linux runner (`ModuleNotFoundError: No module named 'PIL'`). The CI step is being updated to install the upstream release's pinned `coloraide`, Pillow, FontTools, Brotli, and pikepdf versions before rerunning the bundled checks. That initial job is a failure, and the full verifier remains unverified until its rerun completes.

The second docs job again passed the 30 Node brand tests and deterministic kit check. The bundled verifier completed 31 checks and reported three failures: two SVG comparisons could not start because `svgelements` was absent, and its prose audit scanned the verifier's own extracted `SKILL.md` when recovery was placed beneath the kit under test. CI is adding the upstream-pinned `svgelements==1.9.6` and running the checksum-verified recovery from a separate temporary directory against an unchanged copy of `brand/`. This preserves the exact delivered source and excludes the verifier's own prose from consumer-kit auditing. The full zero-failure result remains pending the next CI run.

The first Codex review on `a8f6958` identified the missing Pillow dependency. Commit `88bb535` fixed it, the finding received a reply, and its thread was resolved. One additional review was requested after that closure; the second review on `88bb535` completed with no findings. No further Codex review will be requested for S042.

The third docs job ran 31 upstream checks with zero skips; 29 passed. `logo-provenance` and `specimen-mark-visible` could not render their SVG masters because the recovery bundle's Node rasterizer requires an undeclared `@resvg/resvg-js` module in that isolated directory. CI will install the upstream-supported native `rsvg-convert` executable (`librsvg2-bin`) so the verifier uses its first-choice renderer. No released asset mismatch was reported by the checks that completed; a zero-failure full verifier result is still pending.
