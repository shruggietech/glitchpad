# Feature Specification: Production Domain Cutover

**Feature Branch**: `codex/009-domain-cutover`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Cloudflare setup complete. Verify access and begin S009."

**Issue Traceability**: GitHub Issue #102

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Transfer the production domain safely (Priority: P1)

A project operator can move `glitchpad.com` from the legacy personal site to the organization-owned Glitchpad site without creating a domain-takeover window, losing unrelated DNS services, or proceeding without a recoverable prior state.

**Why this priority**: The domain is a public production asset whose current personal-account attachment and dated configuration create ownership, continuity, and security risk.

**Independent Test**: Capture the complete pre-cutover state, execute the ordered cutover checklist against the approved production revision, and verify after every mutation that the expected ownership, origin, DNS, and rollback conditions hold.

**Acceptance Scenarios**:

1. **Given** the legacy site still owns the custom domain, **When** the transfer begins, **Then** a timestamped secret-free snapshot, decision log, tested replacement origin, and executable rollback exist before any ownership or DNS mutation.
2. **Given** the replacement origin is proven, **When** the domain claim is transferred, **Then** organization verification, repository attachment, and DNS changes occur in an ordered sequence that leaves no unclaimed-domain interval.
3. **Given** any required checkpoint fails, **When** the operator evaluates the result, **Then** the cutover stops and either retains the last known-good state or follows the documented rollback without guessing.

---

### User Story 2 - Reach the official site securely (Priority: P1)

A visitor can use either `glitchpad.com` or `www.glitchpad.com` and reach the organization-owned Glitchpad landing page and documentation over a valid secure connection with stable navigation, assets, and metadata.

**Why this priority**: The migration delivers value only when public users reach the intended site reliably and securely through the canonical domain.

**Independent Test**: From multiple public DNS resolvers and fresh browser sessions, exercise the apex, `www`, documentation, representative assets, metadata, redirects, and missing-page behavior after certificate provisioning.

**Acceptance Scenarios**:

1. **Given** the cutover has completed, **When** a visitor opens either hostname over HTTPS, **Then** the certificate is valid and both hostnames converge on the intended canonical Glitchpad site.
2. **Given** a visitor follows the documentation entry point, **When** `/docs` and representative nested routes load, **Then** their content, navigation, styling, and assets come from the organization-owned deployment.
3. **Given** a crawler or visitor requests metadata, a static asset, or an unknown route, **When** the response is returned, **Then** canonical metadata is accurate, required assets load, and error handling remains branded and usable.

---

### User Story 3 - Audit and reverse the migration (Priority: P2)

A maintainer can understand every retained, replaced, or retired production setting and can restore the pre-cutover attachment and DNS configuration if a later production defect requires rollback.

**Why this priority**: Production infrastructure without a durable decision record or recovery procedure becomes unsafe to maintain after the immediate migration context is lost.

**Independent Test**: Review the committed snapshot, classification, mutation journal, final-state record, and rollback procedure without relying on chat history or secret material, then dry-run each recovery decision against captured identifiers and values.

**Acceptance Scenarios**:

1. **Given** dated or unrelated Cloudflare configuration exists, **When** the audit is reviewed, **Then** every relevant item is classified as retain, replace, or retire with a reason and no unrelated mail, verification, or service record is silently changed.
2. **Given** a rollback is required, **When** a maintainer follows the recovery procedure, **Then** the previous DNS values, proxy state, and Pages attachment can be restored from repository evidence in the documented dependency order, with organization verification removed first only when an exact return to the personal-account attachment is required after ownership transfer.
3. **Given** the migration succeeds, **When** the final record is compared with live production, **Then** ownership, DNS, certificate, redirect, deployment, and legacy-retirement evidence agree.

### Edge Cases

