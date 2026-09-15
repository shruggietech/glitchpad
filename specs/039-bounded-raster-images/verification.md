# Verification: S039 Bounded Raster Viewing and Metadata

**Started**: 2026-09-15

## Specification and Design

Specification quality: 16/16 criteria pass. Spec Kit template resolution, feature pointer, setup-plan, setup-tasks, and required-task prerequisite commands completed through the hidden Docker launcher. No extension hooks are installed.

Read-only cross-artifact analysis checked 22 functional requirements, 7 measurable outcomes, 15 acceptance scenarios, the architecture decisions, and all eight constitution principles. Every requirement/scenario maps to the 37 dependency-ordered tasks; no unmapped task, ambiguity, duplicate obligation, or critical/high conflict remains. The analyze pass made no artifact edits.

| Requirement group     | Tasks                                          |
| --------------------- | ---------------------------------------------- |
| FR-001 through FR-004 | T004, T005, T009, T010, T024                   |
| FR-005 through FR-011 | T006 through T014, T022, T023, T026            |
| FR-012 through FR-017 | T015 through T022, T025 through T027           |
| FR-018 through FR-022 | T001 through T003, T024 through T037           |
| SC-001 through SC-007 | T028 through T037, with focused story evidence |

## Dated Decisions

- 2026-09-15: Preserve official 0.1.3 support claims and all public associations/intent declarations. Internal raster chooser/drop routing is distinct from governed public association inventory.
- 2026-09-15: Replace text-only materialization for verified raster sources with read-only image sessions; applying UTF-8 decoding to binary sources cannot deliver the accepted capability.
- 2026-09-15: Use checked application-owned budgets plus supplementary decoder limits. Do not claim decoder hints provide a hard process-memory sandbox.
- 2026-09-15: Cancellation revokes scheduling/publication immediately while synchronous native decode retains its admission permit until actual completion.
- 2026-09-15: Apply orientation and explicitly report sRGB-assumed/unapplied-profile color policy rather than claiming arbitrary ICC conversion.
- 2026-09-15: Correct image refresh separately from text conflict handling: update image external revision and clear old preview/facts atomically within the existing session.

## Implementation Evidence

- 2026-09-15: PNG decoder setup can expand ancillary ICC payloads under the codec allocation hint. Strip EXIF, ICC, and text metadata chunks from a temporary pixel-only stream before decoder construction; parse the unchanged source separately under metadata budgets. Keep transparency/palette/pixel chunks and account for the temporary copy in encoded-byte admission.
- 2026-09-15: External review found GPS sensitivity lost through TIFF links. Preclassify the bounded IFD graph before publishing facts so descendants, siblings, and shared offsets inherit GPS taint independent of traversal order; fail closed if classification exceeds existing graph/entry limits.
- 2026-09-15: External review found exact-budget Android streams indistinguishable from larger sources. Reserve one additional stream-authority byte solely for EOF detection, never append it to accepted source bytes, and retain unconditional native stream closure and revision revalidation.
- 2026-09-15: The review follow-up audit reproduced a later TIFF page's orientation being applied to page one's preview. Restrict canonical TIFF orientation to the primary IFD, matching the existing primary-only EXIF policy; GPS taint still takes precedence for every IFD.
- 2026-09-15: A subsequent privacy regression reproduced a GPS-linked capture-time leak in JPEG EXIF, which used the library's field-context labels instead of the shared graph's sensitivity. Route embedded EXIF facts through the checked GPS-aware walker with primary-only facts; keep the library exclusively for independently bounded private thumbnail extraction.

Implemented the versioned common family contract and immutable resource policy, five native raster codecs, read-only source routing, independently bounded metadata extraction, and an owned inert-PNG viewport. Animation/SVG/ICO contracts are modeled, while their implementations and public activation remain deferred.

