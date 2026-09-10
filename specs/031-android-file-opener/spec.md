# Feature Specification: Android File Opener Correction

**Feature Branch**: `codex/031-android-file-opener`

**Created**: 2026-09-09

**Status**: Complete

**Input**: User description: "Correct the v0.1.1 Android regression that prevents Glitchpad from appearing as an opener for released text formats, prove the behavior against final packages, and preserve least-privilege file access."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select Glitchpad from Open with (Priority: P1)

As an Android user, I can select Glitchpad from the system resolver when a provider supplies a released text format with its supported media type.

**Why this priority**: Android packages that cannot enter the system file-opening path do not deliver Glitchpad's primary purpose.

**Independent Test**: Install the final universal package on the minimum and target Android API levels, query the system resolver with opaque `content://` URIs for every governed media type, and confirm Glitchpad's main activity is eligible.

**Acceptance Scenarios**:

1. **Given** an opaque provider URI and a governed media type, **When** Android resolves an `ACTION_VIEW` request, **Then** Glitchpad is an eligible default activity without relying on a filename in the URI.
2. **Given** an unsupported exact image, PDF, DOCX, ODT, generic binary, or `file://` request, **When** Android resolves the request, **Then** Glitchpad does not advertise eligibility.
3. **Given** a caller-supplied `text/*`, `application/*`, or `*/*` request, **When** Android resolves the request, **Then** Glitchpad is eligible through compatible exact declarations without declaring a wildcard itself.
4. **Given** the universal and ARM64 packages, **When** their final manifests are inspected, **Then** they expose the same governed resolver contract.

---

### User Story 2 - Open the selected document (Priority: P1)

As an Android user, selecting Glitchpad opens the requested content on both cold start and warm delivery instead of merely placing the app in the chooser.

**Why this priority**: Resolver visibility without successful document delivery would preserve the underlying product failure.

**Independent Test**: Deliver safe synthetic provider documents through resolved implicit intents, then assert that the requested filename and marker content become visible after cold and warm deliveries.

**Acceptance Scenarios**:

1. **Given** Glitchpad is not running, **When** a resolved supported document is opened with a scoped read grant, **Then** the correct filename and safe marker become visible.
2. **Given** Glitchpad is already running in its single task, **When** a second supported document is opened, **Then** the new document becomes active and its marker is visible without stale content replacing it.
3. **Given** delivery diagnostics are needed, **When** evidence is recorded, **Then** it identifies only package role, API level, provider class, action, categories, scheme, and media type, without document URI, private name, path, or content.

---

### User Story 3 - Handle generic provider types honestly (Priority: P2)

As an Android user, I receive predictable behavior when a provider reports a generic media type, and the release documentation accurately states any unavoidable limitation.

**Why this priority**: Provider interoperability matters, but it cannot justify broad claims that would make Glitchpad an opener for unsupported content.

**Independent Test**: Exercise generic media types with opaque and suffix-bearing provider URIs, verify both remain rejected when Android cannot establish an exact supported media type, and verify the limitation is documented.

**Acceptance Scenarios**:

1. **Given** a generic media type and a suffix-bearing `content://` URI for a supported extension, **When** Android cannot establish an exact supported media type, **Then** Glitchpad does not claim the document.
2. **Given** a generic media type and an opaque URI with no usable suffix, **When** safe resolution cannot distinguish the format, **Then** Glitchpad does not claim the document and the limitation is documented.
3. **Given** any proposed resolver expansion, **When** policy checks run, **Then** wildcard media types, broad storage permissions, unsupported formats, and `file://` handling remain rejected.

### Edge Cases

