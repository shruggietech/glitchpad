# S045 Release Evidence Model

## Candidate

Fields: full source_commit, branch, tree, review_rounds (0..2), check_runs (identity/SHA/status/conclusion), package_runs per platform, retained_failed_campaigns, qualification_status. A candidate becomes qualified only with all required successful terminal checks and resolved actionable reviews. Any source mutation creates a new candidate; receipts are not reassigned.

## Release

Fields: annotated tag v0.2.0, source_commit, version0.2.0, release URL, 8 package records, 4 evidence archives, SHA256SUMS, community-release-manifest.json, Pages tag/source identity. Package records carry name, byte size, SHA256, manifest, trust/signing status, SBOM/notices, attestation and practical-use evidence. Public bytes are retained and immutable after acceptance.

## Closeout

Fields: released_source, final_pr_head, public_asset_readback, public_site_readback, issue_dispositions, review_threads, CI outcomes, limitations. States: specified -> implemented -> candidate_qualified -> tagged -> published -> independently_verified -> owner_review. Failure retains the last true state and exact failing evidence. PR merge is owner-controlled.
