# S045 Publication Contract

- The release source is a full reviewed, qualified commit SHA, reachable from the S045 PR before tagging. The annotated v0.2.0 tag is immutable, and the PR remains open for the owner's final merge.
- Preparation obtains the complete locked Cargo graph. Independent final metadata generation must operate with network disabled and unchanged Cargo.lock; missing cache inputs fail closed. SBOM remains full-graph.
- Existing platform package contracts govern 8 payloads and trust: Windows unsigned community, macOS ad-hoc/not notarized community, Linux repository attested, Android stable project key. Secrets never enter receipts or caches.
- Linux and macOS workflow passes require a separate installed-app JS/native read/edit/save/metadata/recovery proof with fixed input/output digests, unchanged original fixture, owned recovery removal, source closure, process exit and probe cleanup. No official flag or separately run source suite can satisfy these rows. Startup samples exclude this proof launch.
- Official tag workflows must bind manifests, package digests, attestations, signing evidence and required practical-use receipts to the exact tagged SHA. The publisher aggregates only successful complete platform evidence.
- Public inventory is exactly 14 assets: the 8 declared packages, 4 platform evidence archives, SHA256SUMS, and community-release-manifest.json. Independent downloads must match aggregate hashes, manifest inventory and source; Pages identity must match v0.2.0 and the same SHA.
- Failed campaigns and limitations remain visible. Physical ARM64 Android and manual screen-reader checks are unavailable per owner decision, not required gates; other manual #66 rows and actual #239 performance classifications stay explicit.
- Every received review comment gets a disposition; at most two external rounds. Final PR checks must be green, all actionable threads resolved, and #76/#10 close only after release criteria are met. No auto-merge.
