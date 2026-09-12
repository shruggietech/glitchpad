# Changelog

All notable changes to Glitchpad are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-09-11

### Changed

- Published the technical specification as navigable section pages while preserving one normative source and validating every generated section against it.
- Automated post-merge documentation publication and merged-branch cleanup with explicit concurrency, provenance, and failure-reporting controls.
- Bound desktop practical-use receipts to the exact final package manifests, including packaged Markdown failure recovery and separate 100, 125, 150, and 200 percent shell-geometry results, and required content-free evidence before release assembly.

### Fixed

- S035 (#171) restored Markdown recovery for every file-opening path, including native association delivery, and prevented stale or failed render work from blanking the document.
- S035 (#172) reserved shell chrome so the compact application menu and document controls no longer overlap scrollable content.

## [0.1.2] - 2026-09-09

### Changed

- Corrected repository and website branding, ownership attribution, release claims, calls to action, navigation, and specification document control.
- Kept the application menu fixed outside document layout and removed the redundant README platforms badge.
- Expanded Android package declarations and delivery handling for released exact media types supplied through scoped content-provider URIs.

### Fixed

- Kept Markdown documents usable when rendering fails and prevented stale, superseded, or pending previews from exposing source or replacing current content.
- Restored Android resolver eligibility plus cold-start and warm-intent delivery for supported provider-backed files on API 24 and API 36.
- S033 (#167) patched Next.js 16.3.3 and the development-only transitive `smol-toml` 1.7.1 resolution to clear known pre-release dependency advisories.

## [0.1.1] - 2026-09-08

### Changed

- Reworked the production shell around a content-first layout with a compact application menu, capability-backed commands, coherent secondary panels, and styled editor search controls.
- Limited tabs to multi-document sessions and added a close control to every visible tab.

### Fixed

- Removed synthetic first-run documents so a normal launch starts empty and opening a TXT or Markdown file displays the requested content immediately.
- Strengthened packaged Windows smoke coverage for launch, native file-open delivery, and visible document content.
- Kept delivery errors visible beneath the tab strip instead of allowing them to obscure the active document.

## [0.1.0] - 2026-09-07

### Added

- Added capability-scoped desktop file acquisition, bounded reading and streaming, native change observation, authoritative revalidation, conflict-safe durable replacement, and explicit external-link authorization for Windows, macOS, and Linux.
- Added the versioned document contract foundation, bounded text-format detection, in-memory document sessions, compact accessible tabs, deterministic overflow, and renderer-driven document commands.
- Established the v0.0.0 technical specification, Spec Kit workflow, repository foundation, shared application shell, native host boundary, Android scaffold, contributor tooling, and public project documentation.

### Changed

- Defined unsigned Windows and ad-hoc, non-notarized macOS community distribution, repository-attested Linux packages, and stable project-key Android packages without paid trust programs.

### Fixed

- Replaced focus-stealing Windows validation launchers with bounded hidden container execution and corrected public brand presentation.

Release changes are authored as fragments under `changelog.d` and reconciled into this file during each mandatory release documentation pass.
