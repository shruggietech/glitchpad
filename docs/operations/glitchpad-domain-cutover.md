# Glitchpad production domain cutover

## Run metadata

| Field | Value |
| --- | --- |
| Slice | S009 |
| Issue | #102 |
| Run ID | `20260901T013047Z` |
| Operator | `h8rt3rmin8r` |
| Working branch | `codex/009-domain-cutover` |
| Reviewed source revision | `c93395edc16ec64900dbfc8cabbad9162a40c0d2` |
| Cloudflare account | ShruggieTech (`39e3052d61e3edccea7d68269ec07182`) |
| Cloudflare zone | `glitchpad.com` (`ae5e724f63fc2f3292a8cb1b5bd1d76f`) |
| Legacy Pages site | `h8rt3rmin8r/glitchpad.com`, `master:/docs`, legacy build |
| Destination Pages site | `shruggietech/glitchpad`, GitHub Actions build |
| Canonical production host | `https://glitchpad.com` |
| Temporary preview host | `s009-preview.glitchpad.com` |
| Pre-mutation commit | `4692625e1f22bf0fbe53ce890d8de7174d039b85` |
| Run state | C01-C06 passed; Pages challenge is authoritative and public, preview is validated, and legacy production remains unchanged; C07 verification is pending final guard readback |

The branch was created from the reviewed `main` revision shown above. Direct GitHub administration and Cloudflare OAuth access were verified for the selected repositories, organization, account, and zone. The Cloudflare Email Routing read surface reported a newly timestamped, disabled, unconfigured settings object while returning the previously existing disabled catch-all rule; it changed no DNS record, route, destination, or enabled state and is retained exactly as observed.

## Evidence inventory

- Pre-cutover provider snapshot: `docs/operations/evidence/2026-09-01-cloudflare-pre-cutover.json`
- Post-cutover provider snapshot: `docs/operations/evidence/2026-09-01-domain-post-cutover.json` (created after final validation)
- Evidence contract: `specs/009-domain-cutover/contracts/cutover-evidence.md`
- Ordered tasks: `specs/009-domain-cutover/tasks.md`

Credentials, OAuth material, GitHub tokens, and email-routing destination values are excluded. Public DNS values and stable provider object identifiers are retained because they are required for audit and recovery.

## Pre-cutover baseline

The zone is active and authoritative through `norah.ns.cloudflare.com` and `rex.ns.cloudflare.com`. DNSSEC is disabled. The website apex is one proxied A record to `192.30.252.153`, and `www` is one proxied CNAME to `h8rt3rmin8r.github.io`. Five Google MX records, the OpenAI verification TXT record, and `_domainconnect` are unrelated and must remain unchanged. There are no Page Rules, custom zone rulesets, Workers routes, or account redirect lists. Cloudflare-managed rulesets, all 56 zone settings, the disabled Email Routing surface, and the Cloudflare certificate settings are retained.

The personal Pages site is built with `build_type: legacy`, source `master:/docs`, custom domain `glitchpad.com`, and HTTPS enforcement disabled. Destination Pages and its `github-pages` environment do not exist. Public apex responses currently expose Cloudflare proxy addresses, `www` has no public CNAME response because it is proxied, and the organization challenge does not resolve.

## Configuration decision log

