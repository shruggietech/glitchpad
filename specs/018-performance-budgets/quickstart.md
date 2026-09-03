# Quickstart: Enforce Performance Budgets

## Prerequisites

- Install the pinned Rust, Node.js, pnpm, browser, and platform prerequisites documented by the repository.
- Run commands from the repository root with no document-content network access.
- Use a release build and a catalog-declared reference profile for release claims.

## Validate policy and structural evidence

```text
pnpm run check:performance
```

Expected: catalog schema, fixture digests, exact threshold classifications, malformed evidence, comparability, two-warning history, renderer boundaries, cancellation, resource disposal, privacy, and activation policy pass. This command is safe for ordinary pull-request runners and does not claim reference hardware performance.

## Run the hosted browser smoke collector

```text
pnpm run performance:smoke
```

Expected: one production build, loopback-only static serving, one headless browser process, bounded samples for browser-compatible workloads, explicit hosted-smoke classifications, zero off-origin document requests, and complete cleanup. Any smoke hard-limit or invariant failure exits nonzero.

## Validate reference-profile receipts

```text
node scripts/check-performance.mjs --evidence <platform-receipts.json> --stage release
```

Expected: the gate validates the named profiles, release builds, catalog/scenario identities, bounded samples, summaries, memory fields, cleanup, classifications, and complete activation-required coverage. Browser smoke deliberately rejects reference profile IDs. For desktop memory, set `GLITCHPAD_REFERENCE_EXECUTABLE` to an actual packaged release executable and `GLITCHPAD_REFERENCE_BUILD_ID` to a content-free build identifier, then run `cargo test -p glitchpad-host --release --test performance_conformance desktop_reference_working_set_receipt --locked -- --ignored --exact --nocapture`. The harness launches that packaged process with non-interactive I/O, allows five seconds for its shell and WebView to settle, samples its process rather than the test harness, emits a gate-compatible receipt, and terminates it. Android API 24 and API 36 instrumentation launches `MainActivity`, waits for the WebView's ready shell plus two frames, and then emits the PSS receipt; debug APK runs identify themselves as debug and cannot satisfy release evidence validation. Platform timing harnesses supply the remaining content-free reference receipts before release activation.

## Classify an actual package

```text
node scripts/run-performance.mjs --profile <catalog-reference-profile> --metric <package-metric> --artifact <actual-package-file> --build-id <content-free-build-id> --output <temporary-evidence-directory>
```

Expected: the collector measures the compressed artifact bytes. Before the matching packaging slice activates the metric, the gate reports it as inactive; after activation, absence or a hard-limit package fails.

## Full repository gate

```text
pnpm check
```

Expected: all native, frontend, site, documentation, security, provenance, performance-policy, browser-smoke, configuration, Mermaid, version, encoding, and public-surface checks pass. Hardware-sensitive reference receipts remain an explicit later release-check input, not a hosted-CI claim.

## Review evidence

Confirm that every required v0.1.0 metric has a catalog entry and runnable path, all recorded digests match, evidence fields satisfy [performance-evidence.md](contracts/performance-evidence.md), renderer ownership satisfies [resource-lifecycle.md](contracts/resource-lifecycle.md), and the release-stage applicability is truthful. Record final S018 results in `verification.md` before publication.
