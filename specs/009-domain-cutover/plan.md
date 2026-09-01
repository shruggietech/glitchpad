# Implementation Plan: Production Domain Cutover

**Branch**: `codex/009-domain-cutover` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-domain-cutover/spec.md`

## Summary

Migrate `glitchpad.com` from the personal `h8rt3rmin8r/glitchpad.com` Pages site to the organization-owned `shruggietech/glitchpad` GitHub Actions Pages deployment. The implementation captures sanitized Cloudflare and GitHub snapshots before mutation, classifies every relevant configuration item, proves the reviewed `main` artifact on a temporary DNS-only preview hostname, transfers organization verification and the apex claim in one checkpoint sequence, updates apex and `www` to current GitHub Pages targets, waits for and enforces HTTPS, runs public smoke checks, records the final state, and only then disables the legacy Pages site.

## Technical Context

**Language/Version**: Operational Markdown and JSON; existing Node.js 24.11.x, GitHub Actions YAML, and repository tooling remain unchanged

**Primary Dependencies**: Authenticated Cloudflare API MCP, GitHub CLI and REST API, GitHub Actions Pages, existing Next.js 16 static export, public DNS and HTTPS clients

**Storage**: Committed secret-free pre-cutover and post-cutover evidence, decision log, checkpoint journal, rollback runbook, and existing static site artifact

**Testing**: Existing `pnpm check:site`, `cargo xtask docs`, `cargo xtask check`, hosted documentation workflow, GitHub Pages status checks, authoritative and public DNS checks, TLS inspection, HTTP smoke tests, and repository encoding/secret checks

**Target Platform**: `glitchpad.com` and `www.glitchpad.com` through Cloudflare authoritative DNS and GitHub Actions Pages; modern public browsers and IPv4/IPv6 resolvers

**Project Type**: Monorepo public-site operations and infrastructure migration

**Performance Goals**: Complete each synchronous mutation checkpoint within five minutes of its prerequisite; detect DNS and certificate readiness without process-spawning polling loops; keep the validated legacy or replacement site reachable throughout observed checkpoints

**Constraints**: Production mutations must follow the committed checklist; Cloudflare remains authoritative DNS; GitHub Pages remains the host; verification may immediately release the personal claim; credentials and email destinations must not enter repository evidence; no wildcard DNS; DNS-only during provider validation; UTF-8 without BOM; zero foreground or focus-stealing Windows console windows

**Scale/Scope**: One active Cloudflare zone with 9 DNS records, 56 zone settings, 3 Cloudflare-managed zone rulesets, 1 managed account ruleset, 0 Page Rules, 0 Workers routes, 0 account redirect lists, 1 redacted email-routing rule, 2 GitHub repositories, 1 temporary preview hostname, 2 final public hostnames, and 1 documentation workflow

## Constitution Check

_GATE: Passed before Phase 0 research and re-checked after Phase 1 design._

| Principle | Pre-design evaluation | Post-design evaluation |
| --- | --- | --- |
| P1. The file owns the viewport | Pass. S009 changes public-site delivery and infrastructure, not the application viewport. | Pass. No application shell or document surface changes. |
| P2. Local files remain local | Pass. The public site contains project documentation only and introduces no document upload, account, telemetry, or remote processing. | Pass. Hosting remains a static artifact with no product file data flow. |
| P3. Cross-platform behavior is foundational | Pass. Public validation covers browser, DNS, IPv4, and IPv6 behavior independent of contributor platform. | Pass. No platform-specific product behavior is introduced. |
| P4. Untrusted input fails safely | Pass. Provider responses are treated as untrusted operational input, sanitized before persistence, and never interpolated into shell commands. | Pass. Contracts require schema validation, redaction, expected-state matching, and fail-closed checkpoints. |
| P5. Specifications and releases move together | Pass. S009 is an unreleased operational delta with Spec-Kit artifacts and no product-version change. | Pass. Site operations guidance, technical-specification delta, evidence, and changelog are part of the same slice. |
| P6. Verification precedes claims | Pass. Snapshot, origin proof, DNS, TLS, HTTP, and hosted gates precede completion claims. | Pass. Every checkpoint and acceptance criterion maps to automated evidence or a timestamped provider observation. |
| P7. Decisions are explicit and proportional | Pass. The slice is limited to Issue #102 and rejects a hosting-platform migration or generalized infrastructure framework. | Pass. Provider APIs, evidence files, and one runbook are the smallest coherent operational design. |
| P8. Apache-2.0 and license compatibility | Pass. No distributed dependency or third-party asset is added. | Pass. Provider configuration and original documentation add no licensing obligation. |

No constitution violations require complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/009-domain-cutover/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cutover-evidence.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code and operational records (repository root)

```text
.github/workflows/docs.yml
site/README.md
docs/
├── glitchpad-technical-specification.md
└── operations/
    └── glitchpad-domain-cutover.md
