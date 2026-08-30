<!--
SYNC IMPACT REPORT
Version change: 1.0.0 -> 1.1.0
Modified principles: none
Added principles:
  - P8. Apache-2.0 and license compatibility
Modified sections:
  - Technical and Documentation Constraints: Mermaid diagrams now require top-to-bottom layout
Added sections: none
Removed sections: none
Follow-up TODOs: none
-->

# Glitchpad Constitution

This file is the single source of project law. It contains durable invariants only. Product behavior and architecture belong in `docs/glitchpad-technical-specification.md`; individual changes belong in Spec Kit feature artifacts under `specs/`.

## Core Principles

### P1. The file owns the viewport

Glitchpad exists so a user can interact with a file, not with Glitchpad. The primary document surface MUST receive the overwhelming majority of the available viewport. Permanent navigation, dashboards, workspaces, promotional surfaces, oversized toolbars, and controls without frequent file-oriented value are prohibited. Tabs and the metadata inspector are permitted because they reduce operating-system detours while remaining compact and dismissible.

### P2. Local files remain local

Core viewing, editing, inspection, detection, and metadata extraction MUST work without an account, network connection, remote service, or telemetry dependency. Glitchpad MUST NOT upload file contents or embedded metadata unless a future specification explicitly adds an opt-in feature whose data flow, threat model, retention, and user consent are separately approved. The online viewer concept is outside the current product boundary.

### P3. Cross-platform behavior is foundational

Windows, macOS, Linux, and Android are product targets from the foundation rather than ports attempted after desktop completion. Shared document and renderer behavior MUST have one platform-independent contract. Native host adapters MAY differ where operating systems require different file, URI, lifecycle, or packaging semantics. Android document URIs MUST be modeled directly and MUST NOT be disguised as desktop filesystem paths. Electron is prohibited.

### P4. Untrusted input fails safely

Every opened file is untrusted input. Format detection MUST verify content rather than trust extensions alone. Parsers and renderers MUST enforce resource limits, sanitize active content, deny undeclared native capabilities, and surface unsupported or malformed input without corrupting user data or crashing the application. Save operations MUST preserve the source encoding and line-ending contract unless the user explicitly changes it, and writable desktop files MUST use an atomic replacement strategy where the platform supports one.

### P5. Specifications and releases move together

`docs/glitchpad-technical-specification.md` is the architecture and behavior of record for the latest official Glitchpad release. Its version MUST equal the official product version. Unreleased changes are specified through Spec Kit feature artifacts and are reconciled into the technical specification during a mandatory release documentation pass. A release MUST fail when the product manifests, technical specification, changelog, release metadata, or supported-format declarations disagree about the release version or shipped behavior.

### P6. Verification precedes claims

Every acceptance criterion MUST map to an automated test or an explicit documented manual check. Required format, lint, test, documentation, security, platform, and packaging gates MUST complete successfully before a release or merge is described as verified. Foreground verification commands MUST be watched through completion and evaluated by their real exit status; an unfinished or backgrounded run is not evidence.

### P7. Decisions are explicit and proportional

Architecture-affecting decisions, deviations from prior behavior, and accepted platform or format limitations MUST be dated and recorded in the relevant Spec Kit feature or decision record before implementation. Improvements MUST remain proportional to the active feature scope. Glitchpad MUST NOT acquire generalized IDE, workspace, cloud, collaboration, or plugin platform complexity without a separately approved specification that demonstrates direct file-interaction value.

### P8. Apache-2.0 and license compatibility

Glitchpad source code and original distributable project assets MUST be released under the Apache License 2.0. Every distributed dependency, bundled resource, font, fixture, and generated artifact MUST have documented provenance and terms compatible with Apache-2.0 distribution. Required notices and attribution MUST ship with every applicable artifact. A dependency with missing, ambiguous, source-available, non-commercial, network-copyleft, or strong-copyleft terms is prohibited unless a separately approved Spec Kit decision documents the legal obligations, distribution impact, and replacement analysis before adoption.

## Technical and Documentation Constraints

- The desktop and Android application family MUST use Tauri and MUST NOT use Electron.
- TypeScript owns the shared interface and renderer layer. Rust owns the desktop host and privileged native boundary. Kotlin MAY implement the narrow Android document and lifecycle bridge required by Android platform APIs.
- Source and documentation files MUST use UTF-8 without a byte-order mark. Deliverables MUST be checked for encoding corruption before release.
- Architecture, lifecycle, state, and release diagrams MUST use Mermaid when a diagram adds material clarity. Mermaid flow diagrams MUST use top-to-bottom layout (`TB`), including explicit `direction TB` declarations in subgraphs. Left-to-right, right-to-left, and bottom-to-top directions are prohibited unless the product owner explicitly requires one for a specific diagram. ASCII architecture diagrams are prohibited in normative documentation.
- A complete brand kit is a required product deliverable and MUST include platform-specific application and store assets, accessible color guidance, typography, logo usage, and reproducible source assets.
- Required tool versions MUST be pinned in machine-readable repository files. Contributor documentation MUST reference those authorities instead of maintaining independent version numbers that can silently drift.

## Development Workflow

Every feature, architecture amendment, renderer addition, platform capability, and release preparation change MUST use the repository-installed Spec Kit workflow. Work begins with a feature specification under `specs/`, proceeds through clarification and planning as needed, and MUST pass cross-artifact analysis before implementation is considered complete.

The contributor and release workflows MUST include a documentation-impact decision. Changes that affect shipped behavior, supported formats, platform behavior, security boundaries, developer prerequisites, packaging, or user-visible metadata MUST update the corresponding documentation in the same change or be recorded as an unreleased specification delta for the mandatory release documentation pass.

No release may bypass the documentation pass, version-consistency gate, Mermaid validation, link validation, encoding check, or platform artifact checks defined by the technical specification.

## Governance

This constitution supersedes conflicting project practices. Amendments MUST be made through the Spec Kit constitution workflow, include a sync impact report, and follow semantic versioning independently of the Glitchpad product version. A MAJOR constitution change removes or incompatibly redefines a principle, a MINOR change adds or materially expands governance, and a PATCH change clarifies existing law without changing its meaning.

Every Spec Kit plan and analysis pass MUST evaluate constitution compliance. A temporary exception requires an explicit scope, rationale, owner, and expiry condition in the governing feature specification. Convenience, schedule pressure, or an already-written implementation is not sufficient justification for an exception.

**Version**: 1.1.0 | **Ratified**: 2026-08-30 | **Last Amended**: 2026-08-30
