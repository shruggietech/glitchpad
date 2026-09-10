# Dependency Security Contract

## Safe resolution contract

The committed manifests and lockfile MUST resolve Next.js to 16.3.3 or later within the 16.3 patch line and smol-toml to 1.7.1 or later within the 1.7 patch line. A high-or-critical package audit MUST exit successfully.

## Release preservation contract

The implementation MUST NOT change any v0.1.2 version authority, release-package inventory, release notes, tag, or published release. S033 is a security readiness slice, not a release publication event.

## Evidence contract

Before push, a frozen dependency installation, focused site and release checks, and the complete repository validation gate MUST pass in the approved hidden container environment. The pull request MUST trace issue #167 and identify every addressed advisory.
