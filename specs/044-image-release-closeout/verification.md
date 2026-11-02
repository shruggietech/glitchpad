# Verification: S044

## Scope and dependency disposition

Cargo PR #240's six updates are integrated, including 27 changed/new transitive registry identities. The fuzz lock aligns roxmltree 0.21.2, serde_json 1.0.154 and schemars/schemars_derive 1.2.3 with the application. Existing licensed Linux zbus 6 plugin patches remain unchanged. SVG preflight rejects depth above 128 before DOM parsing; the upstream parser fix does not demonstrate product exposure.

npm PR #226 is partially integrated: React/ReactDOM 19.3.1, DOMPurify 3.4.17, CodeMirror autocomplete 6.20.4/view 6.43.15, Next 16.4.3, Vite 8.3.5, Vitest 5.0.5, ESLint 10.14.0, markdownlint-cli2 0.24.0, Zod 4.6.7 and Puppeteer 25.16.0. Narrow transitive pins repair undici, ip-address, basic-ftp, source-map-js, KaTeX, Sharp, smol-toml, re2js and minimatch advisory paths. Fumadocs, Playwright, Tauri CLI and unrelated upgrades remain deferred, preserving their existing runtime/adapter contracts. #226 remains open. All four package notice files retain upstream license texts for the 48 selected changed Cargo/npm identities; exact upstream or canonical SPDX sources and raw-byte hashes are retained in the notice-source inventory.

The full JavaScript audit initially reported 50 findings (2 critical, 16 high, 25 moderate, 7 low); the corrected graph reports zero across 954 dependencies, with no suppression. Aggregate/shared CI now enforce the existing moderate-or-higher advisory threshold over the complete workspace graph. GitHub's 62 default-branch alerts are a separate pre-merge state and have not been dismissed or claimed closed.

## Local validation

The corrected-graph aggregate gate passed with exit 0 (retained log: .tmp/s044-aggregate5.log), and the Windows visibility/retention follow-up aggregate also passed (s044-aggregate6.log), including Rust formatting/Clippy/native tests, Cargo advisory/license/source policy, npm audit, frontend 305 tests, site browser/unit tests, package/brand/image/Mermaid policies, documentation formatting/lint/link checks and UTF-8 validation. Community release policy passes 31 tests; the fuzz valid-seed test reaches actual pixel decoding with the aligned lock. The readiness script passes declaration/evidence-presence checks only, which does not establish native qualification or publication.

Focused failures demonstrated missing sampler behavior, invalid incomplete-campaign/reference passes, and a brittle Windows fallback mutation target before their repairs. Sampler/comparison tests retain every failure phase and verify real child-process cleanup. Windows diagnostics reject arbitrary scenario values and omit hostile extra title/path/argument fields. The affected Windows/macOS package policy suites pass 22 tests after the failed-artifact naming correction.

Earlier aggregate attempts exposed a Puppeteer image/workspace browser mismatch, then the Windows mutation ambiguity, then hash-prefixed prose rejected by Markdown lint. Those defects were repaired without disabling assertions. The final Dockerfile pins Puppeteer 25.16.0, and the reusable qualification image glitchpad-validation:s044-security built successfully. Local native UI was never launched on the owner's desktop.

## Implementation campaign at 8f1437f

The exact source is 8f1437fd0ec3484a2b06b3304f24b7feef92ffef. Eight retained package payloads pass independent byte-size/SHA-256, manifest, checksums, provenance and source-bound CycloneDX checks: Windows installer/portable (run 41526174819), Linux AppImage/deb (41526175058), macOS universal DMG (41526174918), and Android ARM64 APK/universal APK/universal AAB (41527010894). Android inventory identities and candidate signature-status records agree with the payload bytes. These are candidate artifacts, not published release assets.

Four Linux receipts bind the same package manifest/source on Ubuntu 22.04/24.04 for deb/AppImage. Both macOS architecture receipts bind the universal package and pass native lifecycle/cleanup assertions. Windows branch-head installed/portable receipts retain twelve successful startup diagnostic rows. These automated results do not claim the receipts' explicit not_run_candidate manual rows were performed.

### Paired macOS startup and issue #239

