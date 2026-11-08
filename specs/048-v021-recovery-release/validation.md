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

### Android upgrade identity correction

The prior main Android contract and v0.2.0 overlay both use version code 1004. The v0.2.1 preparation now increments that code to 1005 in the overlay and package contract, and the installed-evidence validator consumes the current contract. The existing version guard now compares overlay/contract names and codes. Historical receipts remain unchanged; diagnostics already built with code 1004 remain diagnostic evidence only. Fresh v0.2.1 package qualification must observe code 1005.

### Focused transport and formatting checks

At source 92c41db03cfbb5c518f7ca1a97d174e9b6f859a8, focused staging/transport run 42498939271 passed 88 tests with zero failures or skips, including the actual Bash-runner regression that refuses to enter instrumentation after supporting ADB failure. Public run 42499160684 on af67469a91b9ae4cbe6fdac5e1e9f1ed04bb30ba passed 61 public checks and existing configuration/version/public-surface guards. Its three generated documentation outputs were byte-identical to the checked-in files. Scoped formatter run 42499158753 produced six leased outputs; archive 13624727491 was independently hashed as 6e28a8b4611214981c65c562ea7236a8477bdb3b31a6321b76e99c77cf66e19d, and every before/after digest and byte count matched before applying them in f6f162329316374c2fa57d580750d5fe837e6b2e. Public archive 13624837000 independently matched SHA-256 4b69d66b394fa54b1a49190f264c40d8a053e471825781bd613b01633087879c.

Full branch-source CI run 42499313508 uses f6f162329316374c2fa57d580750d5fe837e6b2e with the complete four-role/API debug matrix. PR #263 is draft, unmerged and has auto-merge disabled. External round one was requested explicitly for that source; all complete native and accepted-input evidence remains pending and blocking.

### Startup gate passed on both governed APIs

Stable-key diagnostic run 42498880717 at source 92c41db03cfbb5c518f7ca1a97d174e9b6f859a8 passed both API24 and API36 on attempt one. Independently downloaded archives 13624951605 (SHA-256 51991e385085d566a28ae2eda612340fe5644e722ce309b852f29c09001f4aab) and 13625550830 (SHA-256 1a7bc17d47b65a923551f5beb88b557b6f3f129d6b924e6a3ac2bd1782dbcec2) contain matching installed application SHA-256 20bd58f4e0167eddc88d97c144e4046cc5f39fcdf2fa58880f2e7940b4ff3812 and test SHA-256 10ad551b7a39695dd5486595df35c00e48ff47716f2db88e13bec5c9167a4187. Both were rehashed independently, together with receipt/marker/screenshot bytes and clean raw instrumentation completion. API24 actually loaded Chrome 69.0.3497.100; API36 loaded Android WebView 133.0.6943.137. The product is nondebuggable and the test-owned capture package is debuggable. Input archive 13625022023 independently matched SHA-256 4d54ec97e9cabcad04c6971c744632fb3ad59cce6b72573abf027061bcdf8c71.

These are explicitly diagnostic_only true / candidate_qualified false, version 0.2.1 with the prior diagnostic code 1004. They establish the ABI/startup/capture prerequisite, not full release behavior or current code-1005 bytes. Back/About compatibility remains a required bounded case in the full release campaign, alongside all other declared tasks. T016 sequencing is made explicit accordingly; no coverage is removed. Complete minified qualification now runs on source f6f162329316374c2fa57d580750d5fe837e6b2e with code 1005.

A data-only sanity pass over 106 changed text files found no invalid UTF-8, BOM, mojibake patterns or non-TB Mermaid directions. Current source, full native campaign and accepted-input qualification remain separate gates.

### First review and Windows byte readback

External review round one completed on f6f162329316374c2fa57d580750d5fe837e6b2e with no findings or unresolved findings, as recorded by the Codex review-state receipt in PR #263 comment 6723959593. No second request has been made.

Current-source Windows run 42499454644 passed. Artifact 13624932859 independently matched its 22956221-byte archive and SHA-256 e80eca095e5a7745e2f41d365511d9384088da406ea3bb926bf289e50b8e8176. Installer bytes independently match 6255170 / bb81e03a5574b13da7c6743d0999ad8025ba836629defc0c6b75cd3c810999e4; portable ZIP bytes match 8034738 / 569950d30c46efd88e40b02d2cf1aad8ab09cfdb6bdcdc917e5e2ef44092318c. Both installed and portable native lifecycle receipts identify source f6f162329316374c2fa57d580750d5fe837e6b2e and exact staged manifest SHA-256 8cb14fd0848e3b6fb9f063728ef381d678a4a126c5775b39caaf68da5dc610a4. Required practical-use and four scaling observations passed; community binaries remain unsigned and unpublished.

### macOS historical baseline schema regression

Run 42498942891 built its staged package successfully, but both native jobs stopped before launch and produced no comparison or lifecycle receipt. ARM64 job 128791143847 retained the terminal startup_comparison_failed log; no receipt artifact was available because the failure preceded journal creation. The comparator validates the immutable v0.1.4 published baseline using the shared manifest validator. S048 had made the new publication_context key unconditional for every official manifest, incorrectly applying the current staging schema to that historical contract.

The original published evidence archive was independently downloaded and verified as SHA-256 9fe15e6a216789eae5e595e8aa6a4ef41cd4bace286f23b6b84b799e9c3e681a. Its unmodified 3530-byte manifest has SHA-256 7d8c8b409117542605ad26fe69b54aae0150466433cfd1a385663dc525f5d1ff and no staging-context field. The validator now derives that required key and value from the selected contract. A regression uses the actual historical manifest, refuses added staging context under its old contract, and continues to reject missing or incorrect context in current staging. Historical files are not rewritten. Focused execution and fresh native qualification are pending.

### First complete minified campaign attempt (source f6f1623)

Run 42500118992 built the code-1005 canonical release/test pair. Both APIs passed delivery on attempt one. API24 additionally passed authoring, recovery seed and exact recovery verification on attempt one. The complete campaign failed: both API24 Back/About attempts selected disabled File information on an unsaved draft, and both API36 authoring attempts observed a served editor without a visible IME window. These are not complete-release passes. The API24 archive 13625776706 independently matched SHA-256 4dce11f6d0102b10013da9f0dd70996daaae04f10975af21e77e3f18c54d8769; API36 archive 13625234032 matched SHA-256 c58946927679a634ee517c73c7500052547689e0dbd36d334219010a8af1f6f0. All attempts and capture-validation failures are retained.

The Back fixture now opens the supported Preferences task, positively observes its actual dialog heading, sends native Back, positively observes dismissal and independently rechecks every draft byte. About/version/source/offline notices remain required. The release emulator now sets and reads back the same hardware-keyboard visibility setting used by debug CI, retaining the default IME identity; the native test still requires the actual served editor and visible IME before input. No production behavior or timeout changes.

Startup and the full Back/About case share that verifier. A full release job first executes a distinct diagnostic startup/Back/About/offline capture against its same canonical app/test build, then runs all five complete cases. The diagnostic summary is named startup-diagnostic.json and remains diagnostic_only true / candidate_qualified false; it cannot be counted as either complete API summary. This provides the demonstrated preflight before the long campaign without another product build. All new paths still require actual governed-API execution.