Final focused Linux-container evidence: family contract tests (3), decode/orientation/thumbnail/compressed-metadata tests (7), EXIF/XMP/IPTC/privacy tests (11), retained native admission/cancellation tests (3), desktop source conformance (15), and frontend image surface/contract tests (11) pass. Source adapter tests exercise desktop and Android adapter byte preservation. The frontend suite also exercises metadata provenance, redaction and copy, image materialization without text reads, stale results, atomic external revision refresh, visibility suspension, and disposal. Accessibility checks find no critical or serious findings in the image controls or inspector.

The image layout gate verifies all 13 original fixture hashes and exercises eight browser configurations (four viewport sizes with desktop/touch controls), at least 70% document-pane coverage, reachable 44-pixel touch controls, no page overflow, and actual inert PNG display. All eight configurations pass. The four notice bundles include the 18 newly locked transitive/direct packages with reviewed MIT/BSD/Apache-compatible licensing. Dependency checks pass without advisory suppression.

Initial complete validation failures were environmental or formatting failures: a scratch copy omitted the tracked brand guide, the old validation image contained a Chromium revision that differed from the repository pin, and two new Markdown files needed formatting. The tracked guide was restored, the validation image was rebuilt from the current Dockerfile, and the Markdown files were formatted. The fresh image passes the 73 site browser tests. Every completed implementation remediation subsequently passed the complete gate with real exit status 0, as recorded below.

Platform evidence is complete on final implementation commit `69a53f3e15e446ede256f60f678d8d65423bf00f`. Hosted Windows, Linux, and macOS image contract/corpus/privacy and opaque-source conformance pass. Android API 24/36 instrumentation passes all five fixture formats, source-specific inert preview dimensions, unchanged provider bytes, delivery, restoration, and performance. Public intent declarations remain unchanged. Workflow and artifact evidence appears in the final handoff section below.

| Included criterion | Evidence |
| --- | --- |
| #68: family/capability states | `image_contract.rs`, mirrored native/frontend family and policy types |
| #68: bounded authority | opaque source/revision commands, pure byte-only decoder, source conformance |
| #68: resource/degradation schema | checked admission, typed lifecycle/failure/thumbnail states, retained permit tests |
| #68: source/session compatibility | legacy text tests, separate read-only image session and image-only revision reducer |
| #69: correct platform rendering | five-codec and eight-orientation tests; Windows/Linux/macOS native checks and Android API 24/36 device evidence pass |
| #69: malformed/bomb bounds | dimensions before surface admission, 128 MiB source ceiling, bounded metadata and PNG output, compressed PNG metadata excluded from pixel decoder |
| #69: 100/200 MP budgets | exact boundary, overflow, Android surface limits, embedded-thumbnail-only tests |
| #69: no external access | native-only explicit codecs, inert PNG delivery, XMP entities/DTD rejected, browser request interception |
| #73: typed provenance | deterministic EXIF/XMP/IPTC, numeric original arrays, complete bounded scalar text, duplicate/conflict observations |
| #73: GPS copy/exposure | native serialization redaction, typed contract rejection, inspector/raw/bulk-copy tests |
| #73: independent metadata failure | malformed EXIF with valid JPEG, truncated/oversized blocks, invalid/unsupported ICC and compressed metadata tests |
| #73: accessibility/revision | image inspector axe, atomic refresh and stale-result tests |

Spec Kit convergence found two partial implementation gaps: thumbnail orientation/original descriptor facts (T038) and complete XMP/numeric-original preservation with namespace isolation (T039). Both were implemented after failure-first tests and now pass. Final convergence assessed 22 requirements, 7 outcomes, 15 scenarios, 39 tasks, and eight constitution principles, with zero remaining implementation findings and no appended tasks. Publication, hosted validation, and review tasks remain pending.

Final complete `cargo xtask check` completed with exit status 0 on 2026-09-15 in the image built from the current validation Dockerfile. Documentation lint, 408 Markdown link inventories, 47 Mermaid renders, official version authority (0.1.3), public-surface checks, and 972 UTF-8/BOM/mojibake text-file checks pass. An additional staged-file check verified 61 changed/new text files with no encoding failures, and `git diff --cached --check` passes. The intermediate documentation lint failure caused by an issue-number paragraph was corrected before this successful run.

