# Verification: v0.1.1 Corrective Release

## Active and historical version inventory

The active product, package, workflow, technical-specification, public-site, and release-policy authorities move to 0.1.1. Immutable `docs/releases/v0.1.0*` records and completed Spec Kit artifacts remain at their historical versions. Test fixtures may retain older versions only when they intentionally exercise generic parsing, migration, rejection, or historical behavior and do not act as current release authorities.

## Advisory disposition evidence

- GitHub alert: #1, GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429.
- Locked package: `glib` 0.18.5, compiled only in the Linux target graph.
- Inverse path: Tauri 2.11.5 through Wry 0.55.1, WebKitGTK 2.0.2, and GTK 0.18.2.
- Direct affected API use: repository search contains no `VariantStrIter` reference outside advisory documentation.
- Compatibility: patched `glib` 0.20 cannot replace 0.18 independently while the current Tauri/Wry GTK family remains on GTK bindings 0.18.
- Existing authority: the merged S024 exception is owned by the maintainers and expires at the first compatible Tauri GTK transition or the v0.2 dependency pass, whichever occurs first.
- GitHub disposition: Dependabot alert #1 was dismissed as `tolerable_risk` by `h8rt3rmin8r` at `2026-09-09T02:39:54Z` with the comment, "S024 accepted this Linux-only transitive glib 0.18 advisory: no direct VariantStrIter use, and Tauri/Wry currently requires GTK 0.18 bindings. Reassess at the first compatible Tauri GTK transition or the v0.2 dependency pass, whichever occurs first."

## Validation results

- Red phase: the focused release and Android identity suite produced four expected failures against the v0.1.0 authorities, with 23 tests passing.
- Green focused release phase: 31 of 31 release, assembly, promotion, and Android identity tests passed after implementation.
- Package policy: Windows 10 of 10, macOS 18 of 18, Linux 21 of 21, and Android 14 of 14 focused tests passed with their repository contract validators.
- Documentation and public site: formatting passed, 300 Markdown files passed link validation, 277 files passed Markdown lint, 44 Mermaid diagrams rendered, seven site unit tests passed, and 29 browser tests passed.
- Performance and provenance: all 20 focused tests passed after the v0.1.1 performance fixture digests were reconciled.
- Full repository gate: `cargo xtask check` passed uninterrupted in the rebuilt `glitchpad-validation:local` image created from `scripts/docker/validation.Dockerfile`. The run included all Rust workspace tests, cargo-deny, 43 frontend files with 242 tests, production builds, documentation, package, security, accessibility, performance, and public-surface checks. One packaged-reference memory test remained intentionally ignored because it requires a release executable and reference-profile host, as declared by the test itself.
- Encoding: 836 text files passed strict UTF-8 without BOM and common-mojibake checks.
- Publication guard: no local v0.1.1 tag or GitHub v0.1.1 release existed during pull-request preparation, and no tag or release was created by S028.