| ID | Provider object | Pre-cutover identity or value | Decision | Intended final state | Recovery source | Status |
| --- | --- | --- | --- | --- | --- | --- |
| D01 | Apex A | `1223d3bd28b734c27a72fb7e26e2fc46`, `192.30.252.153`, proxied, Auto TTL | Replace | Four DNS-only GitHub Pages A records | Snapshot record plus rollback R08 | Planned |
| D02 | `_domainconnect` CNAME | `fd3b119c55c1865535eb2fe0090b831c`, `connect.domains.google.com`, proxied | Retain | Byte-equivalent | Snapshot | Planned |
| D03 | `www` CNAME | `fd8ef00fb74b6dd3bb3f18d573e9f076`, `h8rt3rmin8r.github.io`, proxied | Replace | DNS-only `shruggietech.github.io` | Snapshot record plus rollback R08 | Planned |
| D04 | Google MX priority 5 | `8d1f3d123cd4b5cda23f7b75dc4c2458`, `gmr-smtp-in.l.google.com` | Retain | Byte-equivalent | Snapshot | Planned |
| D05 | Google MX priority 10 | `a6bb8d777a8d6c83ce08016e0faf7219`, `alt1.gmr-smtp-in.l.google.com` | Retain | Byte-equivalent | Snapshot | Planned |
| D06 | Google MX priority 20 | `e5e2aa3c21c84e7926baf7bb00d54034`, `alt2.gmr-smtp-in.l.google.com` | Retain | Byte-equivalent | Snapshot | Planned |
| D07 | Google MX priority 30 | `a5b9846cae72f323ea373b0d4983baf4`, `alt3.gmr-smtp-in.l.google.com` | Retain | Byte-equivalent | Snapshot | Planned |
| D08 | Google MX priority 40 | `50e1878b24298808d334928291612821`, `alt4.gmr-smtp-in.l.google.com` | Retain | Byte-equivalent | Snapshot | Planned |
| D09 | OpenAI apex TXT | `b8f860846036c0c4f1c7acedb5c9dc88`, existing public verification value | Retain | Byte-equivalent | Snapshot | Planned |
| D10 | Organization challenge TXT | Absent | Add and retain | Public GitHub-issued TXT value | GitHub Pages UI; Cloudflare ID `a645502759838290ab31d2032149f686` | Verified at C06 |
| D11 | Preview CNAME | Absent | Add temporarily, then retire | Absent after canonical production passes | Cloudflare ID `c512a433e329c81cf77415a7668a3cbd` | Applied at C03; retirement pending |
| D12 | Apex AAAA set | Absent | Add | Four DNS-only GitHub Pages AAAA records | Created Cloudflare IDs | Planned |
| D13 | DNSSEC | Disabled | Retain | Disabled | Snapshot | Planned |
| D14 | Zone settings | 56 returned settings | Retain | Value-equivalent | Snapshot | Planned |
| D15 | Page Rules | Empty | Retain | Empty | Snapshot | Planned |
| D16 | Zone rulesets | Three Cloudflare-managed rulesets | Retain | Provider-managed; no S009 mutation | Snapshot summaries | Planned |
| D17 | Account rulesets | One Cloudflare-managed ruleset view | Retain | Provider-managed; no S009 mutation | Snapshot summary | Planned |
| D18 | Account lists | Empty | Retain | Empty | Snapshot | Planned |
| D19 | Workers routes | Empty | Retain | Empty | Snapshot | Planned |
| D20 | Email Routing | Disabled and unconfigured; one disabled drop rule | Retain | Semantically equivalent with no S009 mutation | Redacted snapshot | Planned |
| D21 | Cloudflare SSL | Full mode, Universal SSL enabled | Retain | No S009 mutation; dormant for DNS-only website records | Snapshot | Planned |
| D22 | Legacy Pages attachment | Personal repository, legacy `master:/docs`, apex CNAME | Retire last | Pages disabled after final smoke pass | Snapshot plus rollback R14 | Planned |
| D23 | Destination Pages | Absent | Add | Workflow build on organization repository, apex CNAME, HTTPS enforced | GitHub API state and workflow run | Applied at C01; final attachment pending |
| D24 | `github-pages` environment | Absent | Add | Main-only deployment policy | GitHub API state | Verified at C02 |
| D25 | Organization domain verification | Absent | Add and retain | `glitchpad.com` verified for `shruggietech` | Challenge TXT plus GitHub owner state | Planned |

## Local replacement-artifact validation

| Check | Expected | Observation | Result |
| --- | --- | --- | --- |
| `pnpm check:site` | Static export, routes, assets, metadata, and domain marker pass | Build passed; 6 unit and 11 Chromium tests passed | Pass |
| `cargo xtask docs` | Repository documentation validation passes | Brand, site, validation topology, configuration, formatting, Markdown, links, 28 Mermaid diagrams, version authorities, and 369 UTF-8 text files passed | Pass |
| `site/out/CNAME` | Exact `glitchpad.com` marker | Validated by `GitHub Pages markers are complete` and postbuild contract | Pass |
| Snapshot schema | Required provider surfaces present and JSON parses | JSON valid; 9 DNS records, 56 settings, 3 zone rulesets, 1 account ruleset, and all empty surfaces match live capture | Pass |
| Secret and email scan | No credential material or unredacted destinations | Credential marker scan returned zero matches; routing destinations are `[redacted]`; structured email-address scan passed | Pass |
| UTF-8 and mojibake scan | UTF-8 without BOM and no corruption markers | Repository validator passed 369 text files; snapshot byte check found no BOM | Pass |

