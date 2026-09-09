# Changelog

All notable changes to Glitchpad are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
