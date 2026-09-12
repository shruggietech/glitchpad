# Practical-Use Evidence Contract

## Purpose

This contract defines the minimum exact-package evidence required to represent v0.1.3 as a working corrective release.

## Common Package Contract

Every receipt must identify the exact artifact name, final-byte SHA-256 digest, v0.1.3 product version, reviewed source revision, clean or restored state, platform delivery path, bounded synthetic fixture class, expected visible markers, termination result, cleanup result, and overall pass/fail outcome.

Receipts must not contain document bodies, private filenames, native paths, link destinations, embedded metadata, access tokens, signing secrets, or user-specific application data.

## Windows Contract

Both the NSIS installer and portable ZIP must be tested as exact final artifacts. Evidence must cover clean launch; in-application Open; file association; command-line delivery; delivery to an already-running process; minimal and representative Markdown rendering; source editing and safe save; return to preview; one deterministic contained failure followed by source and successful retry; reserved shell/menu geometry at 100, 125, 150, and 200 percent governed scales; clean shutdown; uninstall or unpack cleanup; and absence of orphaned processes.

## macOS Contract

The universal DMG must be mounted and its ad-hoc-signed, non-notarized trust state verified. Required evidence covers application discovery, launch, representative Markdown delivery and visible content on each governed architecture, reserved shell geometry, clean termination, mount cleanup, and truthful Gatekeeper guidance.

## Linux Contract

The AppImage and Debian package must each pass inventory and trust checks. Required evidence covers launch, representative Markdown delivery and visible content in governed clean environments, desktop integration where applicable, reserved shell geometry, clean termination, package cleanup, and absence of leaked processes or mounts.

## Android Contract

The universal APK, ARM64 APK, and AAB must retain exact media declarations and stable signing identity. Installed-package evidence on governed API levels must cover resolver discovery, permission-scoped content-provider access, cold delivery, warm delivery, visible supported content, rejection of unsupported ambiguity, session cleanup, and release of native authority.

## Release Reconciliation Contract

Publication must fail when a required artifact lacks its practical-use receipt, when a receipt points to different bytes or source, when a required scenario is absent or failed, when a trust state is misstated, or when evidence contains a prohibited privacy field. The release asset inventory must contain every governed package and required evidence bundle exactly once.
