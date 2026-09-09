# Research: v0.1.1 Corrective Release

## Decision 1: Treat v0.1.1 as a complete governed patch release

**Decision**: Move every active product, package, technical-specification, workflow, artifact, and public release authority to 0.1.1 while retaining the existing eight-package inventory and trust states.

**Rationale**: S027 changes shipped application behavior. Publishing only selected desktop files or leaving active 0.1.0 authorities would violate version consistency, make provenance ambiguous, and break Android update semantics.

**Alternatives considered**: Replacing v0.1.0 would violate immutable release history. Publishing an unversioned hotfix would defeat package identity and checksum verification. Updating only Windows would leave cross-platform product authorities inconsistent.

## Decision 2: Preserve historical evidence and create new patch-release records

**Decision**: Keep v0.1.0 release notes, receipt, runbook, and completed Spec Kit artifacts unchanged. Promote the S027 delta into new v0.1.1 release notes, receipt, and operator runbook, and reconcile the technical specification and changelog as current release authorities.

**Rationale**: A patch release needs a truthful current record without rewriting what was published previously. Separate documents preserve an auditable sequence and allow readiness validation to require the exact current version.

**Alternatives considered**: Editing v0.1.0 records would misrepresent the original release. Leaving only the S027 delta would omit downloads, trust warnings, integrity instructions, and the publication ritual.

## Decision 3: Increment Android version code while preserving signing authority

**Decision**: Set the Android version name to 0.1.1 and version code to 1001 while using the same protected project-owned release key and certificate fingerprint as v0.1.0.

**Rationale**: Android accepts an upgrade only when its integer version code increases and its signing identity remains continuous. The existing 1000 value maps cleanly to a 1001 patch successor.

**Alternatives considered**: Reusing 1000 would block upgrades. Creating a new signing key would break update continuity. Store enrollment remains outside the community-release scope.

## Decision 4: Reuse the proven tag-only publication transaction

**Decision**: Change the existing workflow guards, artifact identities, and release metadata to exact v0.1.1 values while preserving manual non-publishing readiness, source-revision validation, platform-run collection, immutable release refusal, and one annotated-tag owner ritual.

**Rationale**: The release system successfully published v0.1.0 and S027 already passed every platform candidate and lifecycle gate. A mechanical patch update is safer and more reviewable than a generalized release-system redesign.

**Alternatives considered**: Publishing from the pull request would bypass owner approval. Generalizing every workflow around dynamic versions would enlarge the emergency patch and add new failure modes.

## Decision 5: Apply the existing S024 `glib` disposition

**Decision**: Formally dismiss GitHub alert GHSA-wrw7-89jp-8q8g as tolerable risk with a comment referencing the merged S024 exception, while retaining `RUSTSEC-2024-0429` as an explicit cargo-deny exception that expires at the first compatible Tauri GTK transition or the v0.2 dependency pass.

**Rationale**: The locked Linux graph reaches `glib` 0.18.5 only through Tauri 2.11.5, Wry 0.55.1, WebKitGTK, and GTK 0.18. Glitchpad does not directly use `VariantStrIter`; patched `glib` 0.20 cannot be selected independently because the current Tauri GTK family requires 0.18. The S024 decision already prohibits a broad advisory exemption and assigns an explicit expiry.

**Alternatives considered**: A direct `glib` 0.20 override would create incompatible parallel GTK bindings. Vendoring or forking the binding would enlarge the security and maintenance surface. Leaving the GitHub alert open after a governed disposition would continue to report an already-reviewed decision as untriaged.

## Decision 6: Make stale patch identities fail before publication

**Decision**: Update existing release and package contract tests so active v0.1.1 paths reject stale v0.1.0 workflow guards, artifact names, embedded versions, release documents, and Android version code.

**Rationale**: The change is mechanically broad, and a successful build alone cannot prove every publication path collected matching bytes. Mutation-style contract coverage catches the highest-risk release error before tagging.

**Alternatives considered**: Manual string review is incomplete and non-repeatable. Waiting for tag CI repeats the failure mode exposed during v0.1.0 publication.