## Checkpoint journal

Every checkpoint is fail-closed. A checkpoint starts only when its expected-before guard matches live state. On mismatch, the operator records the observation and stops without mutation. Provider object identifiers returned by successful mutations are added to this journal before the next checkpoint.

### C01 - Enable destination Pages

- Expected before: `shruggietech/glitchpad` Pages returns not found; legacy Pages remains built with the captured CNAME and source; website DNS equals D01 and D03.
- Mutation: Create destination Pages with `build_type: workflow`.
- Expected after: Destination Pages exists with workflow publication and no production apex attachment.
- Stop condition: Destination Pages already exists with unexplained configuration, or legacy/DNS guards differ.
- Rollback R01: Disable destination Pages if no later checkpoint depends on it.
- Observation: Pass at `2026-09-01T01:38Z`. The create response and immediate readback report `build_type: workflow`, `source: main:/`, `cname: null`, `html_url: https://shruggietech.github.io/glitchpad/`, and `https_enforced: true`. Legacy Pages and all nine Cloudflare records matched their committed guards immediately before the mutation. GitHub defaulted HTTPS enforcement on for the repository host; no custom domain or production routing changed.

### C02 - Protect the deployment environment

- Expected before: Destination Pages exists with workflow publication; `github-pages` environment is absent.
- Mutation: Create `github-pages` with a custom branch policy permitting only `main`.
- Expected after: Environment exists and its deployment branch policy contains only `main`.
- Stop condition: Existing environment policy is broader or contains unexplained reviewers, timers, or branches.
- Rollback R02: Delete the created environment after destination Pages is disabled, or restore its captured absent state.
- Observation: Pass at `2026-09-01T01:39Z`. GitHub created environment ID `20971361063` with branch-policy protection ID `64237058`, `protected_branches: false`, and `custom_branch_policies: true`; the only custom policy is branch `main`, ID `58765725`. The initial create request also sent `prevent_self_review: false`; GitHub returned 422 because no required reviewers exist but retained the otherwise valid environment and policy mode. A readback proved that bounded partial state, so the invalid field was removed and the single `main` policy was added. No reviewer, wait timer, extra branch, or deployment was introduced.

### C03 - Attach and publish the preview

- Expected before: Preview DNS name is absent; destination has no custom domain; C01 and C02 pass.
- Mutation: Set destination CNAME to `s009-preview.glitchpad.com`, add a DNS-only CNAME to `shruggietech.github.io`, and dispatch the reviewed `main` revision with deployment enabled.
- Expected after: The single workflow run succeeds, its deployed revision equals the reviewed revision, GitHub reports the preview CNAME, and the preview DNS record resolves.
- Stop condition: Preview name exists, deployment revision differs, workflow fails, or provider attachment is ambiguous.
- Rollback R03: Remove the preview CNAME from destination Pages, delete the created preview DNS record by returned ID, and retain the legacy apex unchanged.
- Observation: Pass at `2026-09-01T01:41:29Z`. GitHub changed destination CNAME from `null` to `s009-preview.glitchpad.com` and set `https_enforced: false` while the preview certificate is pending. An in-request Cloudflare guard proved the preview absent, all nine baseline records present, and the legacy apex plus `www` IDs/values unchanged. Cloudflare created DNS-only CNAME ID `c512a433e329c81cf77415a7668a3cbd` to `shruggietech.github.io` with Auto TTL and the planned temporary comment. Workflow run `33459610523` completed successfully in one watched attempt from `main` revision `c93395edc16ec64900dbfc8cabbad9162a40c0d2`; artifact ID `9782708795` is named `github-pages`, is 2,067,288 bytes, and is unexpired; deployment ID `6192857732` reached success with the preview environment URL. No production record changed. A read-only deployment query accidentally defaulted to POST because GitHub CLI fields imply POST and returned 422 for missing `ref`; the request created no deployment, after which the explicit GET returned the recorded deployment.