- A provider URI may contain no filename, a percent-encoded document identifier, or a path unrelated to the display name.
- Providers may report the same supported content as an exact type, `text/plain`, or `application/octet-stream`.
- A caller may request `text/*`, `application/*`, or `*/*`; Android matches those broad requests against compatible exact declarations even though Glitchpad declares no wildcard.
- An implicit intent may include extra categories, omit a persistable grant, or arrive while the existing single task is active.
- Multiple installed activities may resolve the same request; eligibility must not depend on Glitchpad becoming the system default.
- Android API behavior differs around package-manager flags, but the governed result must remain equivalent on API 24 and API 36.
- Final package inspection must detect merged-manifest drift even when the source manifest appears correct.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Glitchpad MUST be an eligible `ACTION_VIEW` target for every released media type delivered through an opaque `content://` URI on Android API 24 and API 36.
- **FR-002**: Exact media-type eligibility MUST NOT depend on a filename, extension, provider authority, or URI path.
- **FR-003**: Resolver declarations MUST separate materially different data-matching jobs so unrelated scheme, type, authority, and path attributes cannot silently combine into a broader or narrower contract.
- **FR-004**: Glitchpad MUST NOT declare unsupported image, PDF, DOCX, ODT, wildcard media type, broad media family, `file://`, directory, or multiple-document handling.
- **FR-005**: Glitchpad MUST NOT request broad or legacy external-storage permission as part of resolver eligibility or delivery.
- **FR-006**: Cold-start and warm `singleTask` delivery MUST acquire the scoped provider URI through the existing native source boundary and display the requested synthetic filename and safe marker.
- **FR-007**: Resolver evidence MUST query the installed package through Android's package manager before attempting delivery; source-manifest inventory alone is insufficient.
- **FR-008**: Final universal and ARM64 APK manifests MUST expose equivalent actions, categories, resolver filter groups, media types, schemes, and least-privilege posture.
- **FR-009**: API 24 and API 36 automated evidence MUST cover exact-type eligibility, caller-supplied wildcard matching, representative negative cases, cold delivery, and warm delivery.
- **FR-010**: Generic media-type behavior MUST be represented by an explicit rejection policy, tested for suffix-bearing and opaque cases, and described in the unreleased v0.1.2 record.
- **FR-011**: Automated policy checks MUST reject resolver filters whose merged semantics declare a forbidden scheme, wildcard or broad media type, unsupported format, missing default category, unmodeled data constraint, or extension rule that Android ignores.
- **FR-012**: Resolver and delivery diagnostics MUST omit provider URI, private filename, path, document contents, and account data.
- **FR-013**: S031 MUST update the v0.1.2 release delta and issue traceability without changing product versions or publishing the release.
- **FR-014**: Manual physical-device and third-party-provider exploration MUST remain post-release validation under issue #66 and MUST NOT block S031 merge or v0.1.2 publication.
- **FR-015**: The frontend MUST drain queued Android deliveries after startup and after every warm `onNewIntent` notification, materialize each accepted source through the bounded Android source reader, and release native source authority when its session closes.

### Key Entities

- **Resolver filter group**: One Android intent-filter job with its action, categories, schemes, authorities, paths, and media types evaluated using merged Android semantics.
- **Resolver probe**: A synthetic implicit request and the installed activities Android reports as eligible.
- **Delivery fixture**: A controlled provider document with a safe media type, display name, marker, and scoped grant.
- **Android package resolver receipt**: Redacted evidence binding package role, API level, resolver matrix, and cold/warm visible outcomes to the tested artifact.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One hundred percent of governed released media types resolve to Glitchpad for opaque `content://` URIs on API 24 and API 36.
- **SC-002**: Zero governed negative cases resolve Glitchpad for unsupported formats, forbidden schemes, generic binary types, directories, or multiple-document requests.
- **SC-003**: Cold and warm delivery tests display the expected synthetic filename and content marker in every governed API-level run.
- **SC-004**: Universal and ARM64 final APK inventories report identical resolver filter groups and zero forbidden permissions or exported components.
- **SC-005**: One hundred percent of generic-type matrix rows produce the documented resolve or reject outcome.
- **SC-006**: Redaction checks find zero provider URIs, private paths, private filenames, or document contents in resolver receipts and failure diagnostics.
- **SC-007**: All required format, lint, unit, instrumentation, documentation, security, platform, and final-package checks pass before pull-request publication.
- **SC-008**: One hundred percent of caller-supplied `text/*`, `application/*`, and `*/*` probes produce Android's documented match against Glitchpad's compatible exact declarations, while package inspection confirms zero wildcard declarations.

## Assumptions

- Released Android formats and exact media types are governed by `packaging/android/intent-map.json` and remain limited to Markdown, Mermaid, plain text, and supported source formats.
- Exact supported media types are the authoritative interoperability path for opaque provider URIs.
- A generic provider type cannot safely support an opaque URI when neither its type nor URI identifies a supported format; this limitation is documented instead of introducing broad claims.
- Synthetic providers and documents are sufficient merge evidence. Private user files and manual physical-device validation are excluded by the project's standing release policy and remain tracked under #66.
- S031 corrects issue #159 only. Release publication and closure of the v0.1.2 epic remain a subsequent slice.
