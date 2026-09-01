# Tasks: Production Domain Cutover

**Input**: Design documents from `/specs/009-domain-cutover/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cutover-evidence.md, quickstart.md

**Tests**: Production and repository validation tasks are required because every acceptance criterion maps to automated evidence or a timestamped manual provider observation.

**Organization**: Tasks are grouped by user story, with production mutation tasks kept strictly sequential even when their documentation files differ.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel without sharing incomplete state
- **[Story]**: Maps to User Story 1, 2, or 3 from spec.md
- Every task names the repository file that receives its durable output

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the evidence surfaces and local baseline without external mutation.

- [x] T001 Confirm the clean S009 branch, reviewed `main` revision, GitHub authority, Cloudflare account/zone selection, and zero production mutation in `docs/operations/glitchpad-domain-cutover.md`
- [x] T002 Create the runbook, decision-log, checkpoint-journal, smoke-result, and rollback sections required by `specs/009-domain-cutover/contracts/cutover-evidence.md` in `docs/operations/glitchpad-domain-cutover.md`
- [x] T003 [P] Create the schema-complete pre-cutover evidence skeleton in `docs/operations/evidence/2026-09-01-cloudflare-pre-cutover.json`
- [x] T004 [P] Add Issue #102 traceability and the planned S009 operational delta to `changelog.d/102.fixed.md` and `docs/glitchpad-technical-specification.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Complete all validation, snapshot, classification, and rollback preparation before any production mutation.

**CRITICAL**: No user-story mutation may begin until every task in this phase passes.

- [x] T005 Run `pnpm check:site` and `cargo xtask docs` against the current branch and record artifact, route, metadata, and domain-marker results in `docs/operations/glitchpad-domain-cutover.md`
- [x] T006 Capture sanitized Cloudflare zone/account, GitHub Pages/environment, and public DNS baseline state in `docs/operations/evidence/2026-09-01-cloudflare-pre-cutover.json`
- [x] T007 Classify every DNS object, zone setting, Page Rule surface, managed ruleset, redirect-list surface, Workers-route surface, email-routing surface, SSL state, and Pages attachment as retain, replace, or retire in `docs/operations/glitchpad-domain-cutover.md`
- [x] T008 Define exact expected-before guards, expected-after results, stop conditions, and reverse-order rollback operations for all 14 checkpoints in `docs/operations/glitchpad-domain-cutover.md`
- [x] T009 Validate the pre-cutover snapshot against `specs/009-domain-cutover/contracts/cutover-evidence.md`, scan it for credentials and unredacted email destinations, and record the pass in `docs/operations/glitchpad-domain-cutover.md`
- [x] T010 Commit the validated S009 specification, plan, evidence baseline, decision log, and rollback checkpoint before production mutation, recording the commit in `docs/operations/glitchpad-domain-cutover.md`

**Checkpoint**: The replacement artifact, baseline, decisions, and rollback are reviewable before any provider mutation.

---

## Phase 3: User Story 1 - Transfer the production domain safely (Priority: P1) MVP

**Goal**: Prove the organization Pages origin, transfer organization ownership and repository attachment without a takeover window, and activate the final DNS-only record set.

**Independent Test**: Confirm the destination preview serves the reviewed `main` revision, the challenge record resolves publicly before verification, the organization owns the verified domain, the destination repository claims the apex, final DNS matches the contract, and every mutation has a passing journal checkpoint or completed rollback.