### C04 - Validate the preview

- Expected before: C03 passes and legacy production remains unchanged.
- Mutation: None; test the preview landing page, `/docs`, a nested documentation route, required assets and metadata, and one missing path.
- Expected after: Required routes and assets succeed, metadata names the canonical production host, and the missing path produces the expected not-found response.
- Stop condition: Any required route, asset, revision marker, metadata, or error behavior fails.
- Rollback R04: Apply R03 and stop before domain verification.
- Observation: Pass at `2026-09-01T01:42Z`. Public DNS returned CNAME `shruggietech.github.io`, all four supported GitHub Pages A targets, and all four supported AAAA targets. HTTP preview responses were 200 for `/` (25,841 bytes), `/docs` (44,853 bytes), `/docs/technical-specification` (430,765 bytes), and `/security` (25,366 bytes); each contained Glitchpad content, the canonical `https://glitchpad.com` metadata target, and social metadata. `/definitely-missing-s009` returned the expected 404. A static font referenced by the deployed HTML returned 200 as `font/woff2` with 50,196 bytes. The hosted workflow revision and artifact match C03.

### C05 - Stage organization verification

- Expected before: C04 passes; no `_github-pages-challenge-shruggietech.glitchpad.com` TXT exists; personal claim remains active.
- Mutation: Add `glitchpad.com` as a pending verified domain in the `shruggietech` Pages settings and obtain GitHub's challenge.
- Expected after: GitHub shows a pending domain and returns the exact challenge name and value without releasing the personal claim.
- Stop condition: GitHub indicates the personal claim would be released before an explicit Verify action, emits an unexpected challenge name, or reports an ownership conflict that changes state.
- Rollback R05: Remove the pending verification entry if GitHub supports doing so without affecting the personal claim.
- Observation: Pass after authentication at `2026-09-01T01:47Z`. The GitHub Pages organization settings showed zero verified Pages domains, accepted pending domain `glitchpad.com`, and issued hostname `_github-pages-challenge-shruggietech.glitchpad.com` with token `20611fd6ae632e3e0f27d661236e5c`. The Verify button was deliberately left untouched. Before authentication, the current public GraphQL schema was inspected as a possible supported alternative. `addVerifiableDomain` created transient unverified object `VD_kwHOBpohEc4ABoF4` with `_gh-shruggietech-o.glitchpad.com`, proving that API belongs to GitHub's separate organization identity/email-domain system rather than the Pages ownership control. The object was immediately deleted, the organization identity-domain count returned to zero, and no DNS or Pages claim changed.

### C06 - Publish the challenge

- Expected before: C05 passes; challenge DNS is absent; all retained DNS records match the snapshot.
- Mutation: Add the issued TXT record as DNS-only with Auto TTL.
- Expected after: Cloudflare returns a stable record ID and the exact TXT value resolves through both authoritative nameservers and at least two public resolvers.
- Stop condition: Existing conflicting TXT, retained-record drift, or incomplete bounded propagation.
- Rollback R06: Delete the challenge record by returned ID only before verification; after verification retain it unless executing R09.
- Observation: Pass at `2026-09-01T01:51:31Z`. An in-request guard confirmed ten expected DNS records, the preview ID/value, the legacy apex and `www` IDs/values, and absence of a challenge record. Cloudflare created TXT ID `a645502759838290ab31d2032149f686` with Auto TTL and DNS-only status. The first representation included literal presentation quotes in `content`; Cloudflare's API showed the object but all authoritative servers returned NXDOMAIN. A guarded PUT normalized the same ID to the raw GitHub token, after which all six authoritative nameserver IPv4 endpoints and Cloudflare (`1.1.1.1`), Google (`8.8.8.8`), and Quad9 (`9.9.9.9`) returned the exact token on the first check. This provider-specific normalization is retained in the final record contract.

### C07 - Transfer organization verification

- Expected before: C01-C06 pass; preview is healthy; challenge resolves publicly; personal Pages still owns the apex; all final DNS inputs and rollback data are ready.
- Mutation: Execute GitHub's organization Verify action for `glitchpad.com`.
- Expected after: `shruggietech` reports the domain verified and the personal Pages custom-domain claim is released.
- Stop condition: Organization verification is ambiguous, challenge no longer resolves, or the personal claim remains in an unexplained partial state.
- Rollback R07: Prefer continuing to C08 using the already validated organization origin. Exact personal restoration requires R09 followed by R14 and R08; do not remove verification merely to regain the old claim unless the destination cannot be restored.
- Observation: Pending.

