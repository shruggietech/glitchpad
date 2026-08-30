# Research: Glitchpad v0.0.0 Technical Baseline

**Date**: 2026-08-30

## R1. Cross-platform application stack

**Decision**: Use Tauri 2 with a Rust core and host, a TypeScript 6 and React 19 shared interface, Vite 8, and a narrow Kotlin Android bridge.

**Rationale**: The product requires Windows, macOS, Linux, and Android binaries without Electron. Tauri 2 builds desktop installers and Android APK/AAB artifacts while using each platform's system WebView. Rust provides memory-safe native file and parser boundaries. The Web platform provides the strongest reusable ecosystem for CodeMirror, Markdown AST processing, PDF.js, and accessible document presentation. Kotlin is required only where Android's intent, provider, permission, and lifecycle APIs are native. One shared renderer layer prevents four behaviorally divergent applications.

**Alternatives considered**: Electron violates the project constitution and carries a bundled browser runtime. Flutter would provide broad platform coverage but would replace the mature browser-native editor and PDF ecosystems and move the native core to Dart or a larger FFI boundary. Compose Multiplatform would make Android natural but would require recreating or wrapping major renderer capabilities for desktop. A fully native Rust UI would force immature Android support or per-platform renderer implementations. A browser-only application cannot satisfy local file, association, Android intent, and offline packaging requirements.

