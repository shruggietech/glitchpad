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

## 2026-11-08: Worker startup succeeded; post-startup failure retained

Run42523708122 against19bb7242eb63f5edc1c0b787bff727daaf3262b1 retained actual Chromium69 worker ready/version6.5.438/native_bridge:false, then the controller failed later. Artifact13634870469 independently hashede6e89bd4734bcd6e9e77294c267f59deb521b56faa3044db735f5ae467960562. Added passive native Worker.postMessage exception observation and source-read counters to distinguish port handshake from source/getDocument work.

API24 run42522942818 against39c8aaa completed with two retained failed PDF-read attempts. The actual app reached the PDF controls and displayed worker_failure. Artifact13634835292 independently hashed2437d5007a6a4b857333b81bf0bb37f1809e0e1cdeb738d905a56b0218727885. Installed-byte receipts identify ordinary Android7.0/API24 application40d2da4dc6fcab9a93393c680c978ac06342a49c789ebf7690e59dd617330df8 (233322426bytes) and instrumentationb85e99e15a565d8c4356f24eafef6df7070405d8a10728a9021fcc3d01275116 (857917bytes), captured through verified shell_v2 and matched to built packages. No PDF native compatibility pass or complete matrix is claimed. Fix the smaller browser boundary before another APK run.

## 2026-11-08: Exact old-WebView port failure and fix

Run42524061027 against4929225bed15612e894e062743773908a0e737e4 retained Worker ready6.5.438/no-native-bridge,4096source bytes read, then an actual GetDocRequest postMessage TypeError: explicit null could not convert to a sequence. Artifact13634677035 independently hashedb524a7809ffef445a5ca985a98ea23da826aaf152695706fcdd958adf614275a. Implemented narrow real-port null/undefined-to-empty-transfer normalization in both PDF realms with payload/receiver/transfer-preservation tests. Compatibility remains pending the rerun; no baseline, worker isolation or source limit was relaxed.

## 2026-11-08: Real Chromium69 reading reached; legacy cleanup corrected

Run42524535880 againstf1cbc43a13b63cb24343cc8c5fbff32f96952870 passed source/resource contracts and current-browser reading. The null-transfer fix let actual Chromium69 render selectable content and navigate to page2. The run remained failed because subsequent page disposal called Node.replaceChildren, absent in this WebView. Replaced that empty-container operation with textContent assignment, preserving cancellation before cleanup. This is partial diagnostic evidence, not a passing compatibility result.

Source cache run42524305265 against7af7b2fcb6bf0eb879dd530d36306bbda5ac124c passed the five real-file Rust private cache ownership, quota, cancellation and restart-cleanup tests. Full frontend regression ran632tests:617passed and15failed because four existing text/source mock suites did not supply the new identify_pdf_source reply. Added explicit negative PDF-identification replies to those text fixtures and the composed source seam, plus the new probe in failure cleanup coverage. Production identification still requires a typed native boolean; no undefined/error fallback was added. Type/lint steps were skipped after the failed regression gate.

## 2026-11-08: Minimum browser and installed API24 preflight pass

Focused run42524828757 passed against0dbcfc16b0fd8bbc307843f0ef3f88a1a57b5f17. Artifact13634837557 independently hashed96f410e2d9466eb9d41d91490d00f4a34570f2fd772ce9eb1d2737d66167440a. Actual Chromium69.0.3497.0 and current156.0.8078.47 rendered selectable expected text/Symbol glyphs, navigated page2 and reported zero page errors/forbidden writes/opener calls/script execution after the transfer-list and DOM cleanup fixes. This remains browser evidence with synthetic native source boundaries.

Ordinary installed API24 run42524832545 passed against the same source. Artifact13635072763 independently hashed395ece8032a25097f43abec4feaee50d10774e373e4bf7bb05db07092b5a4f12. Actual Chrome69.0.3497.100 rendered1003dark canvas pixels and expected selectable text, navigated page2, preserved source bytes and observed real worker/canvas disposal in1.5ms (zero remaining workers/surfaces/owned surface bytes). Source identities matched native/frontend compilation. Installed app0b0dbce8fe8bb1c466e8a182b43c5c34d1944c08ccb5aabd8e48ad44fc4b950c (235086594bytes), testd2b883ab426c094a88c35b6c1f002517ae5cd95725e538467c91367a0e98ab8c (857917bytes), fixtureeef48ae38011f7e8ce5661dfdc0f508c46a0444a7146c260ad7961ddbf63a5af. Receipts matched installed bytes through verified shell_v2. The early observation is diagnostic_only:true/candidate_qualified:false; it does not qualify later changed behavior, stream spooling, font baselines, printing or the remaining issues. API36 preflight dispatched against the same source.

Source regression run42524830551 passed the five native cache tests and633of634frontend tests. The remaining assertion expected one source-identification call; updated it to require exactly the two bounded image/PDF signature probes and still forbid snapshot reads. Other source checks remain unchanged.

## 2026-11-08: Display-resource ownership checks

Run42525870442 against14ae4aaf4048bedf9b8f07bb064608b900daa762 passed all five native cache tests and all640frontend tests. Subsequent type/lint checks found a nullable removeEventListener argument, redundant assertions, an unawaited asynchronous resource factory and a build-plugin declaration resolving Vite outside its workspace dependency scope. Corrected these without changing budgets or native authority. The private Windows workflow now runs type and lint in separate steps, so either nonzero exit remains a failing gate. Focused run42525868688 stopped at the same type error and produced no new browser qualification.