### C08 - Attach the apex to destination Pages

- Expected before: C07 passes; destination still serves the validated deployment; destination CNAME is the preview; personal CNAME is released.
- Mutation: Replace the destination Pages CNAME with `glitchpad.com`.
- Expected after: Destination Pages reports the apex CNAME and retains workflow publication.
- Stop condition: GitHub rejects the verified apex, destination state changes unexpectedly, or the source claim reappears.
- Rollback R08A: Restore the destination preview CNAME and keep the verified organization domain while diagnosing. If this cannot restore a validated organization serving state, execute the guarded exact-legacy recovery R09, R14, then R08.
- Observation: Pending.

### C09 - Activate final website DNS

- Expected before: C08 passes; old apex and `www` records still match IDs and values D01 and D03; every retained DNS object matches the snapshot.
- Mutation: Replace the old website records with DNS-only A `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; AAAA `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`; and `www` CNAME `shruggietech.github.io`.
- Expected after: Exactly that website record set exists with Auto TTL and `proxied: false`; all D02 and D04-D10 retained records are unchanged.
- Stop condition: Expected-before ID/value mismatch, partial write, unexpected record, wildcard, or retained-record drift.
- Rollback R08: Delete the created website records by returned IDs, recreate apex A `192.30.252.153` and `www` CNAME `h8rt3rmin8r.github.io` with Auto TTL and `proxied: true`, then confirm retained records. The personal attachment must already be available through R14; if organization verification blocks it, execute R09 first.
- Observation: Pending.

### C10 - Validate provider ownership and DNS

- Expected before: C09 passes.
- Mutation: None; inspect Pages domain status and resolve authoritative plus public DNS.
- Expected after: Destination owns `glitchpad.com`; A, AAAA, CNAME, and challenge TXT values match the final contract; no legacy or wildcard website record remains.
- Stop condition: Ownership mismatch, stale unsupported target beyond the bounded observation window, missing address family, wildcard, or unrelated drift.
- Rollback R10: Restore the last validated organization preview state using R08A when possible; otherwise use R09, R14, and R08.
- Observation: Pending.

### C11 - Approve and enforce HTTPS

- Expected before: C10 passes; GitHub reports DNS validation and an approved certificate covering the canonical host.
- Mutation: Enable Pages HTTPS enforcement.
- Expected after: `https_enforced: true`; apex and `www` complete valid TLS and converge on the canonical HTTPS apex.
- Stop condition: Certificate remains unapproved after the bounded observation window, hostname coverage fails, or redirects loop.
- Rollback R11: Disable HTTPS enforcement only when required to restore a validated serving state; do not bypass hostname or ownership failure.
- Observation: Pending.

### C12 - Run production smoke inventory

- Expected before: C11 passes.
- Mutation: None; test DNS through authoritative and two public resolvers, IPv4 and IPv6 where available, TLS, HTTP redirects, canonical host, landing page, `/docs`, nested documentation, assets, metadata, and a missing path.
- Expected after: Every inventory case passes from the public canonical host and `www` redirects to it.
- Stop condition: Any required case fails or depends on the personal site or preview hostname.
- Rollback R12: Keep legacy Pages enabled and restore the last validated organization state; use exact-legacy recovery only if the organization state cannot be made safe.
- Observation: Pending.

### C13 - Remove the preview

- Expected before: C12 passes twice, including after any cache or DNS observation delay; destination CNAME is the apex.
- Mutation: Delete the preview DNS record by returned ID and confirm the provider no longer attaches it.
- Expected after: Preview name does not resolve and canonical production remains healthy.
- Stop condition: Canonical production changes, destination still depends on the preview, or the DNS ID differs.
- Rollback R13: Recreate the DNS-only preview CNAME and reattach it only if needed for organization-origin recovery.
- Observation: Pending.

### C14 - Retire legacy Pages

- Expected before: C12 and C13 pass; final post-cutover evidence is captured; personal repository and captured source remain accessible; destination production is healthy.
- Mutation: Disable Pages for `h8rt3rmin8r/glitchpad.com` without deleting or changing repository content.
- Expected after: Legacy Pages API returns disabled/not found while canonical production remains healthy.
- Stop condition: Any final smoke case regresses, evidence is incomplete, or legacy repository/source is unavailable for recovery.
- Rollback R14: Recreate legacy Pages from `master:/docs`. Before C07 it may reclaim `glitchpad.com` directly. After C07, exact personal-domain restoration additionally requires R09 before attaching the apex.
- Observation: Pending.

## Phase-specific rollback

### Before organization verification

Stop at the first failed checkpoint. Reverse only completed changes: remove the pending challenge if it was created, remove the preview DNS record and destination preview CNAME, disable destination Pages, and restore the absent environment if necessary. The personal Pages attachment and captured proxied website DNS remain the serving state throughout this phase.

### After organization verification, preferred recovery

GitHub verification restricts `glitchpad.com` to repositories owned by `shruggietech`. Preserve that ownership protection and restore the last validated organization state first: reattach the destination preview hostname if necessary, restore its DNS-only CNAME, redeploy the reviewed revision, repair or restore the final organization apex attachment, and repeat provider validation. Stop as soon as a validated organization serving state is restored.

### After organization verification, exact legacy recovery

This is the last-resort path when no validated organization deployment can be restored. It deliberately deviates from the preferred recovery because removing verification briefly weakens domain takeover protection.

1. Confirm the challenge TXT still resolves, the destination and legacy repository states match captured evidence, and the old DNS values are ready for immediate restoration.
2. R09: Remove `glitchpad.com` from the `shruggietech` verified-domain settings through the authenticated GitHub owner UI. Do not remove the TXT yet.
3. R14: Recreate personal Pages with legacy publication from `master:/docs`, attach `glitchpad.com`, and verify the personal repository owns the claim.
4. R08: Replace the organization website DNS set with apex A `192.30.252.153` and `www` CNAME `h8rt3rmin8r.github.io`, both proxied with Auto TTL, preserving every unrelated record.
5. Disable or detach the destination Pages site only after the legacy apex is serving and validated.
6. Remove the organization challenge TXT only if GitHub no longer associates it with an active organization verification and retention would misrepresent ownership.
7. Validate apex and `www` DNS, TLS/HTTP behavior, the legacy source, and all unrelated records; record every new provider identifier because restored DNS objects receive new IDs.

## Smoke-result inventory

| Surface | Preview result | Production result | Post-cleanup result |
| --- | --- | --- | --- |
| Reviewed deployed revision | Pass: `c93395edc16ec64900dbfc8cabbad9162a40c0d2`, run `33459610523`, deployment `6192857732` | Pending | Pending |
| Apex authoritative A and AAAA | Not applicable | Pending | Pending |
| Public DNS resolver 1 | Pass: preview CNAME plus four A and four AAAA targets | Pending | Pending |
| Public DNS resolver 2 | Pending | Pending | Pending |
| Organization challenge TXT | Pending | Pending | Pending |
| TLS chain and hostname | Pending | Pending | Pending |
| HTTP to HTTPS | Pending | Pending | Pending |
| `www` to apex canonical redirect | Not applicable | Pending | Pending |
| `/` | Pass: 200, Glitchpad content | Pending | Pending |
| `/docs` | Pass: 200, Glitchpad content | Pending | Pending |
| Nested documentation route | Pass: `/docs/technical-specification`, 200 | Pending | Pending |
| Static brand and application assets | Pass: deployed font asset 200; hosted browser suite passed | Pending | Pending |
| Title, description, canonical URL, social metadata | Pass: hosted metadata retains `https://glitchpad.com` canonical and social fields | Pending | Pending |
| Missing path | Pass: 404 | Pending | Pending |
| IPv4 transport | Pass through resolved preview A set | Pending | Pending |
| IPv6 transport | DNS pass through resolved preview AAAA set; direct client transport is validated at production C12 | Pending | Pending |

## Final reconciliation

Pending completion. Every intended provider difference will be mapped to D01-D25 and C01-C14. Every retained surface must compare equal to the pre-cutover snapshot. The legacy Pages retirement is authorized only by a passing C12 and C13.