## Scope Traceability

Review remediation added T040/T041. Failure-first tests reproduced both reported bugs; the fixed native metadata suite (9 tests) and the shared Android stream-drain boundary test pass. The GPS test also covers shared IFD offsets with both root-pointer orders, preventing traversal-order redaction bypass. The stream test covers empty, below-limit, exact-limit, and one-byte-over-limit unknown-size sources and asserts that only one EOF byte may exceed the accepted ceiling. The complete remediation `cargo xtask check` completed with exit status 0 on 2026-09-15, including all 51 frontend test files (289 tests), native/contract/corpus tests, strict lint, dependency policies, browser gates, documentation, encoding, and public authority checks. Post-remediation convergence assesses 41 tasks with no remaining implementation gap; hosted checks and final owner handoff remain pending.

Issues #68, #69, and #73 are included and must satisfy every criterion before handoff. #74 receives raster controls only and remains open. #70/#71/#72/#75/#76 and non-blocking #66 remain incomplete. No release or merge is authorized by this receipt.

## External Review Ledger

Official PR [#194](https://github.com/shruggietech/glitchpad/pull/194) was automatically pushed and published on 2026-09-15 at implementation commit `3e685eeb77fc48e6ec62058e1bcbf5cbf9f76cf8`. The initial bot response was a cloud-environment configuration message, not a code review or approval. It was acknowledged in the one authorized explicit follow-up [request](https://github.com/shruggietech/glitchpad/pull/194#issuecomment-5684458850), which Codex acknowledged and completed. Explicit follow-up request count is exactly one, and no further request is allowed. Codex reported two findings (GPS IFD sensitivity and Android exact-byte boundary); both were fixed in `782c378`, replied to with regression evidence ([GPS](https://github.com/shruggietech/glitchpad/pull/194#discussion_r4018250995), [boundary](https://github.com/shruggietech/glitchpad/pull/194#discussion_r4018251209)), and both review threads are resolved. The informational configuration and review-summary comments are acknowledged by this ledger and the follow-up request. No security review comment remains outstanding. Final implementation platform checks pass. The PR remains unmerged for the owner's final review and merge ritual.

The post-review convergence audit added T042 and reproduced incorrect first-page TIFF rotation from a later-page tag. The primary-only fix passes all seven decode tests and nine metadata tests, including expected unchanged first-page pixels. The final implementation `cargo xtask check` completed with exit status 0. Hosted checks on `f4d8a2f8a8de933b0613009026976021dfb79785` pass Windows/Linux/macOS source conformance, shared native/frontend tests, both CodeQL analyses, documentation/site/performance, Windows candidates, macOS universal candidates and both architecture lifecycles, Linux candidates and deb/AppImage lifecycles on Ubuntu 22.04/24.04, Android debug APK, and signed Android APK/AAB evidence. Android API 24/36 device validation remains pending. The assessed scope now contains 42 tasks with no remaining implementation finding; CI and owner handoff remain operator tasks.

The final privacy audit added T043 after a failure-first JPEG EXIF regression exposed a capture-time payload through a GPS-linked shared IFD. Embedded EXIF facts now use the same bounded graph classification as standalone TIFF, preserve primary-only facts, and retain the library solely for private thumbnail extraction. All seven decode tests and ten metadata tests pass. The complete post-fix `cargo xtask check` completed with exit status 0 on 2026-09-15, including 51 frontend test files (289 tests), native/corpus/lifecycle tests, dependency and license policies, browser/layout gates, documentation, encoding, and official public authority checks. Final Spec Kit convergence assessed 22 requirements, seven outcomes, 15 acceptance scenarios, 43 tasks, and eight constitution principles with zero remaining implementation findings; no new convergence phase was appended. Latest-head hosted validation and owner handoff remain pending.

2026-09-15: Hosted Android validation on `f4d8a2f` failed. API 24 completed provider/resolver tests and cold/warm text delivery but its image evidence searched `innerText` for an accessible label that is not visible text. API 36 failed to start the instrumented app while several Google/system applications also suffered startup ANRs; logcat reports CPU pressure near 100% and substantial I/O pressure. T044/T045 record these validation gaps before remediation. Correct visible/accessibility assertions independently; move APK/provider compilation before emulator startup and disable unrelated Google services solely in the disposable test emulator. Preserve every existing gate, strict raster pixel/source evidence, retry limit, and production manifest.

T044/T045 implementation passes the complete `cargo xtask check` with exit status 0. A separate preflight parses workflow YAML, verifies APK compilation precedes emulator startup, and validates all nine independently executed emulator shell commands. The accessible background selector is now asserted alongside real inert image pixels, independently of visible text. Post-remediation convergence covers 45 tasks with zero remaining implementation findings. Fresh hosted Android and latest-head aggregate results remain pending and are not represented by the local gate.

2026-09-15: On `fdc2268`, every non-Android check and the complete API 24 job passed. API 36 took almost 14 minutes to boot and nearly seven minutes for connected tests, then failed pixel evidence and the retry's surface assertion amid pervasive system contention. T046/T047 record remaining validation gaps before implementation: use the official AOSP API 36 image (confirmed in Google's system-image manifest), precompile the instrumentation APK, and require source-specific pixel evidence with bounded status diagnostics. API 24 retains its Google/Chrome image; production code, manifests, pixel thresholds, and retry limits remain unchanged.