- [x] T011 [US1] Enable `shruggietech/glitchpad` Pages with workflow publication and record the exact API state in `docs/operations/glitchpad-domain-cutover.md`
- [x] T012 [US1] Create the `github-pages` environment with a main-only deployment policy and record its API state in `docs/operations/glitchpad-domain-cutover.md`
- [x] T013 [US1] Attach the unique preview hostname to destination Pages, create its DNS-only Cloudflare CNAME, and record both identifiers in `docs/operations/glitchpad-domain-cutover.md`
- [x] T014 [US1] Dispatch `.github/workflows/docs.yml` from reviewed `main` with `deploy=true`, watch the single workflow run to completion, and record its run, deployment, artifact, and revision evidence in `docs/operations/glitchpad-domain-cutover.md`
- [x] T015 [US1] Run preview landing, documentation, nested-route, asset, metadata, and missing-page smoke checks and record results in `docs/operations/glitchpad-domain-cutover.md`
- [x] T016 [US1] Create the pending `shruggietech` Pages-domain verification entry for `glitchpad.com` and record the issued challenge name and value in `docs/operations/glitchpad-domain-cutover.md`
- [x] T017 [US1] Add the persistent challenge TXT record through Cloudflare, confirm authoritative and public resolution, and update `docs/operations/glitchpad-domain-cutover.md`
- [x] T018 [US1] Execute the GitHub organization Verify action only after T011-T017 pass, then confirm the personal claim release and organization verification in `docs/operations/glitchpad-domain-cutover.md`
- [x] T019 [US1] Attach `glitchpad.com` to `shruggietech/glitchpad` Pages with an expected-state guard and record the result in `docs/operations/glitchpad-domain-cutover.md`
- [x] T020 [US1] Replace the legacy apex and `www` website records with the complete DNS-only A, AAAA, and organization CNAME set while preserving all unrelated records, recording provider identifiers in `docs/operations/glitchpad-domain-cutover.md`
- [x] T021 [US1] Validate destination Pages ownership and authoritative plus public DNS convergence against the final record contract in `docs/operations/glitchpad-domain-cutover.md`

**Checkpoint**: The verified organization repository owns the canonical domain and final DNS is active; the legacy Pages site has not been disabled.

---

## Phase 4: User Story 2 - Reach the official site securely (Priority: P1)

**Goal**: Provision and enforce HTTPS, prove canonical apex and `www` behavior, and validate every required public route and asset.

**Independent Test**: Confirm valid certificate coverage for both hostnames, HTTP-to-HTTPS convergence on `https://glitchpad.com`, and passing smoke results for all required content, assets, metadata, address families, and error behavior.

- [x] T022 [US2] Wait through bounded provider-state checks for GitHub DNS validation and certificate approval without spawning a polling process per check, recording observations in `docs/operations/glitchpad-domain-cutover.md`
- [x] T023 [US2] Enable GitHub Pages HTTPS enforcement only after certificate approval and record the resulting Pages state in `docs/operations/glitchpad-domain-cutover.md`
- [x] T024 [US2] Validate apex and `www` DNS from authoritative and at least two public resolvers over A, AAAA, CNAME, and TXT record types in `docs/operations/glitchpad-domain-cutover.md`
- [x] T025 [US2] Validate TLS chains, hostname coverage, HTTP-to-HTTPS redirects, canonical-host behavior, `/`, `/docs`, nested documentation, static assets, metadata, and missing-page behavior in `docs/operations/glitchpad-domain-cutover.md`
- [x] T026 [US2] Remove the temporary preview Pages attachment and DNS record only after T023-T025 pass, then confirm no dangling preview hostname in `docs/operations/glitchpad-domain-cutover.md`
- [x] T027 [US2] Repeat the canonical production smoke inventory after preview cleanup and record the final passing results in `docs/operations/glitchpad-domain-cutover.md`

**Checkpoint**: Visitors securely reach the validated organization deployment through apex and `www`, with no temporary hostname dependency.

---

## Phase 5: User Story 3 - Audit and reverse the migration (Priority: P2)

**Goal**: Prove final-state accountability, retire legacy hosting only after success, and leave a tested recovery record.

**Independent Test**: Compare pre/post provider state, prove every difference is an applied decision, confirm all retained objects are unchanged, confirm legacy Pages retirement follows the successful smoke checkpoint, and dry-run every rollback action from committed evidence.

- [x] T028 [US3] Capture the sanitized post-cutover Cloudflare, GitHub Pages, environment, DNS, TLS, and HTTP state in `docs/operations/evidence/2026-09-01-domain-post-cutover.json`
- [x] T029 [US3] Diff pre-cutover and post-cutover evidence, reconcile every difference with one decision and checkpoint, and record zero unexplained changes in `docs/operations/glitchpad-domain-cutover.md`
- [x] T030 [US3] Disable the legacy `h8rt3rmin8r/glitchpad.com` Pages site only after all US2 smoke checks pass and record the retirement checkpoint in `docs/operations/glitchpad-domain-cutover.md`
- [x] T031 [US3] Confirm the legacy Pages endpoint is disabled while canonical production remains healthy, then refresh final evidence in `docs/operations/evidence/2026-09-01-domain-post-cutover.json`
- [x] T032 [US3] Dry-run the reverse-order recovery decisions against captured identifiers and values, documenting any provider constraint and the validated rollback stopping point in `docs/operations/glitchpad-domain-cutover.md`
- [x] T033 [US3] Mark all retain, replace, and retire decisions verified and close the migration run as complete in `docs/operations/glitchpad-domain-cutover.md`