All twelve attempts per architecture are retained, including first launch, five later process restarts for each package, phase timings and cleanup. The profile is the same hosted runner/shared profile with no OS-cache reset; AB/BA later ordering does not remove first-launch ordering/cache effects. The exact v0.1.4 baseline binds source 1d7dcd46689fb0ea68e4cee5c3d43a06d94bc94b and DMG SHA-256 0d116cf8f8d0528e2d84f54adc934a3368f9d221b07935bb8324d2213a8bfcff.

| Native host | Package | All-sample p95 ms | First launch ms | Later-start p95 ms | Reference classification | Hosted smoke |
| --- | --- | --- | --- | --- | --- | --- |
| ARM64, macOS 15.8.2 / 24H232 | v0.1.4 baseline | 4282 | 4282 | 2223 | failure | pass |
| ARM64, macOS 15.8.2 / 24H232 | S044 candidate | 2318 | 2318 | 2063 | warning | pass |
| Intel, macOS 15.7.9 / 24G830 | v0.1.4 baseline | 8574 | 8574 | 1457 | failure | pass |
| Intel, macOS 15.7.9 / 24G830 | S044 candidate | 2103 | 2103 | 1284 | warning | pass |

Both hosts report WebKit 20621. Baseline first-launch process discovery took 1828 ms ARM64 and 3235 ms Intel, versus candidate 281/307 ms; shell-ready endpoints were 4282/8574 versus 2318/2103 ms. Baseline later restarts are much faster. This demonstrates a first-launch/profile limitation and does not isolate a causal product regression, OS component, or candidate speedup. Fixed campaign order and shared caches limit that attribution. The demonstrated measurement defects were lost failure receipts and late PID ownership; focused regressions now cover persistence and cleanup. Reference thresholds remain 1500/2500 ms and hosted-smoke ceiling remains 10000 ms. No first sample is discarded, and no reference-hardware pass is claimed. #239's follow-up is dispositioned by the retained comparison and measured limitation, subject to final candidate checks.

### Windows and Android observations for issue #66

The Windows PR run 41526182894 first timed out waiting for a named UI element after 20320 ms. The retained diagnostic shows a live process, process state available and a main window present; it does not confirm the proposed hidden-window/MainWindowHandle hypothesis. The failure archive (artifact 13179704008, SHA-256 45f88cb9473804374306332eaa1bfa330cf89388a2aa1080b19b6732223f78cf) remains retained alongside the successful branch campaign. Exactly one failed-job retry was requested with timeout/assertions unchanged. The single retry also timed out at clean launch (20230 ms), again with a live process and a main-window handle. Its archive is artifact 13181916711 (SHA-256 ee7bc2ecd6679c3c48bc035480d770058de3c92ae0ca300743368ab30c45686b). No further retry of that source was requested. All six primary UI Automation targets were explicitly launched hidden; their hosted-CI launch precondition is corrected to normal visible windows, retaining hidden secondary single-instance delivery and hidden console launchers. Nullable window-visibility/accessibility-descendant booleans now distinguish unavailable observation from false. Policy and diagnostic regressions fail before the correction and pass after it. This corrects a demonstrated harness precondition, without claiming that it proves the old timeout cause. Timeout and content/geometry assertions remain unchanged. Both API 24 and API 36 connected provider/resolver suites report eight tests with zero failures/errors/skips. Each completed the existing AppFrame geometry marker but then reported process termination before the added second test completed. Their green jobs do not establish two completed AppFrame tests. The diagnostic allowlist assertions now run before activity launch in the original native flow, and its final marker records callback_diagnostics_contract: pass. Final-source API 24/API 36 markers and runner outcomes remain pending; the earlier partial execution is retained.

## Final-head authority and publication boundary

Review round 1 completed on eabb985 with zero findings. The final authorized round has not yet been requested. There is no separate security-bot receipt. Final-source CI, review disposition, regenerated package/native readback and the convergence result will be bound in the official PR #241 conversation and .tmp/s044-candidate-handoff.json after their actual completion. The implementation-campaign measurements above must not be relabeled as later-head artifacts.

The final external receipt avoids a self-referential tracked source hash. Any later source commit requires fresh package/source binding and current-head CI before owner handoff. #66 remains open for non-waived manual package-flow criteria. The owner-removed physical-device/manual screen-reader gates remain removed, and no such testing is claimed. #76/#10 retain publication-dependent acceptance criteria. No owner merge, tag, official release or Pages deployment is performed or authorized here.
