# Validation Guide: S043

Use `scripts/invoke-docker-hidden.ps1` and the image built from `scripts/docker/validation.Dockerfile` on Windows. Use `scripts/invoke-vcs-hidden.ps1` for Git/GitHub commands. Native fidelity checks run on isolated hosted CI, never on the owner's active desktop.

1. Resolve the S043 feature selector and run the installed Spec Kit prerequisite scripts inside the Linux container.
2. Run focused qualification/activation/evidence-policy regressions, native image/core suites and the bounded fuzz/resource campaign. Retain source revision, corpus digests, budgets and actual exit status.
3. Run `cargo xtask check` through completion, including documentation, brand, strict encoding, advisory/license, frontend/browser and package policy gates.
4. Push the branch and open the official PR. Require three desktop native hosts, Android API24/API36 and the affected package workflows at the final candidate head.
5. Resolve every external review comment and no more than one requested follow-up round. Verify final head checks, unresolved threads, issue dispositions and candidate limitations before owner merge handoff.

Physical-device and manual screen-reader validation are unavailable and explicitly not release prerequisites under the 2026-11-02 owner decision. Reports must not claim either class of evidence.