docs/operations/evidence/
├── 2026-09-01-cloudflare-pre-cutover.json
└── 2026-09-01-domain-post-cutover.json
changelog.d/
└── 102.fixed.md
```

**Structure Decision**: Keep production evidence and the durable runbook in the existing documentation authority, keep design artifacts under the S009 Spec-Kit directory, and reuse the existing site, workflow, and repository validation surfaces. Do not add Terraform, Wrangler, a Cloudflare runtime, a new package, or a credential-bearing script for a bounded one-zone migration.

## Design Decisions

### Authenticated APIs without repository credentials

Cloudflare inspection and mutation use the OAuth-authenticated Cloudflare API MCP scoped explicitly to the ShruggieTech account. GitHub inspection and mutation use the existing authenticated administrator session through supported GitHub CLI and REST operations. Evidence records provider object identifiers and sanitized values but never authentication material.

### Two-layer evidence record

The pre-cutover JSON snapshot captures stable configuration facts needed for audit and rollback. The Markdown runbook records classification, rationale, dependency order, checkpoints, observed results, and rollback actions. Managed provider rulesets are recorded by identifier, version, phase, rule counts, and enablement counts rather than duplicating hundreds of provider-owned rule bodies; user-controlled rules and every S009-mutated object are captured completely.

### Preview before claim transfer

The organization repository is enabled with `build_type: workflow`, restricted to the reviewed default branch, and deployed from `main`. A unique temporary DNS-only preview hostname attaches to that Pages site before the apex transfer. This proves root-relative routes, assets, metadata, and the deployed revision without disturbing the legacy apex. The preview record is removed only after the final apex site passes and the preview attachment has been replaced.

### Apex organization ownership and canonical behavior

`glitchpad.com` is the canonical hostname because the S007 artifact and metadata declare it. The persistent `_github-pages-challenge-shruggietech` TXT record establishes organization ownership. The apex uses all current GitHub Pages A and AAAA targets, while `www` points directly to `shruggietech.github.io`; GitHub Pages redirects `www` to the canonical apex.

### DNS-only is the completed default

S009 deliberately changes the legacy proxied apex and `www` records to DNS-only. GitHub must observe the real DNS targets to validate the custom domain and issue its certificate, and the static site has no measured need for Cloudflare HTTP proxy features. This deviation from the 2022 configuration reduces certificate and redirect ambiguity. Cloudflare zone settings and managed security rules remain retained but dormant for DNS-only website records; proxying can be reconsidered only in a later evidence-backed slice.

### Ordered claim-transfer checkpoint

GitHub documents that organization verification of a domain used by another account immediately releases the prior Pages claim. The cutover therefore completes the snapshot, preview deployment, rollback preparation, and pending TXT record before verification. Verification, new repository `cname` attachment, final DNS mutation, provider validation, and preview cleanup are executed as one journaled checkpoint sequence with expected-state checks between calls.

### Legacy retirement is last and reversible

The personal repository remains unchanged while the new site is validated. After final DNS, TLS, redirects, routes, assets, and metadata pass, its Pages site is disabled. Before organization verification, rollback can directly preserve or recreate the captured legacy Pages configuration from `master:/docs` and restore the captured apex and `www` records. After organization verification, GitHub's ownership restriction prevents the personal repository from reclaiming the domain while the organization verification remains active. Recovery therefore first prefers the validated organization deployment; an exact return to the personal attachment is a last-resort sequence that removes organization verification, recreates the legacy attachment, and restores the captured DNS under a guarded checkpoint.

## Complexity Tracking

No entries. The design introduces no new runtime, hosting platform, dependency, or generalized infrastructure subsystem.
