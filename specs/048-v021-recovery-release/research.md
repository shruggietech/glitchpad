# S048 research and decisions

All decisions below are dated 2026-11-08 and precede product implementation.

| ID | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| R1 | Existing release/package contract is target version/tag authority; independent manifests remain checked. | Current scripts duplicate0.2.0 and S045 authority, including stale SBOM/promotion defaults. | Global replacement would corrupt history and third-party pins; another independent version source would drift. |
| R2 | Phase-neutral current copy, latest-published user links and explicit authorized deployment metadata. | Existing postbuild derives an unpublished tag destination; current source must stay true after identical bytes publish. | A permanent published=v0.2.0 constant becomes stale; promoting unsupported capability claims is false. |
| R3 | False-by-default manual staging uses existing project signing authority without publication. | Disposable Android candidates cannot be promised identical to future stable-signed bytes. Existing certificate validation/assembly supports official signing before a tag. | Rebuild later would need new acceptance and duplicate campaigns. No key is exposed or changed. |
| R4 | Opt-in release AndroidTest, unchanged canonical minified target and observable ordinary task flows. | Existing four-role campaigns test debug APKs only, and release R8 can rename private fixture-reflected fields. | Making production debuggable or adding keep rules for tests would change the qualified product. |
| R5 | Test-owned provider streaming and framed test-package capture. | A nondebuggable target cannot use run-as; existing descriptor transport supports bounded copies. | Whole APK Bundles exceed transport bounds; production storage permissions are unnecessary. |
| R6 | Stage final desktop trust metadata before native qualification. | Native receipts bind manifest SHA; metadata promotion afterward invalidates that binding. | Rewriting receipt hashes after tests would misrepresent evidence. |
| R7 | Later publisher consumes explicit accepted staging identities carried by an annotated tag. | Current tag workflow rebuilds packages, defeating exact-byte acceptance. | Selecting arbitrary latest successful runs or silently rebuilding loses accepted source/byte lineage. |
| R8 | Tag accepted source after merge/content verification, preserving its SHA. | Owner squash merges create another commit with equal contents. | Equal trees do not justify rewriting package provenance to the merge SHA. |
| R9 | Checkpoint receipt plus final PR confirmation. | A tracked file cannot name its own eventual commit without repeated invalidation. | Repeated self-SHA-only commits create unnecessary full campaigns. |
| R10 | Actual Spec-Kit and repository tooling use isolated hosted Linux. | Docker daemon is unavailable; WSL has no Node/pnpm/Cargo and failed networking. | Direct Windows tooling is prohibited. Initial plan wrapper failure was an unset native exit variable; retain it and initialize before execution. |
| R11 | Existing waivers and separate follow-ups remain literal. | #66 manual rows and #239 hosted/reference observations are not closed by recovery publication. | Silent waiver expansion or unrelated passing artifacts would fabricate completion. |
| R12 | Focused regressions and API-compatible helper probes precede full campaigns. | S047 exposed avoidable fixture/transport/focus defects sequentially during expensive runs. | Full reruns without isolating the failure boundary waste time and obscure evidence. |

## Primary repository evidence

packaging/release/package-contract.json defines the eight payloads and trust states. scripts/check-community-release.mjs contains the historical S045 authority gate. scripts/assemble-community-release.mjs rejects non-official/wrong-source/native-manifest mismatches. scripts/promote-community-package.mjs changes desktop manifest/provenance metadata. The four package workflows define actual source, promotion and native receipt order. android-package.yml currently assembles minified release bytes without an installed release campaign; ci.yml captures debug ordinary/fault roles. The Android Gradle, AndroidDeliveryInstrumentedTest.kt and FixtureDocumentsProvider.java define the existing variant, task and bounded provider boundaries. check-release-readiness.ps1 does not require a tagged source SHA to equal a later squash merge SHA.

## Official Android references

[Advanced test setup](https://developer.android.com/studio/test/advanced-test-setup) documents testBuildType selection. [AOSP instrumentation target example](https://source.android.com/docs/core/tests/development/instr-app-e2e) documents instrumentation/target signing compatibility. Existing pinned local sources remain the implementation authority.

## Brand decision

Implementation mode consumes the exact existing contract at brand/enforcement/consumer-contract.json and IMPLEMENTATION.md. BrandBuilder2.0.3/brand1.1.1 and generated identity bytes remain unchanged. Run the pinned probe/verification/glyph checks on isolated Linux; no creative approval or upstream recipe request is needed.