## 2026-11-08: Ordinary installed API36 preflight pass

Run42525499427 passed against0dbcfc16b0fd8bbc307843f0ef3f88a1a57b5f17. Artifact13635327829 independently hashedb0ba79e1b2a21658cbf4123206b6857df064fc65529fff60428d9246cec78e22. Actual Android16/API36 WebView133.0.6943.137 rendered986dark canvas pixels and expected selectable text, navigated page2, preserved source bytes and observed real worker/canvas disposal in0.6ms. Native/frontend/source compilation identities matched. Installed applicationb845c7913f1b67351818fc5ecb684c12226856423c148357439347076a5bb5f2 (235086594bytes), instrumentation2193e04f8b03eabc0e87ae54f60014e0b11b4a9d24eb79a82c74107a9cdc1ee9 (857917bytes). Independently decompressed and hashed both captured installed APKs from the verified archive and matched the receipt. Repeated the independent installed-APK hash readback for the successful API24 archive and matched both receipts. Both are diagnostic preflights of that earlier source; later resource/font/navigation/print changes require fresh applicable evidence.

## 2026-11-08: Integrated reading and print implementation checkpoints

Source 185cd59a063435b21e02d06f9ea6947b3c29d8da passed focused run42526410515 (artifact13634729156, independently verified SHA256 e1f3433f80614a7024195216e1a805f988d628b7c1ac25821c5e37ad26075b1c) and cache/regression run42526412189 (five native cache tests, all640 frontend tests, typecheck and lint). The actual current/Chromium69 font readback found no PDF font families left after close. These are earlier-source observations.

Virtualized view run42528889089 and integrated run42530108865 retained minimum-browser failures. Investigation found a real viewport/status feedback loop, corrected by overlaying transient status outside layout. Run42528891356 passed the five native cache tests, core detection tests and shared frontend/type/lint regression against695d6e40ff9f1f6a2cf68a31ce302b58276b60da. Run42529359763 stopped on a readiness expectation in a test; controls now remain disabled until the document is ready. Run42529836262 found governed Button className and PDF.js permission Set type mismatches; both were corrected.

The first complete composed reading journey found blank labels for unnamed annotations, an asynchronous page-task observation and last-page scroll clamping overriding explicit navigation. These are corrected in subsequent source. Run42531120454 reached all complete current-browser reading checks and then failed its debugger-context dynamic-code assertion: other worker script/fetch/child routes were denied and no native bridge existed, but debugger evaluation bypassed Function CSP. Worker readiness now obtains this observation from its normal realm and requires refusal. This is a corrected observation method, not evidence of a prior pass.

Android run42530111972 compiled and installed the new native print adapter but stopped at the earlier unstable text read assertion; it did not exercise print output. Native desktop run42530758291 and regression run42530923747 exposed an error conversion in opt-in probe setup, now corrected. Actual print, stream cache, complete native navigation and final candidate qualification remain pending. No PR review round has been consumed and no issue is closed.

## 2026-11-08: Complete current/minimum browser corpus and retained native findings

Focused run42535897974 against c5cc67b58fccb58d20c2a231d9aaf52509ec2894 passed42 PDF tests, resource/static-transform tests, typecheck/build and both actual current156.0.8078.47 and Chromium69.0.3497.0 browser journeys. Artifact13639257900 independently verified SHA25669869ac9e3d7fc03ddd4532bdb8421ef5d38156ddeea50214a2a390a50df7304. Both rendered embedded Courier Prime text and JPEG color, completed navigation/search/thumbnails/metadata, removed actual installed PDF fonts, denied worker imports/evaluation/fetch/child workers and had no native bridge. Malformed,10001-page,unsupported-encryption,above256MiB,password-rejected-then-decrypted and1000-page reduced-cache cases passed. RAF p95 was45.6ms current/16.9ms minimum with1active surface. This remains production-browser evidence with a synthetic native source boundary, not final native qualification.

Native desktop run42536069571 built all three packages but the probe exhausted Node heap while comparing large executable buffers before application launch. Replaced the comparison with bounded hash reporting and retained distinct package/built executable identities; compiled source and actual delivered runtime still require readback. No desktop reading pass is inferred.

Installed API24 run42536058242 retained two failed native print attempts after the composed reading journey and production native-store tests. Artifact13639622378 independently verified SHA256b5457e2d8ff03be77f22b504d27cba2e7ccfdf819a4cded17790c94537c65b65. Native begin/cancel occurred with no staged page or PrintSpooler. Inspection identified the print gateway requiring Blob.arrayBuffer, absent from Chrome69. Replaced it with cancellable FileReader reads and an actual FileReader regression. This attempt does not qualify printing, stream caching or final installed bytes.

Focused run42536526663 found a test-only typed-array mock signature mismatch. Run42536768277 passed the corrected contracts/type/build and then the new Axe checks found real light-theme PDF field contrast failures. The application selected the light theme without enabling the delivered kit's bb-light token scope. Apply that generated scope to the effective selected/system theme, including legacy media-query events, without editing kit tokens or palette. Keyboard/touch/Axe, hostile actions and native print remain pending reruns.
