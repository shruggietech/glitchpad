# Research: Production Domain Cutover

## Decision 1: Retain Cloudflare DNS and GitHub Actions Pages

**Decision**: Cloudflare remains authoritative DNS, while the `shruggietech/glitchpad` GitHub Actions Pages site remains the production origin.

**Rationale**: S007 already supplies a validated static artifact and manual Pages workflow. The Cloudflare zone is active and authoritative, and S009 needs a configuration audit and DNS correction rather than a second hosting implementation.

**Alternatives considered**: Cloudflare Pages or Workers would expand scope, duplicate the existing deployment contract, and add an unrequested runtime and release path. Moving nameservers would add registrar risk without solving the legacy Pages claim.

## Decision 2: Use OAuth-authenticated provider APIs

**Decision**: Use the Cloudflare API MCP authenticated by OAuth for zone inspection and mutations, and use supported GitHub CLI and REST operations for repository Pages configuration and workflow execution.

**Rationale**: The Cloudflare MCP returned successful reads for DNS, DNSSEC, all 56 zone settings, Page Rules, zone and account rulesets, Workers routes, Email Routing, and account lists. GitHub authentication has organization-owner and repository-administrator authority. No repository token or interactive terminal credential is required.

**Alternatives considered**: The existing `CF_DNS_API_TOKEN` has incomplete read authority and failed several audit endpoints. A new broad token is unnecessary now that OAuth access is verified. Browser-only configuration is reserved for organization domain verification because GitHub exposes no documented public endpoint for that control.

## Decision 3: Treat managed rules as retained provider state

**Decision**: Record Cloudflare-managed rulesets by stable identity, version, phase, rule count, and enabled count, and classify all of them as retain.

**Rationale**: The zone contains only three Cloudflare-managed rulesets and no custom zone rulesets, Page Rules, Workers routes, or redirect lists. Copying hundreds of managed rule bodies would create noisy, rapidly changing evidence and is unnecessary for rollback because S009 does not mutate them.

**Alternatives considered**: Full managed-rule body archival was rejected because the provider owns and updates those definitions. Omitting rulesets entirely was rejected because the audit must prove they were inspected and intentionally retained.

## Decision 4: Preserve unrelated records and redact email destinations

**Decision**: Retain the five Google mail-exchange records, the OpenAI domain-verification TXT record, the Domain Connect record, DNSSEC status, and the existing email-routing rule. Commit only the email rule's identifier, status, matcher/action types, and redacted values.

**Rationale**: These items are unrelated to website hosting. Their exact DNS values are public and required for recovery, while forwarding destinations are personally identifying and do not need to be committed because S009 will not modify them.

**Alternatives considered**: Replacing mail configuration during the web cutover would violate scope and increase outage risk. Omitting email-routing evidence would fail the audit requirement.

## Decision 5: Prove the new origin through a temporary hostname

**Decision**: Deploy reviewed `main` to the new Actions Pages site and attach a temporary DNS-only preview subdomain before transferring the apex claim.

**Rationale**: The static export targets the custom-domain root, while the default project Pages path may not faithfully exercise root-relative routes and assets. A temporary attached hostname validates the exact root-hosting behavior without touching the existing apex or `www` records.

**Alternatives considered**: Local artifact validation alone does not prove the hosted deployment. Testing only the default project URL may produce false failures from the project base path. Transferring the apex before an origin proof would reverse the safety order required by Issue #102.

## Decision 6: Use GitHub's complete current DNS target set

**Decision**: Configure four apex A records (`185.199.108.153` through `185.199.111.153`), four apex AAAA records (`2606:50c0:8000::153` through `2606:50c0:8003::153`), and a DNS-only `www` CNAME to `shruggietech.github.io`.

**Rationale**: These are the current values published by GitHub for apex and subdomain Pages configuration. Using the complete set provides both address families and avoids the single obsolete 2022 apex target currently in Cloudflare.

**Alternatives considered**: An apex flattened CNAME is supported by some providers but would obscure the explicit rollback and acceptance contract. Keeping the old `192.30.252.153` target is unsupported by current GitHub guidance. A wildcard is explicitly discouraged because it creates takeover exposure.

**Source**: [GitHub custom-domain DNS guidance](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

## Decision 7: Keep website records DNS-only

**Decision**: Set preview, apex, and `www` website records to DNS-only for validation and leave them DNS-only at completion.

**Rationale**: GitHub must validate the custom-domain DNS and provision its certificate. The existing proxy returns Cloudflare addresses publicly and activates Cloudflare HTTP behavior that is not needed by this static site. Page Rules require proxied DNS, but the zone has no Page Rules to preserve.

**Alternatives considered**: Early or final proxying adds two TLS and redirect control planes without a measured performance or security requirement. It can be evaluated later after a stable direct-hosting baseline exists.

**Source**: [Cloudflare proxy status](https://developers.cloudflare.com/dns/proxy-status/), [Cloudflare Page Rules behavior](https://developers.cloudflare.com/rules/page-rules/)

## Decision 8: Coordinate organization verification with claim attachment

**Decision**: Add the organization challenge TXT record and confirm public propagation before clicking Verify, then immediately attach the verified apex to the new repository and activate final DNS.

**Rationale**: GitHub states that verifying a domain currently used by another user releases it immediately from that user's Pages site. The new origin and rollback must therefore be ready before the dashboard verification action.

**Alternatives considered**: Verifying early risks disrupting the legacy site. Detaching the personal claim first creates a takeover window. Leaving the domain unverified weakens ownership protection.

**Source**: [GitHub Pages domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)

## Decision 9: Create Pages with workflow build type and protected-main deployment

**Decision**: Enable the organization repository Pages site with `build_type: workflow`, create the `github-pages` environment with a main-only deployment policy, and dispatch the existing manual workflow with `deploy=true` from reviewed `main`.

**Rationale**: The existing workflow already separates build and deploy permissions, uploads the static artifact only for authorized dispatches, and deploys through the standard Pages action. The Pages REST API supports the workflow build type and custom-domain updates.

**Alternatives considered**: Legacy branch publishing would bypass the tested S007 workflow. Automatic deployment on every `main` push would remove the explicit production gate.

**Source**: [GitHub Pages REST API](https://docs.github.com/en/rest/pages/pages), [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

## Decision 10: Disable legacy Pages only after final smoke validation

**Decision**: Keep the personal repository and Pages site intact until the new apex passes ownership, DNS, TLS, redirect, route, asset, and metadata checks, then disable only its Pages site.

**Rationale**: This preserves the best rollback position and meets Issue #102's explicit retirement order. Before organization verification, the captured legacy configuration (`build_type: legacy`, `master:/docs`, `cname: glitchpad.com`, HTTPS unenforced) is sufficient for an exact restoration. After organization verification, GitHub restricts the verified domain to repositories owned by that organization. An exact return to the personal-account attachment therefore additionally requires removing organization verification before recreating the legacy attachment, and that ownership reversal is a last-resort rollback because it briefly weakens takeover protection.

**Deviation from the initial recovery assumption**: The first design draft treated the retained organization verification record as compatible with restoration to the personal repository. GitHub's ownership restriction makes that assumption false. S009 uses phase-specific rollback: restore the unchanged legacy state before verification; after verification, prefer stopping at or restoring the validated organization deployment; remove organization verification only when exact personal-account restoration is required.

**Alternatives considered**: Deleting or archiving the repository is destructive and unnecessary. Disabling Pages before the new site is proven removes the known-good fallback.
