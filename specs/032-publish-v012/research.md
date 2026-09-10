# Research: Publish v0.1.2

## Decision 1: Treat v0.1.2 as a complete governed patch release

**Decision**: Move every active product, package, technical-specification, workflow, artifact, and public release authority to 0.1.2 while retaining the existing eight-package inventory and trust states.

**Rationale**: S029-S031 changed shipped presentation, desktop document behavior, and Android delivery. Selective publication would violate version consistency and make provenance ambiguous.

**Alternatives considered**: Replacing v0.1.1 would violate immutable release history. Publishing an unversioned hotfix would defeat package identity. Updating only affected platforms would leave cross-platform authorities inconsistent.

## Decision 2: Preserve historical evidence and create new patch records

**Decision**: Keep v0.1.0 and v0.1.1 release notes, receipts, runbooks, and completed specifications unchanged. Promote the existing v0.1.2 delta into official notes and add a v0.1.2 receipt and operator runbook.

**Rationale**: Separate records preserve the history of published bytes while giving the new patch a complete, auditable handoff.

**Alternatives considered**: Editing prior records would misrepresent earlier releases. Keeping only the unreleased delta would omit downloads, integrity guidance, trust warnings, and the publication ritual.

## Decision 3: Increment Android version code while preserving signing authority

**Decision**: Set Android version name to 0.1.2 and version code to 1002 while using the existing protected project-owned release key and certificate fingerprint.

**Rationale**: Android upgrade continuity requires a greater integer version code and the same signing identity.

**Alternatives considered**: Reusing 1001 blocks upgrades. Replacing the key breaks continuity. Store enrollment remains outside the community release.

## Decision 4: Reuse the proven exact-tag publication transaction

**Decision**: Move existing tag guards, artifact identities, release assembly, and immutable publication metadata to exact v0.1.2 values while preserving manual non-publishing readiness and source-revision validation.

**Rationale**: The release system has already published two versions. A bounded patch transition is safer than redesigning release automation.

**Alternatives considered**: Pull-request publication bypasses owner approval. Generalizing every workflow around dynamic versions adds risk immediately before release.

## Decision 5: Couple public deployment to the current release authority

**Decision**: Update source-controlled public claims and their validation to v0.1.2, but keep deployment governed so the official release exists before production presents it as downloadable.

**Rationale**: Repository, release, and live-site claims must converge without advertising nonexistent packages.

**Alternatives considered**: Leaving the site at v0.1.1 after publication is stale. Deploying v0.1.2 claims before publication creates broken downloads.

## Decision 6: Make stale patch identities fail before publication

**Decision**: Update release and package contract tests so active v0.1.2 paths reject stale v0.1.1 workflow guards, artifact names, embedded versions, documentation, and Android version code.

**Rationale**: A successful build alone cannot prove every publication path collected matching bytes. Mutation-style contract coverage catches broad mechanical drift before tagging.

**Alternatives considered**: Manual string review is incomplete. Waiting for tag CI makes the live publication transaction the first full test.
