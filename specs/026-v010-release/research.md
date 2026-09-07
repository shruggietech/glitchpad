# Research: v0.1.0 Release Publication

## Decision 1: Validate secret presence inside the readiness job

**Decision**: Bind all five repository secrets to one fail-closed readiness step and check only whether each value is non-empty.

**Rationale**: GitHub does not expose missing secrets to jobs as errors; an unavailable secret resolves to an empty value. A single preflight step catches this before artifact discovery and can identify the missing name without revealing contents.

**Alternatives considered**: Waiting for the Android tag build to fail discovers the problem too late. Listing secrets through an API adds permissions and still cannot validate values. Validating full keystore contents in readiness would unnecessarily handle private bytes twice.

## Decision 2: Make manual dispatch the pre-tag authority check

**Decision**: Require a successful manual run of the existing release workflow from current `main` before creating `v0.1.0`.

**Rationale**: Manual dispatch already cannot reach publishing jobs because they require a tag ref. Extending its readiness job validates both committed evidence and secret availability without creating public state.

**Alternatives considered**: Creating a temporary tag risks triggering platform publication machinery. A separate workflow would duplicate release policy and could drift.

## Decision 3: Preserve owner control of private Android material

**Decision**: Keep key generation, recovery storage, and secret entry as an operator prerequisite described by the runbook; do not generate or persist a private key in the repository or automation logs.

**Rationale**: Upgrade continuity depends on durable owner custody. The implementation can verify secret availability safely, but it cannot guarantee an external recovery copy or password-manager custody.

**Alternatives considered**: Committing an encrypted key creates repository custody and recovery complexity. A disposable key breaks upgrade continuity. Paid store or certificate programs violate the approved community-release policy.
