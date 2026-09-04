# Feature Specification: Enforce Performance Budgets

**Feature Branch**: `codex/018-performance-budgets`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "S018 implements issue #60 by turning the v0.1.0 startup, interaction, memory, cancellation, large-file, and package-size budgets into repeatable release evidence and blocking regressions."

## User Scenarios & Testing

### User Story 1 - Open and edit without disruptive delay (Priority: P1)

A user launches Glitchpad, opens representative text, Markdown, or Mermaid content, and edits text without repeated stalls that interrupt typing or navigation.

**Why this priority**: The stable text core is not usable if its primary launch, open, render, and editing paths exceed the declared hard limits.

**Independent Test**: Run the governed representative fixtures on each applicable reference profile and verify shell readiness, first-content, current-preview, and input-to-paint samples receive deterministic pass, warning, or failure classifications.

**Acceptance Scenarios**:

1. **Given** a release build and a cold application state, **When** Glitchpad launches on a desktop or Android reference profile, **Then** the first interactive shell is classified against the platform-specific target, warning, and hard limit.
2. **Given** representative 1 MiB text, Markdown, and Mermaid sources, **When** each source reaches its first usable content, **Then** the measurement records fixture identity, environment, samples, median, p95, and classification against the applicable budget.
3. **Given** a normal text edit or Mermaid edit, **When** the current result is painted or rendered, **Then** repeated stalls, stale commits, and results beyond the hard limit fail the applicable gate.

---

### User Story 2 - Cancel or degrade expensive work safely (Priority: P1)

A user can replace, hide, close, or cancel expensive work and continue using the application without stale output, unbounded processing, or a frozen interface.

**Why this priority**: Bounded cancellation and exact large-source modes are security and responsiveness boundaries for untrusted local files.

**Independent Test**: Exercise syntax, Markdown, Mermaid, checksum, search, and large-source work with supersession and cancellation, then open sources immediately around every text, Markdown, and Mermaid boundary and verify the exact mode and bounded behavior.

**Acceptance Scenarios**:

1. **Given** eligible background work, **When** cancellation is requested, **Then** the operation acknowledges cancellation within the declared hard limit and publishes no later result.
2. **Given** a source exactly at or immediately across a renderer boundary, **When** it opens, **Then** Glitchpad selects the documented full, degraded, or refusal mode without an unbounded allocation.
3. **Given** an interaction that performs repeated work, **When** the workload exceeds one event-loop slice, **Then** work is chunked or moved off the interaction path and the interface remains operable.

---

### User Story 3 - Keep inactive documents lightweight (Priority: P1)

A user can keep several documents open while background tabs release regenerable resources and preserve only the authoritative state required to resume safely.

**Why this priority**: Multi-tab use must not retain workers, rendered surfaces, object URLs, observers, subscriptions, or timers that are no longer serving visible content.

**Independent Test**: Repeatedly activate, suspend, resume, close, and reopen representative sessions while observing owned resources and retained memory, then verify idempotent disposal and the suspended-tab hard limit.

**Acceptance Scenarios**:

1. **Given** an active document with renderer-owned resources, **When** its tab becomes suspended, **Then** regenerable resources are released while source revision, dirty state, selection intent, and recovery coverage remain intact.
2. **Given** a suspended text tab, **When** retained overhead is measured, **Then** it remains at or below the source-relative hard limit.
3. **Given** repeated suspend, resume, and close actions, **When** disposal runs more than once or after partial failure, **Then** it remains harmless and no resource count grows across cycles.

---

### User Story 4 - Trust release performance evidence (Priority: P2)

A maintainer can run one documented performance workflow, inspect comparable evidence, and know that missing, invalid, or hard-limit results prevent a release claim.

**Why this priority**: Timing claims from unidentified fixtures or uncontrolled environments are not reproducible evidence and cannot safely govern a release.

**Independent Test**: Generate, validate, alter, omit, and combine evidence records, then verify schema, provenance, profile applicability, classification, warning history, and aggregate gate behavior.

**Acceptance Scenarios**:

1. **Given** a completed measurement run, **When** evidence is written, **Then** it records the budget and fixture versions, fixture digest, build profile, hardware class, operating system, runtime version, cold or warm state, sample count, samples or bounded summary, median, p95, peak memory where applicable, and classification.
2. **Given** missing, stale, malformed, non-finite, misclassified, or hard-limit evidence, **When** the release-performance gate runs, **Then** it fails with a stable diagnostic that contains no document content or native path.
3. **Given** two consecutive comparable warning results for an activation-required metric, **When** the history is evaluated, **Then** the gate requires an explicit performance follow-up before release activation.
4. **Given** a platform package artifact, **When** its compressed size is measured, **Then** it is classified against the matching desktop or Android package budget; absence before the packaging slices is reported as not applicable rather than fabricated evidence.

