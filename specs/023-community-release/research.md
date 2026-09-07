# Research: v0.1.0 Community Release

## Community desktop trust

**Decision**: Publish Windows artifacts as explicitly unsigned community builds and macOS as an ad-hoc-signed application inside a non-notarized DMG. Document expected operating-system warnings and ordinary per-application approval flows.

**Rationale**: Neither platform technically requires paid identity for direct distribution. Truthful metadata, checksums, SBOMs, provenance, and repository attestations avoid false endorsement claims.

**Alternatives considered**: Paid Authenticode and Apple Developer ID/notarization were rejected by the owner. Self-signed desktop certificates do not establish useful public trust.

## Android update authority

**Decision**: Require one stable project-owned Android keystore for official APK/AAB artifacts, supplied only as encrypted GitHub secrets; pull requests retain disposable blocked-candidate keys.

**Rationale**: Android requires signatures and key continuity for upgrades. A project-owned key is free and is a technical identity requirement rather than a commercial trust program.

## Publication topology

**Decision**: Use one release workflow to gate platform jobs, gather their governed outputs, and publish only from the exact tag. Manual dispatch validates readiness but cannot publish.

**Rationale**: One orchestrator prevents partial publication while platform-native runners preserve package fidelity.

## Validation timing

**Decision**: Automated source, policy, unit, package-contract, version, and workflow checks block release. Manual accessibility, device, and real-world validation in issue #66 begins after v0.1.0.

**Rationale**: This matches the owner’s release-first decision without representing unperformed checks as evidence.