T046/T047 pass workflow YAML and independent shell-command preflight, injected pixel-JavaScript syntax checks, and the complete `cargo xtask check` with exit status 0. The updated test records only bounded status text and booleans/dimensions, never raw source bytes or provider URIs. The 47-task convergence inventory has no remaining implementation finding; fresh hosted checks and owner handoff remain operator tasks.

2026-09-15: A bounded failure-first regression reproduced a GPS latitude numerator being exposed as an ordinary EXIF exposure value when distinct IFDs share payload bytes. IFD sensitivity alone cannot protect this alias. T048 records the high-severity FR-014 gap before production changes: preclassify checked GPS structure/value extents and withhold any overlapping ordinary fact, preserving the existing byte/entry limits and failing closed on invalid sensitive extents. Apply the same policy to standalone TIFF and embedded EXIF; keep raster decoding independent.

T048 passes all seven decode tests and eleven metadata tests. Its regression covers standalone/embedded EXIF, both pointer orders, exact/partial overlaps, an adjacent public exposure that stays visible, and invalid sensitive extents that fail closed. The complete post-fix `cargo xtask check` completed with exit status 0. The 48-task convergence inventory has no remaining implementation finding; this final privacy change still requires its own latest-head hosted validation before owner handoff.

2026-09-15: Hosted [API 24](https://github.com/shruggietech/glitchpad/actions/runs/35011067818/job/104522845073) and [API 36](https://github.com/shruggietech/glitchpad/actions/runs/35011067818/job/104522845162) validation on `5d4322c` completed successfully. Downloaded delivery logcat artifacts contain `image_evidence=png:pass,jpeg:pass,webp:pass,bmp:pass,tiff:pass,source_unchanged:pass` with the respective API identifiers, plus cold/warm delivery pass markers. Both restoration verification artifacts report `OK (1 test)`; performance receipts classify their measurements as `pass` with `cleanup_complete: true`. This establishes the device evidence after T046/T047 without substituting local tests for hosted results.

2026-09-15: The same commit's Windows push candidate missed persisted text in its existing save lifecycle check while the PR candidate passed. A single failed-job rerun [passed](https://github.com/shruggietech/glitchpad/actions/runs/35011062318/job/104525739577), retaining the original criteria. The macOS push Intel lifecycle exceeded its startup hard limit while the PR Intel lifecycle passed; its one failed-job rerun was cancelled by the next push's workflow concurrency. No threshold or lifecycle assertion was relaxed. Final privacy commit `69a53f3e15e446ede256f60f678d8d65423bf00f` was pushed automatically and requires fresh complete hosted validation.

2026-09-15: Final privacy commit `69a53f3`'s first API 36 attempt passed compilation but the SDK installer rejected its system-image download with `Error on ZipFile unknown archive`. The emulator never started and no instrumentation ran. GitHub rejected the immediate rerun request because the workflow's API 24 job was still running. After that workflow completed, a single failed-job rerun was accepted. Source, budgets, assertions, and timeouts remain unchanged.

## Final Owner Handoff

2026-09-15: Final implementation commit `69a53f3e15e446ede256f60f678d8d65423bf00f` passes all 37 reported PR checks: 36 successful checks and the intentional PR-only GitHub Pages deployment skip. The aggregate [CI run](https://github.com/shruggietech/glitchpad/actions/runs/35014212875) and `ci-ok` pass after the diagnosed SDK download failure's single rerun. Downloaded API 24/36 artifacts confirm all five raster formats, unchanged provider bytes, cold/warm delivery, successful restoration verification, and passing performance receipts with cleanup complete. API 36's raster/delivery evidence used its existing bounded second attempt; no assertion, timeout, or retry ceiling was expanded.

| Hosted gate | Verified result |
| --- | --- |
| Shared native/frontend and desktop source conformance | [Windows/Linux/macOS and shared CI](https://github.com/shruggietech/glitchpad/actions/runs/35014212875) pass |
| Android API 24/36 provider, raster delivery, restoration, performance | [Device evidence and aggregate CI](https://github.com/shruggietech/glitchpad/actions/runs/35014212875) pass |
| Android signed/debug package evidence | [Signed candidate](https://github.com/shruggietech/glitchpad/actions/runs/35014212933) and debug APK pass |
| Windows candidate install/edit/save/removal | [PR candidate](https://github.com/shruggietech/glitchpad/actions/runs/35014212867) and [push candidate](https://github.com/shruggietech/glitchpad/actions/runs/35014204734) pass |
| macOS universal candidate and both native architecture lifecycles | [PR candidate/lifecycles](https://github.com/shruggietech/glitchpad/actions/runs/35014212916) and [push candidate/lifecycles](https://github.com/shruggietech/glitchpad/actions/runs/35014204715) pass |
| Ubuntu 22.04/24.04 deb and AppImage install/launch/removal | [PR candidate/lifecycles](https://github.com/shruggietech/glitchpad/actions/runs/35014212963) and [push candidate/lifecycles](https://github.com/shruggietech/glitchpad/actions/runs/35014204782) pass |
| CodeQL and dependency/license/advisory/secret policies | [Both CodeQL analyses](https://github.com/shruggietech/glitchpad/actions/runs/35014212874) and shared CI policies pass |
| Documentation, public authority, static site, performance | [Documentation/site](https://github.com/shruggietech/glitchpad/actions/runs/35014212928) and shared CI gates pass |

All 48 Spec Kit tasks are implemented or completed operator obligations. Every criterion for included issues #68, #69, and #73 is covered; their closure remains tied to owner merge. #74 has only its raster subset, and #70/#71/#72/#75/#76/#66 remain open. There is no outstanding actionable review comment, both Codex threads are resolved, and exactly one explicit follow-up review was requested. No further review round or automatic merge is authorized by this receipt.

This final documentation receipt is published as a separate commit and must itself obtain green latest-head CI before the owner notification. The live PR body records that final result and head; no repeated receipt commit is required solely to copy its own future SHA. Official support remains 0.1.3, and S039 remains an unreleased v0.2.0 delta until the owner's final review and merge ritual.
