# Quickstart: Validate the Production Domain Cutover

## Prerequisites

- Work from `codex/009-domain-cutover` with a clean worktree.
- Confirm GitHub authentication has organization-owner and administrator authority for both repositories.
- Confirm the Cloudflare API MCP selects account `39e3052d61e3edccea7d68269ec07182` (ShruggieTech) and zone `ae5e724f63fc2f3292a8cb1b5bd1d76f` (`glitchpad.com`).
- Do not begin production mutation until the pre-cutover snapshot and decision log satisfy [the evidence contract](contracts/cutover-evidence.md).

## 1. Validate the repository artifact

Run the existing site and documentation gates:

```powershell
pnpm check:site
cargo xtask docs
```

Expected outcome: the root-hosted static export builds, route and metadata contracts pass, and `site/out/CNAME` contains exactly `glitchpad.com`.

## 2. Validate authority and capture baseline

Use read-only GitHub and Cloudflare provider calls to confirm the exact account, zone, source Pages site, destination Pages absence or state, environment state, DNS objects, settings, rules, routes, email-routing structure, SSL state, and public DNS observations. Persist only the sanitized result described by the evidence contract.

Expected outcome: every required surface is present in the snapshot, redactions are declared, and every live item has a retain, replace, or retire decision before mutation.

## 3. Prove the destination origin

Follow checkpoints 2 through 4 in [the evidence contract](contracts/cutover-evidence.md): enable workflow Pages, configure the main-only environment policy, attach the temporary preview hostname, add its DNS-only CNAME, dispatch the manual `docs` workflow from reviewed `main` with `deploy=true`, and wait for the deployment to finish.

Expected outcome: the preview hostname serves the reviewed `main` revision with correct landing, documentation, assets, metadata, and missing-page behavior while the legacy apex remains unchanged.

## 4. Transfer verification and DNS

Follow checkpoints 5 through 10 without reordering. Confirm the GitHub challenge TXT record publicly before organization verification. Treat the Verify action as the claim-release boundary, then attach the apex to the destination repository and apply the final DNS-only record set immediately.

Expected outcome: `shruggietech` owns the verified domain, the destination Pages site claims `glitchpad.com`, public DNS begins returning the supported GitHub Pages targets, and unrelated records remain byte-for-byte equivalent to the snapshot.

## 5. Validate TLS and public behavior

Wait for GitHub to report an approved certificate before enabling HTTPS. Validate apex and `www` through authoritative and public DNS, IPv4 and IPv6, TLS, HTTP redirects, landing, `/docs`, nested documentation, assets, metadata, and missing-page behavior.

Expected outcome: every production smoke case passes and both hostnames converge on `https://glitchpad.com` without a redirect loop.

## 6. Retire legacy hosting and capture final state

Remove the preview DNS record only after apex validation, then disable the personal repository's Pages site. Capture the final Cloudflare and GitHub state and compare it with the baseline.

Expected outcome: the destination is workflow-published with HTTPS enforced, the personal Pages site is disabled, all intended changes are attributable, all retained configuration is unchanged, and no preview or wildcard DNS record remains.

## 7. Run repository convergence

Run the full repository gate after evidence and documentation updates:

```powershell
cargo xtask check
```

Expected outcome: formatting, lint, tests, documentation, links, Mermaid, encoding, dependency, security, and site validation all pass before the pull request is opened.

## Rollback trigger

Rollback is mandatory when a post-verification checkpoint cannot attach the apex, final DNS does not converge, the certificate cannot be approved within the bounded observation window, required routes or assets fail, or ownership state becomes ambiguous. Follow the phase-specific reverse-order procedure in the committed runbook and record the result; never improvise a new attachment or DNS value during rollback. After organization verification, prefer restoring the last validated organization deployment. An exact return to the personal-account attachment additionally requires removal of organization verification and is reserved for the runbook's guarded last-resort path.
