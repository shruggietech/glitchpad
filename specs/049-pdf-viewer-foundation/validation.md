# S049 validation record

## 2026-11-08: Specification and planning

Base main a88bdbce637aa2fc18e64e9c784ca2ea38462cd9. S049 is unreleased; no product behavior has qualified yet. Docker named-pipe probe returned ENOENT, so project execution uses isolated hosted jobs. Local operations are builtin file/network data operations and the approved hidden VCS launcher.

Clarify run42518043992 passed against9ee0425bdf8d2f9307962b8e76c59ebe48643399. Artifact13632077023 independently hashed fdc1bc10e4e07bad5a69ba396021c45ebdb364b63b3e2bdcb66ba47985c534ed; resolved core spec template matched. No critical ambiguities or questions; requirements checklist16/16.

Plan setup run42518201133 passed against the same source. Artifact13631184890 independently hashed7885fab3c1052067e4490c6b98ecd66f0044aeaa95c17500f408bd67d83128c3. R1-R12 decisions resolve the engine, browser, source, isolation, print and license choices.

Task setup run42520436826 invoked setup-tasks once againsta5f339bbb99867a4df71405abb30a1b7842a0c33. The script returned its complete template/context successfully; the wrapper subsequently failed because it tried to copy a tasks.md that setup-tasks intentionally does not create. The failed run remains diagnostic, not a passing workflow. Artifact13632988373 independently hashed646577277fda4607d424a0d5eb3d0ae5534fee1b135072ebdffd30b0084ec41a and contains the actual returned template used to generate36 tasks. No duplicate setup invocation was needed.

Blocking read-only analysis initialized in successful run42520574336 against9c866cc975cb2defd6eab6f1380cb2d24cb6753a. Artifact13632943729 independently hashed95e129b4c0b8dd9fe73ca82e2949f7c04f8e7f4829f086e02813f02841140372. Coverage:24FR,6buildable SC,16story scenarios,16issue criteria,8constitution principles,36mapped tasks;0critical/high findings,0ambiguities/duplications. Two medium task-path findings were corrected during implementation setup: the existing session reducer is domain/tabs.ts and desktop proof now names concrete existing probe files. No contract/scope change.

Implementation prerequisite run42520672883 passed against9c866c. Checklist requirements.md remains reviewer/spec-owned and16/16checked; no markers were changed during implementation. Required current proof remains pending, including actual Android compatibility and native four-platform/print observations.

## 2026-11-08: Initial worker foundation

Isolated preparation run42521116684 passed againstcb5419df3b875c70e6370dc6117b45d3ede51180. Exact pdfjs-dist6.5.438 package resource/static-decoder tests, PDF contract tests, frontend typecheck and production frontend build passed. Artifact13633024507 independently hasheda01c063d777169ff0c57a4f56741a1c9d9f7d459b7108223e014c1b39935d360; its generated dependency lock was read back. The PDF display/controller is not connected yet, so this build does not establish emitted-worker or native runtime compatibility.

## 2026-11-08: Composed build attempt1

Run42521619680 against1c0e2ec75dc403143ffea307dc947b52c2006609 failed typecheck because the minimal PDF surface used inspect_metadata instead of the existing metadata command ID. Resource/decoder and contract tests passed; no emitted worker/native runtime result was produced. Corrected the command ID and added the original structured/hostile PDF fixture generator plus a composed production-browser read probe for the next focused run.

## 2026-11-08: First composed production-browser observation

Run42521961498 passed againsta88e684b91b3794e297900133c5c33258e56699c. Artifact13633339242 independently hashed9cd341c4f1af22bd4b4e7c1b24200c719851ac75be146caa431b1d610a544950. Actual HeadlessChrome156.0.8078.47 loaded the emitted classic worker (1971283bytes, SHA2561d55a00eeba223fa0fc1c6e2c7b9f8f7a9ecc10b17b24a5a6bec1e16f9729cbd), rendered2130dark canvas pixels, exposed selectable expected text including BSD Symbol glyphs, and navigated to page2. First content requested4096+65536+5314bytes from the1053890byte self-authored PDF. No page errors, automatic external request, PDF OpenAction execution or forbidden native write/opener call was observed. The real production bundle uses a synthetic native source boundary in this check; this is diagnostic browser evidence, not installed-device or candidate qualification. Generated fixtures were independently read back and committed with hashes/provenance for the native preflight.

## 2026-11-08: Minimum-browser diagnostic attempt1

Run42522365871 againstfb89a7dbaa5f4b132e94a45d185f1393f15d8d8e passed current production-browser rendering but failed to reach the initial Add control in actual Chromium69. The failed archive13633987201 independently hashedeadc3c58bddba169a4457c32875e5b1fc94b25881c30f6058610db3b649b5a20. The first probe captured failure details only after opening PDF, which missed this earlier bootstrap failure. Extended capture to all phases and isolated PDF loading behind React lazy/Suspense so a PDF module failure cannot disable unrelated source views. Minimum-browser/native compatibility is not established.

## 2026-11-08: Early diagnostic causes isolated

Run42522681349 against4f83a7f15ec4a09c1c9c0775e5e8009210da7820 retained the early browser failure. Artifact13633678960 independently hasheda0efc14da5c9743a1cd022a49ab4bea60a3db01e6708de75dd94c61020b3822e. Chromium69 reported Unexpected token ? in the injected native-boundary seam, followed by absent invoke. The shared seam contains nullish-coalescing and requires the same ES2018 transpilation already used by the existing composed-layout harness. This was a harness parse failure, not evidence of a PDF engine incompatibility. Added explicit seam transpilation. Lazy PDF loading remains a proportional renderer-failure containment improvement.

Ordinary API24 run42522367508 againstfb89a7d built the native application successfully but failed Android test-asset merging: fixtures/images/manifest.json and fixtures/pdf/manifest.json had the same asset name. No installed/native PDF observation occurred. Renamed only the new PDF manifest to pdf-fixtures.json. Both failed runs remain diagnostic; rerun the focused checks before any complete matrix.

## 2026-11-08: Minimum-browser worker startup observation

Run42522940144 against39c8aaa2d8f76c3a428d22912bb0055d84d8fc36 passed source/resource contracts and current-browser reading. Artifact13633842592 independently hashedd3f9444d5960a43ae99c839a5825b6e342905953a6c93fbdbcaaef080e7fe8e6. The repaired Chromium69 harness opened the real PDF surface and requested the emitted worker; the controller reported worker_failure without a page-level JavaScript error. Added passive error/message observers around the real native Worker constructor in the diagnostic harness to retain the worker-specific startup cause. No fake worker or compatibility fallback was introduced. API24 native observation is still running.