- The organization-domain verification process detects that the domain is still claimed by the personal account and releases that claim immediately upon verification.
- The replacement Pages origin builds successfully but does not yet serve the expected revision or custom-domain marker.
- Public DNS resolvers return a mixture of old and new answers during propagation.
- Certificate issuance remains pending, fails because of proxying, or becomes available only after a delay.
- The apex or `www` has an unexpected wildcard, flattening, redirect, or proxy rule that changes the observed destination.
- A dated rule affects unrelated mail, verification, security, or service traffic and cannot be safely retired as part of the website cutover.
- Authentication remains valid but a required provider operation is unavailable or returns only a partial configuration view.
- The claim is transferred but repository attachment, DNS validation, or deployment fails before HTTPS can be enforced.
- The legacy site must remain available for rollback after the canonical domain has moved.
- A production smoke test passes from one network but fails through another resolver, address family, or hostname.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: S009 MUST capture a timestamped, secret-free pre-mutation snapshot of the complete relevant Cloudflare zone and account configuration, including DNS records and proxy state, DNSSEC, zone and certificate settings, redirects, Page Rules, account and zone rulesets, cache and security rules, Workers routes, and relevant email-routing configuration.
- **FR-002**: The snapshot MUST preserve stable identifiers, values, ordering dependencies, and enough prior-state information to reverse every S009 mutation without storing credentials, access tokens, private keys, or unrelated sensitive content.
- **FR-003**: Every audited production item MUST be classified as retain, replace, or retire with a recorded rationale; unknown or unrelated items MUST default to retain until their purpose is established.
- **FR-004**: S009 MUST provide an ordered cutover checklist, checkpoint journal, stop conditions, and rollback procedure before the first production mutation.
- **FR-005**: The organization-owned repository MUST publish and validate the approved static site revision at its provider origin before the custom domain is detached from the legacy site.
- **FR-006**: The `shruggietech` organization MUST verify control of `glitchpad.com` with a persistent provider-issued DNS challenge record that remains present after the cutover.
- **FR-007**: Domain verification, legacy claim release, replacement repository attachment, and DNS activation MUST be coordinated so that the domain is never knowingly left unclaimed by an authorized repository.
- **FR-008**: The apex MUST use the hosting provider's current supported IPv4 and IPv6 destinations, `www` MUST point directly to the organization hosting origin, and no wildcard DNS record may expose an unclaimed hostname.
- **FR-009**: Website cutover records MUST begin without Cloudflare proxying during hosting-provider DNS and certificate validation unless recorded evidence demonstrates that proxying is required and safe earlier.
- **FR-010**: Unrelated mail, domain-verification, DNSSEC, and service records MUST be preserved exactly unless an item is explicitly classified and justified as part of S009.
- **FR-011**: HTTPS enforcement MUST occur only after the hosting provider reports a valid certificate covering the required hostnames and public validation confirms the certificate chain and hostname coverage.
- **FR-012**: The apex and `www` MUST exhibit one documented canonical-host behavior with no redirect loop, mixed-content failure, or dependency on the retired personal site.
- **FR-013**: Production smoke validation MUST cover the landing page, `/docs`, representative nested documentation, required static assets, canonical and social metadata, hostname redirects, IPv4 and IPv6 resolution, TLS, and missing-page behavior.
- **FR-014**: The legacy personal Pages site MUST be disabled only after replacement ownership, deployment, DNS, TLS, canonical-host behavior, and production smoke checks all pass.
- **FR-015**: S009 MUST produce a post-cutover state record and compare it with the pre-cutover snapshot so that every intentional external mutation is attributable and reviewable.
- **FR-016**: Automation and logs MUST redact credentials and secret material, use non-interactive authenticated channels, and fail closed when account selection, authority, or expected state is ambiguous.
- **FR-017**: The migration MUST retain the static, account-free, telemetry-free public-site boundary established by S007 and MUST NOT add a Cloudflare runtime dependency or move hosting to a different platform.
- **FR-018**: A decision to re-enable Cloudflare proxying after certificate validation MUST be based on measured operational value and recorded compatibility evidence; DNS-only operation is the default completed state.
- **FR-019**: Every acceptance criterion MUST map to an automated check or a timestamped documented manual observation, including any provider control that lacks a supported automation interface.