**Checkpoint**: The migration is fully attributable, legacy hosting is retired, and rollback remains executable from repository evidence.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Reconcile documentation, run all gates, publish the pull request, and converge review.

- [x] T034 [P] Update production publication, canonical-host, HTTPS, and rollback guidance in `site/README.md`
- [x] T035 [P] Complete the S009 unreleased delta and final operational outcome in `docs/glitchpad-technical-specification.md` and `changelog.d/102.fixed.md`
- [x] T036 Validate all S009 Markdown, JSON, links, Mermaid, UTF-8-without-BOM, mojibake, and secret-redaction requirements across `specs/009-domain-cutover/` and `docs/operations/`
- [x] T037 Run `cargo xtask check` and record complete local convergence in `docs/operations/glitchpad-domain-cutover.md`
- [x] T038 Mark completed tasks and set the S009 specification status to ready for review in `specs/009-domain-cutover/tasks.md` and `specs/009-domain-cutover/spec.md`
- [x] T039 Commit final evidence and documentation, push `codex/009-domain-cutover`, and open a pull request that closes Issue #102 with validation and rollback summaries
- [ ] T040 Watch hosted checks through completion, inspect all AI review threads, apply warranted fixes, reply under each addressed comment, and resolve each addressed thread before handoff

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and performs no production mutation.
- **Foundational (Phase 2)**: Depends on Setup and blocks every mutation.
- **User Story 1 (Phase 3)**: Depends on the committed pre-cutover snapshot, decisions, rollback, and local artifact proof.
- **User Story 2 (Phase 4)**: Depends on verified organization ownership, destination apex attachment, and final DNS from User Story 1.
- **User Story 3 (Phase 5)**: Final-state capture may begin after User Story 2; legacy retirement specifically depends on every US2 smoke case passing.
- **Polish (Phase 6)**: Depends on all three stories and the final external state.

### User Story Dependencies

- **User Story 1 (P1)**: Delivers the safe ownership and DNS transfer after the shared safety foundation.
- **User Story 2 (P1)**: Requires User Story 1's domain attachment and DNS but is independently validated through public TLS and HTTP behavior.
- **User Story 3 (P2)**: Requires User Story 2's successful smoke checkpoint before legacy retirement, while its audit model can be reviewed independently.

### Parallel Opportunities

- T003 and T004 can proceed in parallel because they create different baseline files.
- T034 and T035 can proceed in parallel after production completion because they update separate documentation authorities.
- Cloudflare, GitHub, DNS, TLS, and HTTP read-only observations may be batched within one checkpoint, but production mutations T011-T033 remain sequential by design.

## Parallel Example: Setup

```text
Task: "Create pre-cutover evidence skeleton in docs/operations/evidence/2026-09-01-cloudflare-pre-cutover.json"
Task: "Add Issue #102 traceability in changelog.d/102.fixed.md and docs/glitchpad-technical-specification.md"
```

## Implementation Strategy

### Safety Foundation First

1. Complete Phase 1 and Phase 2.
2. Commit the snapshot, decisions, and rollback before mutation.
3. Stop if any provider surface is incomplete, ambiguous, or contains an unexplained item.

### Controlled Production Increment

1. Prove preview deployment.
2. Stage and propagate organization verification.
3. Transfer verification, attachment, and DNS in order.
4. Wait for certificate approval and validate public behavior.
5. Capture final state before and after legacy retirement.

### Review Handoff

1. Reconcile every external difference.
2. Run full local and hosted validation.
3. Publish one Issue #102 pull request containing the complete evidence and rollback record.
4. Resolve all warranted automated review feedback before owner review.

## Notes

- `[P]` tasks never share incomplete files or external state.
- Every production task writes a durable observation to the runbook or evidence JSON.
- Never advance from a failed or ambiguous checkpoint.
- Direct Git and GitHub operations are permitted; Windows child launchers must remain hidden and non-interactive.
- Commit after the pre-mutation foundation and after the final evidence set so rollback history survives task interruption.