**Primary evidence**: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), [Tauri distribution](https://v2.tauri.app/distribute/), [Tauri Google Play packaging](https://v2.tauri.app/distribute/google-play/), [CodeMirror system guide](https://codemirror.net/docs/guide/), [Vite requirements](https://vite.dev/guide/)

## R2. Version and toolchain baseline

**Decision**: Pin Rust 1.96.0 in `rust-toolchain.toml`, Node.js 24 LTS in `.node-version`, pnpm 10 in `package.json#packageManager`, TypeScript 6 and Tauri/React/Vite patch versions in `pnpm-lock.yaml`, and all Rust crates in `Cargo.lock`. Use repository-owned wrappers or manifests for Gradle, AGP, Kotlin, Android SDK, NDK, and build tools.

**Rationale**: Node.js 24 is the active LTS line while Node.js 26 remains Current on the decision date. Rust 1.96.0 is the organization baseline and supplies current stable compiler behavior. Exact patch versions belong in machine-readable authorities so contributor prose cannot drift.

**Alternatives considered**: Floating `stable`, `latest`, semver-only manifests without lockfiles, and prose-owned versions cannot produce reproducible builds. Node.js 26 is not LTS on the decision date.

**Primary evidence**: [Node.js release schedule](https://nodejs.org/en/about/previous-releases), [Rust 1.96.0 release](https://blog.rust-lang.org/2026/05/28/Rust-1.96.0/), [Android Gradle Plugin 9.3 compatibility](https://developer.android.com/build/releases/agp-9-3-0-release-notes)

## R3. Android baseline and document integration

**Decision**: Set `minSdk 24`, `compileSdk 36`, and `targetSdk 36`. Build universal debug APKs, split-per-ABI release APKs for direct distribution, and an AAB for Google Play. Support `arm64-v8a` on physical devices and `x86_64` on emulators at minimum. Model `ACTION_VIEW`, `ACTION_OPEN_DOCUMENT`, `ACTION_CREATE_DOCUMENT`, and `ACTION_SEND` through a Kotlin mobile plugin around `ContentResolver` and persistable URI permissions.

**Rationale**: Android 7.0/API 24 is Tauri's minimum. API 36 is the current stable target and the Google Play submission floor effective 2026-08-31. Android document providers expose capability-bearing URIs rather than reliable paths.

**Alternatives considered**: Raising the minimum above API 24 discards supported devices without a required API benefit. Treating provider URIs as paths fails for cloud, removable, and virtual documents. Copying every source to private storage breaks write-through behavior and obscures permission loss.

**Primary evidence**: [Tauri Android minimum and APK/AAB builds](https://v2.tauri.app/distribute/google-play/), [Android target API requirements](https://developer.android.com/google/play/requirements/target-sdk), [Android 16 SDK setup](https://developer.android.com/about/versions/16/setup-sdk), [Android SDK semantics](https://developer.android.com/guide/topics/manifest/uses-sdk-element)

## R4. Document ownership and persistence

**Decision**: Keep native source handles and external revision facts in Rust. Keep active renderer state and editable text buffers in TypeScript. Every mutation carries a monotonically increasing session revision. Saves submit expected external and session revisions to Rust, which rejects stale writes and performs atomic replacement on desktop or descriptor-based write-through on Android. Store preferences and recovery records as versioned JSON in application-private directories; use no database.

**Rationale**: CodeMirror must own its editor state for responsive editing, while source authority and data-integrity checks must remain outside the WebView. Revision preconditions prevent accidental overwrites. The persisted data volume and query shape do not justify SQLite.

**Alternatives considered**: Keeping all bytes in Rust would create a high-frequency bridge for editing. Keeping source handles and saves in TypeScript would require broad filesystem privileges. SQLite adds migrations, native packaging, and corruption surface without relational requirements.

## R5. Markdown and text renderer

**Decision**: Use CodeMirror 6 for editing and syntax highlighting. Use unified with remark CommonMark parsing, GFM extensions, footnotes, remark-to-rehype conversion, and `rehype-sanitize` for rendered Markdown. Raw HTML is disabled. Fenced Mermaid diagrams render locally with Mermaid strict security settings and no network access. Language packages load lazily from CodeMirror language metadata; detection combines extension, filename, shebang, modeline, and bounded content evidence with user override.

**Rationale**: CodeMirror is modular and supports dynamic language loading. The unified AST pipeline allows explicit sanitization after unsafe transforms. A single parser pipeline avoids inconsistent preview and metadata behavior. Local Mermaid support is valuable for technical Markdown and remains safe only behind strict sanitization and disabled remote resources.

**Alternatives considered**: Multiple selectable Markdown engines create inconsistent output and testing. Rendering raw HTML creates active-content risk. Highlight.js duplicates CodeMirror's language and highlighting work. Monaco carries a larger IDE-oriented surface and bundle.

**Primary evidence**: [CodeMirror guide](https://codemirror.net/docs/guide/), [CodeMirror language data](https://github.com/codemirror/language-data), [rehype-sanitize security guidance](https://github.com/rehypejs/rehype-sanitize)

## R6. Image renderer and metadata

**Decision**: Use Rust `image` with explicit codec features for bounded raster decoding, `ico` for multi-entry icon inspection, `kamadak-exif` for EXIF, and `resvg/usvg` for script-free SVG rendering. Prefer system WebView decoding only as a presentation fast path after native identification and budget checks. WebP is a required format; a separate `libwebp` native dependency is not required.

**Rationale**: Pure-Rust codecs reduce platform build dependencies and permit consistent bounds. The image crate supports WebP and ICO, while a dedicated ICO parser exposes every embedded size. `resvg` avoids executing SVG scripts or loading remote references.

**Alternatives considered**: Bundling `libwebp` adds C toolchain and patching obligations without a demonstrated compatibility gap. Directly inserting untrusted SVG into the DOM violates the active-content boundary. Relying exclusively on system decoders produces platform-dependent support and limited metadata inspection.

**Primary evidence**: [Rust image crate formats](https://docs.rs/image/latest/image/codecs/), [kamadak-exif](https://docs.rs/kamadak-exif/latest/exif/)

## R7. PDF renderer

**Decision**: Use the PDF.js display layer and worker, wrapped in Glitchpad's own compact renderer. Implement page virtualization, text search, thumbnails, outline navigation, page labels, internal links, zoom, rotation, and printing. PDF editing, form submission, JavaScript, embedded-file launch, and external network access are prohibited.

**Rationale**: PDF.js is Apache-2.0, renders in the shared WebView, exposes document information and outlines, and avoids a native PDF engine per platform. Its display layer supports a purpose-built minimal UI.

**Alternatives considered**: Embedding the generic viewer introduces excessive UI and weak shell integration. Native platform viewers diverge in features and Android behavior. GPL PDF engines conflict with the dependency policy.

**Primary evidence**: [PDF.js getting started and license](https://mozilla.github.io/pdf.js/getting_started/), [PDF.js API](https://mozilla.github.io/pdf.js/api/)

## R8. DOCX and OpenDocument renderers

**Decision**: Use Mammoth for DOCX semantic HTML, followed by the same sanitizer used for Markdown. Promise semantic readability, heading navigation, links, tables, lists, images, footnotes, and core properties rather than page-perfect layout. Implement ODT as a bounded semantic parser over the OASIS OpenDocument 1.4 package and XML schemas using Rust `zip` and `quick-xml`, then emit a renderer-neutral document tree. Reject macros, scripts, formulas, tracked-change editing, external resources, and encrypted packages in the first viewer versions.

**Rationale**: Mammoth deliberately maps semantic Word structure to clean HTML and carries a permissive license. ODT lacks an equally suitable maintained cross-platform renderer; a constrained standards-based reader avoids server conversion and opaque office-suite embedding.

**Alternatives considered**: LibreOffice headless conversion adds a large external executable and differs across hosts. Cloud conversion violates offline and privacy requirements. Page-perfect browser recreation is not credible for the first office renderers. Unmaintained ODF JavaScript libraries are not acceptable foundations.

**Primary evidence**: [Mammoth semantic conversion](https://github.com/mwilliamson/mammoth.js/blob/master/README.md), [Mammoth license](https://github.com/mwilliamson/mammoth.js/blob/master/LICENSE), [OpenDocument 1.4 standard](https://docs.oasis-open.org/office/OpenDocument/v1.4/)

## R9. Security boundary

**Decision**: Deny network connections in the application WebView by default. Use a strict content-security policy, no remote script/style/font/image sources, no raw HTML, no SVG DOM insertion, no PDF JavaScript, no office macros, no generic filesystem command, and no shell execution. Expose opaque source handles and narrowly scoped Tauri capabilities. Enforce renderer-specific byte, pixel, page, archive-entry, expansion-ratio, recursion, time, and memory limits.

**Rationale**: Every document is untrusted and renderer output shares a privileged application WebView. Tauri capabilities are effective only when broad plugins and overlapping capability sets are avoided.

**Alternatives considered**: Relying on extensions and MIME types, broad filesystem plugins, permissive `connect-src`, remote asset loading, and generic shell commands all widen the attack surface without core product value.

**Primary evidence**: [Tauri capabilities](https://v2.tauri.app/security/capabilities/), [rehype-sanitize security guidance](https://github.com/rehypejs/rehype-sanitize)

## R10. Tabs, windows, sessions, and recovery

**Decision**: Use one application window and one compact tab strip on desktop, with a compact tab-count switcher on phones. Limit ordinary sessions to 32 tabs. Opening the same stable identity focuses its existing tab. Routine session restore is disabled; abnormal-termination recovery is enabled. Recovery snapshots are private, revisioned, retained for seven days, removed after a confirmed save or discard, and presented only when applicable.

**Rationale**: Tabs solve multi-document work without creating window or workspace management. Default session restoration can obscure the explicitly opened file and retain sensitive filenames. Crash recovery protects edits without turning the application into a workspace.

**Alternatives considered**: Multiple windows multiply lifecycle and second-instance complexity. Unlimited tabs create uncontrolled memory growth. Automatic restoration of every previous tab conflicts with file-first launch behavior.

## R11. Capability activation and roadmap

**Decision**: v0.0.0 ships documentation only. v0.1.0 requires Markdown/text, tabs, metadata, recovery, and all four platform artifact families. Image inspection targets v0.2.0, PDF v0.3.0, DOCX v0.4.0, and ODT v0.5.0. A feature can move earlier only through its own Spec Kit slice and complete acceptance evidence; version numbers may consolidate but dependency order cannot be bypassed.

**Rationale**: The stable core delivers the highest-frequency jobs and validates the architecture before parsers multiply. A versioned capability matrix prevents roadmap claims from becoming support claims.

**Alternatives considered**: Shipping all renderer families together delays daily value and multiplies security/debugging scope. Marking architectural plans as experimental support would misrepresent v0.0.0.

## R12. Testing and evidence

**Decision**: Use contract tests for source and renderer interfaces; golden and corpus tests for formats; property and fuzz tests for detection, text round trips, archives, and parsers; Vitest/Testing Library for shared UI; Playwright and axe-core for renderer and accessibility behavior; native adapter tests on each desktop host; Android JVM, emulator, and physical-device tests; and install/open/save/uninstall smoke tests for final packages. Every capability row links to evidence.

**Rationale**: Browser-only tests cannot prove native file semantics, and native-only tests cannot efficiently exercise renderer UI. Contract tests allow platform adapters and renderers to share expectations.

**Alternatives considered**: Test-count targets do not measure risk. Manual-only sample opening is not repeatable. End-to-end-only testing is slow and poor at parser edge cases.

## R13. Contributor command surface

**Decision**: Provide `cargo xtask doctor`, `bootstrap`, `check`, `test`, `docs`, `package`, and `release-check`. `xtask` validates external tools and invokes locked `pnpm`, Cargo, Gradle, and documentation commands. CI calls the same commands. Release-only credentials are detected only by `release-check`.

**Rationale**: A Rust orchestration binary works across supported hosts, can parse machine-readable version authorities, and prevents long platform-specific command lists from drifting.

**Alternatives considered**: Shell-only scripts fragment on PowerShell, Bash, and macOS. A Makefile adds platform assumptions. A task runner adds another tool before the repository can validate tools.

## R14. Packaging and updates

**Decision**: Publish Windows x64 NSIS installer and portable ZIP, macOS universal DMG, Linux x86_64 AppImage and Debian package, Android universal APK plus split ARM64 APK and AAB, SHA-256 checksums, signatures where the platform supports them, CycloneDX SBOM, provenance attestation, `LICENSE`, `NOTICE`, and third-party notices. Do not implement an in-app updater in v0.1.0; use signed release discovery and platform-store updates.

**Rationale**: The artifact set covers direct installation and store delivery while preserving a straightforward manual recovery path. Deferring the updater removes a high-trust network and signing subsystem from the first binary release.

**Alternatives considered**: MSI and additional Linux package families duplicate first-release effort. Unsigned official artifacts weaken user trust. Introducing automatic updates before signing and rollback mechanisms mature creates avoidable risk.

## R15. License and dependency governance

**Decision**: License original project code and distributable original assets under Apache-2.0. Automatically allow Apache-2.0, MIT, BSD-2-Clause, BSD-3-Clause, ISC, Zlib, Unicode-3.0, CC0-1.0, and 0BSD dependencies with provenance. Require explicit Spec Kit and legal-obligation review for MPL-2.0, LGPL, fonts, media, standards fixtures, and any license outside the allowlist. Prohibit GPL, AGPL, SSPL, Commons Clause, Business Source License, non-commercial, no-derivatives, source-available, custom ambiguous, and unlicensed dependencies in distributed artifacts.

**Rationale**: A small permissive allowlist supports Apache-2.0 distribution and automated review. File-level copyleft and special asset licenses need case-specific notice and source-delivery analysis. Strong and network copyleft conflict with the intended distribution posture.

**Alternatives considered**: Manual release-only review detects problems too late. Treating every open-source license as equivalent ignores distribution obligations. Requiring Apache-2.0 dependencies only would unnecessarily exclude mature permissive libraries.

## R16. Release and documentation authority

**Decision**: The root Rust workspace version is canonical after repository foundation. Tauri, npm, Android, technical-specification, changelog, and tag versions mirror it and are checked automatically. Every pull request carries a documentation-impact declaration. Every release runs a reconciliation pass over completed Spec Kit slices before the tag is created. Changelog fragments avoid concurrent edits to the root changelog.

**Rationale**: One source prevents independent version drift. Reconciliation before tagging allows the release workflow to remain read-only toward the default branch.

**Alternatives considered**: Independent package versions create no product value in a single application. Letting release CI rewrite documentation produces unreviewed release commits. Editing one changelog block from concurrent branches creates conflicts.

## R17. Documentation conventions

**Decision**: Use one physical line per prose paragraph, UTF-8 without BOM, Mermaid for material diagrams, `flowchart TB` and `direction TB` for flows, no normative ASCII diagrams, primary-source links, and requirement keywords defined by RFC 2119/8174 semantics. Validate Markdown, anchors, links, diagrams, spelling terminology, encoding, and product-version consistency in CI.

**Rationale**: These conventions keep formal documents readable, renderable, machine-checkable, and consistent with project law.

**Alternatives considered**: Fixed-column prose wrapping creates noisy edits. Horizontal flows exhaust viewport width. Decorative diagrams and secondary-source references reduce verification value.
