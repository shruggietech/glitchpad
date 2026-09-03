# S013 Verification

## Environment

- Date: 2026-09-02
- Host: Windows 11, x86_64, America/New_York
- Toolchain: Rust 1.96.0, Node.js 24.11.0, pnpm 10.28.2, TypeScript 6.0.2, Chromium from the pinned Playwright workspace dependency
- Fixture corpus digest: `21acd6d9515448b973b582e184ee8dc644350d284bb03ad5dc9afa71d0ccd703`

## Automated evidence

- Focused Rust editor policy: 8 passed, covering exact 32 MiB and 256 MiB boundaries, extreme lines, evidence conflicts, session overrides, extensionless shebangs, bounded evidence, and plain-text fallback.
- Frontend package gate: lint, strict typecheck, 12 test files with 74 tests, and the production Vite build passed.
- Editor component evidence mounts editable and read-only CodeMirror instances, projects a real CodeMirror transaction through the revision-bound raw-shadow model, disposes the instance, invokes editor commands, and publishes a session language override.
- Round-trip evidence covers UTF-8, UTF-8 BOM, UTF-16 LE BOM, UTF-16 BE BOM, CRLF/LF/CR mixtures, terminal newlines, dominant insertion newlines, stale serialization, invalid/overlapping edits, read-only denial, and 1,000 generated transactions.
- Large-text evidence caps host reads at 256 KiB, caps rendered windows at 512 KiB, decodes a multibyte character split at a chunk boundary, finds a match across a chunk boundary, retains at most 10,000 matches, navigates LF/CRLF/CR lines, and mounts a source-backed read-only component with search and navigation.
- Accessibility regression evidence passed the existing axe-core critical/serious gate after naming the CodeMirror textbox. Controls provide labeled inputs, keyboard paths, and 44 px large-view touch targets.
- A headless 320 by 640 Chromium smoke test opened the editable text session, entered `Ω`, observed dirty shell state, opened the CodeMirror search panel, retained one mounted editor, kept the body width at 320 px, and recorded zero off-origin network requests.
- The final repository aggregate validation passed Rust formatting, clippy, Rust tests, schema tests, documentation tests, dependency advisories/bans/licenses/sources, frontend checks, brand checks, the site build and browser tests, configuration, Markdown formatting and linting, link and Mermaid validation, version consistency, UTF-8/no-BOM and mojibake scanning, public-surface policy, and repository metadata checks.

## Performance evidence

The deterministic release-data harness applied 40 single-character transactions to a representative 1 MiB UTF-8 document. Median domain projection was 3.259 ms, p95 was 3.774 ms, and maximum was 6.878 ms. The harness retains only the current document plus 40 numeric samples. This measures the synchronous transaction and round-trip projection beneath input handling; browser paint latency remains covered structurally by CodeMirror viewport virtualization and is not claimed as equivalent to this domain measurement.

## Android evidence

The aarch64 Android build completed the frontend production build and compiled the full Rust/Tauri Android target successfully. APK packaging then failed twice before Gradle task execution because the local Gradle runtime could not establish its loopback IPC connection. A second attempt with the daemon disabled produced the same host transport error. No source, TypeScript, Rust, Kotlin, manifest, or dependency diagnostic failed. The official Android CI job remains required to validate APK packaging on its clean runner before S013 can be declared merge-ready.

The first external review round identified five integration gaps. Recovery snapshots now preserve raw text and the verified profile, recovered buffers initialize the editor model, over-limit CodeMirror transactions are filtered before display, UTF-16 large sources use encoding-aware decoding/search/navigation, and previous-window navigation retains the actual visited offset. Dedicated regressions cover each correction.

The authorized final review round identified three remaining behavior gaps. Shortening a prior maximum line now invalidates and recomputes the global line bound, repeated large-source searches advance through every match with wraparound, and the runtime language detector evaluates bounded JSON, Rust, Python, and HTML content evidence consistently with the core contract. Focused regressions cover each correction, and no further automated review round is requested.

## Convergence notes

- The implementation deliberately places editor-specific language and size policy in `crates/glitchpad-core/src/editor.rs` instead of expanding the existing format probe in `detection.rs`. This deviation keeps byte-format detection and mutable editor policy separate while exporting stable schemas from the same core crate.
- The editor uses explicit CodeMirror extensions rather than `basicSetup`, which avoids enabling IDE-adjacent linting and autocomplete features outside S013.
- The implementation stores ordered newline decisions once in the authoritative raw shadow and keeps only constant-size newline counts in the status profile. This replaces the initially planned duplicate per-line token array, which could consume excessive memory in newline-dense 32 MiB files, without weakening byte-for-byte serialization.
- Language definitions are bundled, selected from a fixed allowlist, and loaded dynamically. No document content creates a URL, native path, process, or network request.
- Large-text mode retains no editable full-document string, exposes no save or mutation authority, and performs only bounded opaque source reads.

## Result

All locally executable S013 functional, safety, accessibility, dependency, formatting, and performance gates pass. Android source compilation passes; APK assembly is delegated to the mandatory CI job solely because of the reproduced local Gradle loopback transport failure.
