# S045 Validation and Publication Guide

1. Resolve feature045 with the installed Spec-Kit PowerShell scripts inside the hidden Docker environment. Confirm branch, selector, feature directory, tasks, and issue mapping agree.
2. Run focused release-policy tests and aggregate repository checks in the existing validation image. Prove full locked Cargo metadata succeeds in a second network-disabled container with shared registry/git cache and unchanged lock digest; missing cache inputs must fail.
3. Push the concrete S045 change and open the official PR. Track the initial bot round and, if needed, one additional @Codex review. Address every received finding and preserve review receipts.
4. Run applicable CI and all four platform package/runtime campaigns on the exact candidate. Dispatch branch-head checks when PR synthetic SHA differs. Verify source-bound artifacts, Linux4 lifecycle forms, macOS2 architectures/startup classifications, Windows diagnostics, and Android API24/API36 assertions. Preserve failed campaigns.
5. After the reviewed exact source qualifies, create/push only the annotated v0.2.0 tag. Watch the four official platform jobs, release publisher and Pages. Never move the tag or substitute candidate packages.
6. Download all14 public assets and validate hashes, inventories, package manifests, signing/trust status, SBOM/notices, repository attestations, practical-use receipts, and exact source identity. Read back public Pages tag/source.
7. Record actual release receipt and issue-level dispositions; close #76 then #10 only when their criteria are met. Run applicable final-head checks, confirm all bot threads disposed, and ping owner with the still-open PR. Remaining #66/#239 evidence is explicit.

Use scripts/invoke-vcs-hidden.ps1 for Git/gh and scripts/invoke-docker-hidden.ps1 for non-Git console tools on the interactive Windows workstation. No native UI qualification on the owner's desktop.