### Key Entities

- **Zone snapshot**: Timestamped secret-free representation of all relevant pre-cutover Cloudflare zone and account state required for audit and rollback.
- **Configuration decision**: Retain, replace, or retire classification for one DNS record, rule, setting, route, or service configuration with rationale and dependency notes.
- **Pages attachment**: Ownership relationship among a repository, its provider origin, the custom domain, deployment source, and HTTPS state.
- **Domain verification challenge**: Persistent organization-scoped DNS proof that protects the domain and its immediate subdomains from unauthorized Pages claims.
- **Cutover checkpoint**: Ordered production mutation with prerequisites, expected observations, stop conditions, evidence, and rollback action.
- **Production smoke result**: Timestamped observation of DNS, TLS, HTTP, route, asset, metadata, and redirect behavior from the live domain.
- **Rollback state**: Captured identifiers and values needed to restore the legacy attachment, DNS records, proxy flags, and prior routing behavior.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One complete pre-mutation snapshot accounts for 100 percent of the required Cloudflare configuration surfaces before any production mutation is recorded.
- **SC-002**: Every relevant audited item has exactly one retain, replace, or retire decision, and zero unrelated DNS, mail, verification, or service records change during the migration.
- **SC-003**: The replacement site successfully publishes the reviewed default-branch revision and passes all origin checks before the legacy custom-domain claim is released.
- **SC-004**: The organization verification challenge remains publicly resolvable after completion, and the domain is shown as verified for `shruggietech`.
- **SC-005**: Authoritative and representative public DNS checks return only the intended apex IPv4 and IPv6 destinations and the intended `www` destination, with zero wildcard records.
- **SC-006**: HTTPS checks for both hostnames report a valid certificate chain and hostname coverage, and 100 percent of tested HTTP entry points converge on the documented canonical HTTPS destination without loops.
- **SC-007**: Production smoke checks pass for 100 percent of the required landing, documentation, nested-route, asset, metadata, redirect, address-family, and missing-page cases.
- **SC-008**: There is no measured checkpoint interval in which neither the validated legacy site nor the validated replacement site is available through an authorized expected hostname.
- **SC-009**: The legacy personal site is disabled only after all replacement checks pass, and its retirement evidence identifies the exact successful checkpoint that authorized removal.
- **SC-010**: A maintainer can identify and execute the phase-appropriate rollback action for every production mutation using only the committed runbook and secret-free evidence, including the additional ownership reversal required before a post-verification return to the personal-account attachment.
- **SC-011**: Repository validation, encoding, documentation, link, deployment, and security gates complete successfully before S009 is described as ready for review.

## Assumptions

- Cloudflare remains the authoritative DNS provider for `glitchpad.com`; S009 audits and updates that existing zone rather than changing nameservers.
- GitHub Actions Pages remains the approved static host established by S007; Cloudflare Pages, Workers, and other runtime products are outside S009.
- The current Cloudflare OAuth session is authorized for the ShruggieTech account and the complete `glitchpad.com` configuration surfaces required for audit and controlled mutation.
- The authenticated GitHub account remains an administrator of `shruggietech`, `shruggietech/glitchpad`, and `h8rt3rmin8r/glitchpad.com` throughout the cutover.
- The S009 authorization includes controlled production mutation after the pre-cutover snapshot, plan, tasks, analysis, and explicit checklist prerequisites are complete.
- Provider certificate issuance and DNS propagation may require bounded waiting; a pending external process is not treated as success and does not justify bypassing a checkpoint.
- GitHub organization-domain verification may require an authenticated dashboard operation because no supported public API is documented; that operation must occur only at its planned cutover checkpoint.