### Edge Cases

- Timer resolution is unavailable, non-monotonic, non-finite, or too coarse for the metric.
- A run is interrupted before its required sample count or resource cleanup completes.
- A fixture digest, budget version, runtime version, or build profile differs from the comparison baseline.
- An operation completes concurrently with cancellation, suspension, or document revision change.
- A provider reports an unknown or changing source size while a boundary decision is in progress.
- A measurement host is not an approved reference profile or is under abnormal load.
- A metric is inapplicable because its platform artifact or renderer is not active in the current release stage.
- Peak memory cannot be collected through a trustworthy platform interface.
- A warning result follows a passing result, or warning history contains a missing or incomparable run.

## Requirements

### Functional Requirements

- **FR-001**: Glitchpad MUST maintain one versioned catalog for every v0.1.0 performance metric, including its unit, applicable platform and workload, target, warning rule, hard limit, required sample count, and release-gate policy.
- **FR-002**: The catalog MUST cover desktop and Android cold shell readiness; representative 1 MiB text, Markdown, and Mermaid first content; normal Mermaid edit to current preview; editor input to paint; cancellation acknowledgement; desktop and Android idle memory; suspended text-tab overhead; desktop installer and universal Android package size; and renderer resource disposal.
- **FR-003**: Every measured workload MUST use a repository-governed fixture or deterministic scenario with a stable identifier, digest where bytes are involved, provenance, workload description, and explicit applicability.
- **FR-004**: A measurement run MUST record the catalog version, metric identifier, fixture identity, release-build identity, reference-profile identity, operating system, runtime or WebView version, cold or warm state, sample count, monotonic samples or bounded summary, median, p95 where applicable, peak memory where applicable, timestamp, and classification.
- **FR-005**: Classification MUST be deterministic: values at or within the target pass, values beyond the target through the hard limit warn, and values beyond the hard limit fail; invariant failures such as a stale Mermaid commit or repeated editor stalls above 100 milliseconds MUST fail regardless of aggregate percentile.
- **FR-006**: Invalid, missing, stale, non-finite, negative, misclassified, or inapplicable evidence MUST be distinguished explicitly and MUST NOT be accepted as a passing result.
- **FR-007**: Comparable evidence MUST require the same metric version, fixture digest, build profile, platform profile, cold or warm state, and measurement method; incomparable runs MUST NOT form a regression history.
- **FR-008**: Two consecutive comparable warning results for a required metric MUST produce a stable follow-up requirement, while any hard-limit result MUST fail the aggregate performance gate immediately.
- **FR-009**: The release-performance gate MUST fail when an activation-required metric lacks valid evidence and MUST feed a failing result into the aggregate release gate.
- **FR-010**: Ordinary pull-request validation MUST execute deterministic policy, boundary, cancellation, disposal, and evidence-validation checks, plus stable representative timing checks that are safe on hosted runners; hardware-sensitive release claims MUST remain tied to declared reference profiles.
- **FR-011**: Text, Markdown, Mermaid, checksum, search, and large-source operations MUST accept cancellation or supersession and stop producing new work within 250 milliseconds, with a 100 millisecond p95 target where timing evidence applies.
- **FR-012**: Work that may exceed one interaction slice MUST be chunked, cooperatively scheduled, or executed outside the interaction path; repeated interaction tasks MUST remain at or below 50 milliseconds and editor input-to-paint MUST fail on repeated stalls above 100 milliseconds.
- **FR-013**: Text sources through 32 MiB MUST retain full editing subject to line limits, sources above 32 MiB through 256 MiB MUST use bounded source-backed read-only mode, and sources above 256 MiB MUST be refused before unbounded decoding or interface publication.
- **FR-014**: Markdown and Mermaid workloads MUST preserve their existing exact full, degraded, and refusal thresholds, and crossing a rendering threshold MUST leave eligible source operations available.
- **FR-015**: Suspending or closing a renderer MUST idempotently release its workers, decoded or rendered surfaces, object URLs, observers, subscriptions, timers, pending callbacks, and native stream leases while preserving authoritative session and recovery state.
- **FR-016**: A suspended text tab MUST remain within the target of source bytes multiplied by 2.5 plus 10 MiB and MUST fail above source bytes multiplied by 4 plus 20 MiB on an applicable reference profile.
- **FR-017**: Idle working-set and proportional-set measurements MUST classify desktop against 160 MiB target and 250 MiB hard limit, and Android against 180 MiB target and 256 MiB hard limit.
- **FR-018**: Compressed desktop installers MUST classify against a 35 MiB target and 60 MiB hard limit; universal Android packages MUST classify against a 40 MiB target and 65 MiB hard limit; measurement MUST operate only on actual package artifacts.
- **FR-019**: Evidence, logs, and diagnostics MUST be bounded and MUST NOT retain document content, filenames, native paths, provider identifiers, environment secrets, or telemetry.
- **FR-020**: The performance workflow MUST run locally without an account or network dependency after repository dependencies and governed browser or platform prerequisites are installed.
- **FR-021**: Every metric MUST map to an automated check or an explicit documented reference-profile receipt, and the documentation-impact decision MUST identify which results are release-blocking now versus activated by later packaging slices.

