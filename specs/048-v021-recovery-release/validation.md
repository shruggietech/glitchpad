# S048 validation record

Entries are chronological. A checkpoint pass qualifies its named source and scope. The final PR confirmation will bind the frozen handoff source and fresh complete campaigns. This session stops unmerged and unpublished.

## 2026-11-08: Baseline and workflow initialization

Merged main source 7cfe950988f86ad8f186fd5c01ed568b238e495b has the same tree as qualified S047 final source debdeb8fe88bc16c240c0c1b06625e375124833c. All ten implementation/qualification children #245-#254 are closed; #244/#255 remain open. Latest public release was rechecked as v0.2.0. Its fourteen assets and historical receipts remain unchanged. No v0.2.1 tag or release was created.

Docker client 29.9.2 cannot connect to the unavailable desktop-linux engine. WSL lacks Node/pnpm/Cargo and reports failed mirrored networking/DNS. Actual phase/tool commands run on isolated hosted Linux. Local data edits and hidden approved VCS are used; direct Windows project tooling is not used.

Clarification initialization run 42483886864/artifact 13618214540 passed at 38dbad3. Its independently checked ZIP SHA-256 is f85c1c5254122da026b6f504e1dc2f8c9b9edc84aa1c33db71113857b7c0e750. No critical clarification was needed; the quality checklist passed 16/16.

Plan wrapper run 42484029466 failed after setup-plan copied its template because an unset PowerShell native exit variable was treated as nonzero. Its log is retained; no product tests ran. The corrected wrapper initializes the variable before invoking the actual script and retains nonzero rejection. Run 42484107732/artifact 13619011447 passed; independently checked ZIP SHA-256 is 40ec283823a887e76b3d438cd162917c725304991202bc9318d96b93a37a4ca3.

Tasks initialization run 42485441929 passed at 2cd34fd. Analysis initialization run 42485772867 and implementation initialization run 42485997298 passed at f07bdd0. Read-only cross-artifact analysis covered 17 FR, six SC, twelve scenarios, 32 tasks and eight principles with zero findings and complete requirement mapping. Core artifacts remained byte-identical during analysis; checklists passed 16/16. Scoped ignore files were adequate.

Three unnecessary preimplementation package builds were cancelled and retained diagnostically. They do not qualify a candidate. The isolated phase branch removes unrelated package workflows.

## 2026-11-08: Focused release foundation

Run 42486824838 passed on public source 8599e87b4577d0f23e040b7838c7013a82cc0d53. It executed 25 release-identity/community-policy tests (25 pass, zero fail/cancel/skip), checked current public/config/platform JavaScript syntax and parsed both PowerShell version/public-surface scripts. Artifact 13620215298 independently read back as ZIP SHA-256 00091644a7b505eb7fe8bd7231e5b54ca079d3e6d7a4f2fbb9d217586bc5449c, matching its metadata and source.json.

Intermediate source commits defer automatic heavy pipelines. Explicit focused dispatches validate them; the final unskipped candidate must receive every required gate.

## 2026-11-08: Focused public contracts

Run 42489310881 on 34a94ca retained two stale test-expectation failures. Artifact 13620997054 independently read back as ZIP SHA-256 9e0cf4f0914dfa751bed6099410c9fda5a4420e23b33b826a8f7c00dc9e8980e. Existing tracked documentation outputs were generated on hosted Linux and applied only after before/after hash checks.

Corrected source 1555a1bfb197c4138ea4e6f80350bd8f6bb09b41 passed all 61 public/site contract tests plus current public, configuration, version and public-surface guards in run 42489460920. Artifact 13621071994 independently read back as ZIP SHA-256 8d2cdb7aa14bc12ea9baeec6c722dab94c6bb0e77b3a9d47a8feaac9fb178461. Unchanged generated outputs were left unchanged. No full site build or native qualification is inferred from this focused pass.

