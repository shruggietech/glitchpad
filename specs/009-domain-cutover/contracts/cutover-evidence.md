# Cutover Evidence Contract

## Evidence directory

Production evidence lives under `docs/operations/evidence/` and uses UTC-date-prefixed names. Evidence must be valid UTF-8 without BOM, contain no credential material, and remain understandable without access to task chat history.

## Pre-cutover snapshot contract

The pre-cutover JSON document must contain:

- `schema_version`, `run_id`, `captured_at`, and `source_revision`.
- Cloudflare account and zone identity.
- All live DNS records with stable identifiers and proxy flags.
- DNSSEC state and all returned zone settings.
- Page Rules, summarized managed rulesets, complete user-defined rulesets, account redirect lists, Workers routes, redacted Email Routing state, SSL mode, and public certificate-pack state.
- Source and destination GitHub Pages states.
- Public DNS observations for apex A/AAAA, `www`, and the organization challenge hostname.
- A `redactions` array explaining every omitted or transformed field.

The snapshot must not contain bearer tokens, OAuth data, cookies, private keys, GitHub tokens, Cloudflare tokens, unredacted forwarding destinations, or command environments.

## Decision log contract

The runbook must include one row for every snapshot object or explicitly grouped provider-managed set:

| Column | Requirement |
| --- | --- |
| Surface | DNS, DNSSEC, setting, Page Rule, ruleset, list, route, email, SSL, or Pages |
| Object | Stable identifier or unambiguous compound key |
| Baseline | Sanitized current value or state |
| Decision | Exactly retain, replace, or retire |
| Rationale | Scope and safety reason |
| Final expectation | Expected completed state |
| Rollback | Exact restoration value or operation |
| Evidence | Checkpoint or snapshot reference |

Managed provider rules may be grouped by ruleset when every rule shares the same retain decision. DNS records may not be grouped when their types, values, proxy state, or disposition differ.

## Checkpoint journal contract

Every production mutation must record, before execution:

1. Sequence and dependency.
2. Expected live pre-state.
3. Exact bounded mutation.
4. Expected immediate result.
5. Stop conditions.
6. Rollback operation.

After execution it must record the UTC timestamp, provider result or public observation, pass/fail status, and the next authorized checkpoint. A failed or ambiguous checkpoint cannot authorize the next mutation.

## Required checkpoint order

1. Capture and validate pre-cutover snapshot.
2. Enable destination Pages with workflow publication and main-only environment policy.
3. Attach temporary preview hostname and create its DNS-only record.
4. Dispatch reviewed `main` and validate preview deployment.
5. Create pending organization verification and obtain its challenge.
6. Add the persistent challenge TXT record and confirm public propagation.
7. Verify the organization domain, which releases the personal claim.
8. Attach `glitchpad.com` to the destination Pages site.
9. Replace apex and `www` with final DNS-only records.
10. Confirm provider DNS validation and certificate approval.
11. Enforce HTTPS and run final smoke checks.
12. Remove the preview record and confirm no dangling hostname.
13. Disable the legacy Pages site.
14. Capture and validate final state.

## Final DNS contract

The completed website record set is:

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| A | `glitchpad.com` | `185.199.108.153` | DNS-only |
| A | `glitchpad.com` | `185.199.109.153` | DNS-only |
| A | `glitchpad.com` | `185.199.110.153` | DNS-only |
| A | `glitchpad.com` | `185.199.111.153` | DNS-only |
| AAAA | `glitchpad.com` | `2606:50c0:8000::153` | DNS-only |
| AAAA | `glitchpad.com` | `2606:50c0:8001::153` | DNS-only |
| AAAA | `glitchpad.com` | `2606:50c0:8002::153` | DNS-only |
| AAAA | `glitchpad.com` | `2606:50c0:8003::153` | DNS-only |
| CNAME | `www.glitchpad.com` | `shruggietech.github.io` | DNS-only |
| TXT | `_github-pages-challenge-shruggietech.glitchpad.com` | GitHub-issued challenge | DNS-only |

The five Google MX records, OpenAI verification TXT record, Domain Connect record, and all other retained configuration remain equal to the pre-cutover snapshot. No wildcard record may exist.

## Production smoke contract

The final journal must demonstrate:

- Authoritative and at least two public resolver results for apex A, apex AAAA, `www` CNAME, and the challenge TXT record.
- Valid TLS hostname and chain checks for apex and `www`.
- HTTP-to-HTTPS behavior for both hostnames.
- One canonical HTTPS destination without redirect loops.
- Successful `200` responses for `/`, `/docs`, and representative nested documentation.
- Successful required static asset, manifest, icon, and social-preview responses.
- Accurate canonical and social metadata sourced from the organization deployment.
- Branded usable missing-page behavior.
- Destination Pages API state showing workflow publication, `cname: glitchpad.com`, approved certificate, and HTTPS enforcement.
- Legacy Pages API state showing disabled only after all preceding checks passed.

## Rollback contract

Rollback proceeds in reverse dependency order and stops when a validated serving state is restored. Before organization verification, it must be possible to preserve or recreate the legacy Pages site from `master:/docs`, restore its captured custom-domain attachment, restore the captured apex and `www` DNS objects and proxy flags, and remove the destination preview attachment. After organization verification, the preferred recovery target is the last validated organization deployment because GitHub prevents a verified organization domain from attaching to a personal-account repository. An exact return to the personal attachment is a last-resort recovery that must first detach the apex custom domain from destination Pages while organization verification still protects it, then remove organization verification under an authenticated owner checkpoint, recreate the legacy attachment immediately, and restore captured DNS. The temporary preview record may be removed when it no longer supports recovery. The organization challenge TXT record normally remains; remove it only with organization verification and only as part of the guarded exact-legacy recovery sequence.