### Key Entities

- **Performance Budget**: A versioned metric definition containing thresholds, applicability, sample policy, and release behavior.
- **Reference Profile**: A named, bounded environment on which hardware-sensitive results are comparable.
- **Performance Fixture**: Governed input bytes or a deterministic interaction scenario with identity and provenance.
- **Measurement Run**: One bounded execution for a metric and profile, including observations and cleanup status.
- **Evidence Record**: A portable, content-free result derived from one measurement run.
- **Evidence History**: Comparable recent results used only to detect consecutive warnings.
- **Resource Ledger**: Counts and bounded size estimates for resources owned by a renderer or session across active, suspended, resumed, and disposed states.
- **Performance Gate Result**: The deterministic aggregate of applicable evidence, policy validation, warnings, failures, and follow-up requirements.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Cold shell readiness reaches p95 at or below 1.5 seconds on the desktop reference profile and 2.5 seconds on the Android reference profile, with hard failures above 2.5 and 4.0 seconds respectively.
- **SC-002**: Representative 1 MiB UTF-8 text reaches first content within 300 milliseconds p95, Markdown within 800 milliseconds p95, and Mermaid within 1.5 seconds desktop or 2.5 seconds Android p95; their hard limits are 750 milliseconds, 1.5 seconds, 2.5 seconds, and 4.0 seconds respectively.
- **SC-003**: Normal Mermaid edits reach the current preview within 1 second p95, no stale result commits, and no repeated result exceeds 2 seconds.
- **SC-004**: Editor input reaches paint within 50 milliseconds p95 with no repeated stall above 100 milliseconds, and repeated interaction tasks do not exceed 50 milliseconds.
- **SC-005**: Cancellation acknowledgement reaches 100 milliseconds p95 and no eligible operation produces new work more than 250 milliseconds after cancellation.
- **SC-006**: Idle desktop working set is at most 160 MiB with a 250 MiB hard limit; idle Android proportional set is at most 180 MiB with a 256 MiB hard limit.
- **SC-007**: Suspended text-tab overhead is at most source bytes multiplied by 2.5 plus 10 MiB and never exceeds source bytes multiplied by 4 plus 20 MiB.
- **SC-008**: Desktop compressed installers remain at or below 35 MiB with a 60 MiB hard limit, and universal Android packages remain at or below 40 MiB with a 65 MiB hard limit, once those artifacts exist.
- **SC-009**: Exact-boundary fixtures select the documented full, degraded, and refusal modes in 100% of automated cases without unbounded decoding or stale publication.
- **SC-010**: One hundred repeated activate, suspend, resume, close, and cancel cycles finish with zero growth in owned workers, object URLs, observers, subscriptions, timers, callbacks, or stream leases.
- **SC-011**: Every v0.1.0 metric has a runnable measurement or validation path, deterministic classification tests at target and hard-limit boundaries, and a documented applicability state.
- **SC-012**: The aggregate performance gate rejects 100% of malformed evidence, hard-limit results, stale fixture digests, missing activation-required receipts, and consecutive comparable warnings in the governed regression corpus.

## Assumptions

- Issue #60 is the sole GitHub issue in S018; platform packaging issues #62 through #65 and the final conformance issue #66 consume this slice's contracts but remain separate implementation slices.
- Hardware-sensitive release evidence is collected only on named reference profiles. Hosted pull-request runners validate policy, structure, deterministic bounds, and stable smoke thresholds without being presented as release-profile measurements.
- Package-size measurement becomes activation-required when the corresponding packaging slice produces the actual compressed artifact; S018 supplies the catalog, collector, validator, and gating semantics without manufacturing placeholder packages.
- Existing renderer thresholds, source authority, recovery behavior, and security boundaries remain authoritative. S018 may repair resource lifecycle or scheduling gaps but does not add new formats, editing capabilities, telemetry, or remote services.
- Performance evidence is an unreleased build artifact or repository fixture only when intentionally curated; raw user documents and machine-specific native locations are never evidence.