Source 00a215e16c292813e1524e29d26764fef10837b5 passed 30 release-policy/identity/runtime-evidence tests and JavaScript, PowerShell and bounded-runner syntax checks in run 42490018905. Artifact 13621356427 independently read back as ZIP SHA-256 1db15a1c61605d3a303186ce0d9dff2e6a61bf09e3137ef58538d54e39d091b0.

## 2026-11-08: Focused staging and release startup

Staging regression run 42491309752 at 6629ac2 retained one malformed-command rejection failure. A YAML boolean command raised a type error rather than the intended policy error; the guard now checks the command type before inspection.

Android run 42489999123 at 00a215e built the canonical minified, nondebuggable universal/ARM64 APKs and AAB, matching-signature test APK and package inventories successfully. Both API24/API36 installations succeeded. Instrumentation crashed before any journey because test callers used an app-optimized Kotlin ABI; Trace was also missing. Each API retained both attempts. Failed runtime archives 13622200517 and 13622031045 independently read back as ZIP SHA-256 e1b3540bec8f5f9e634720fbbf272270ef1e09d1050df78e92a31512e373a4b9 and 6eea360f0fb7b76476e53fcc40f584f5e756187c80af8591d7a140cd9a5806a7. Matching input/mapping archive 13621353825 read back as ebd1f87db6999ed5f73f66d524e35277d672b827d484a54905b73a5ee0f8e647. This is failed test-runtime evidence, not release qualification.

Corrected source 9dd4d5df21103183a4479755ad8479d8991b7273 passed all 85 staging/package/accepted-input/assembly/runtime regressions and current community/config/macOS/Linux policy checks in run 42491497394. Exact bundled BrandBuilder 2.0.3 verification reported zero failures and zero missing-input skips. Glyph validation reported four checks, four existing provenance/command warnings and zero failures; the warning text explicitly identifies skipped remaining geometry measurements. The imported historical glyph source remains unchanged. Artifact 13621552913 independently read back as ZIP SHA-256 b05cafa1c721dc94600b28462ee6084cd9ed1202fe6fb0d04a669c7516ebc687.

Isolation wrapper run 42493129440 at 70833e0 caught a JavaScript text-generation syntax error before running Gradle. The validator was restored from the known baseline and edited through checked literal splices. This failed run remains diagnostic.

Corrected source 6eb90346ade55cfa1faa0541f58252f506c43517 passed all eleven accepted-input/capture regressions and the standalone JVM isolated-runtime ABI regression in run 42493490718. The JVM test executes the relocated Kotlin null-check ABI with a platform-only parent classloader, verifies namespaced Trace/resources, rejects missing Trace and checks deterministic bytes. JUnit reports one test, zero failures/errors/skips. Artifact 13622049879 independently read back as ZIP SHA-256 15d28f9768159c228ad9b61ae78813de97daa3e81df577f6ae630d0998a7f3fd.

Stable-key startup diagnostics on API24/API36 are pending. They use distinct jobs/artifacts and set diagnostic_only true and candidate_qualified false. Full release-runtime, complete debug-role matrix, final source checks, staged desktop native campaigns and final artifact readback remain required.

### Third startup diagnostic (source 1eb6175)

Run 42496745516 built the matching signed release/test pair and passed DEX isolation and canonical APK immutability checks. API24 reached the actual application and failed a test-context debug-flag observation; API36 completed startup, screenshot and installed APK capture, then the validator rejected the actual contract version code 1004 because its new fixture incorrectly expected 2001. Neither role qualifies. API24 archive 13624306793 (SHA-256 6ee79fbde3d9861605b7cdbe4359ec0e7f5dfd8074ff1b519217f8c6551b937f) and API36 archive 13624331725 (SHA-256 caee302992faf74cf99b9faa8b851bb517bb27b1f1f3f93558e07c219de01646) were independently read and retained. The observer now queries test ApplicationInfo through PackageManager, including its installed APK path; the validator derives the version code from the Android package contract. Raw instrumentation output is requested explicitly with -r so terminal completion remains independently observable. Regression checks reject a missing completion code and incorrect version code. These changes still require execution.
