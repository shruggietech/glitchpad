# v0.1.3 Release Handoff Contract

## Pull-Request Boundary

- The S038 branch prepares v0.1.3 and must not create a local or remote `v0.1.3` tag.
- No GitHub release named v0.1.3 may exist before owner-approved merge.
- Pull-request package jobs produce non-official candidates and exact-package evidence only.
- The immutable v0.1.2 tag, release record, and fourteen assets must remain unchanged.

## Merge Authority

- Green required checks and completed automated reviews authorize the owner merge ritual, not publication by themselves.
- The reviewed S038 merge commit on protected `main` becomes the only valid v0.1.3 tag target.
- Any commit added after review requires renewed release validation before tagging.

## Publication Transaction

1. Confirm `main` is synchronized, clean, and points to the reviewed S038 merge commit.
2. Confirm no local tag, remote tag, or GitHub release named `v0.1.3` exists.
3. Reconfirm the v0.1.2 immutable baseline.
4. Create one annotated `v0.1.3` tag on the reviewed merge commit and push that exact tag.
5. Require all four platform package workflows to succeed for the tag source.
6. Require release assembly to reconcile the complete package and evidence inventory, including practical-use receipts bound after final tag-manifest promotion, real packaged Windows recovery, and all four governed Windows scale results.
7. Publish one immutable v0.1.3 GitHub release, then and only then perform the release-authorized documentation deployment. A failed site handoff may be retried manually only from the exact published tag, with the workflow revalidating the release and tag commit before upload.
8. Verify release assets, public release metadata, production deployment revision, and primary installation instructions.
9. Reconfirm that v0.1.2 is unchanged.

## Failure Contract

If any package, lifecycle, security, documentation, provenance, signature, attestation, reconciliation, release creation, or deployment check fails, publication remains incomplete. Operators must correct the source and repeat review with a new commit; they must never replace existing official assets or move an existing release tag.
