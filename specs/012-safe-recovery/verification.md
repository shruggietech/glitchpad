# Verification: Conflict-Safe Recovery

## Outcome

S012 satisfies Issue #50 with conflict-safe save transactions, guarded destructive transitions, and bounded private recovery on desktop and Android. The implementation was validated locally before publication.

## Requirement coverage

| Requirement | Evidence |
| --- | --- |
| FR-001 through FR-007, SC-001, SC-002 | Core session and source tests cover orthogonal focus/integrity state, source-bound events, exact save-operation binding, one-use overwrite authorization, and corpora of 1,000 stale attempts plus 1,000 obsolete or mismatched receipts. Desktop conformance tests cover stale-before-write behavior and truthful late-failure durability. |
| FR-008 through FR-010, SC-003 | Core and TypeScript reducer tests cover dirty close, reload, application exit, active/background/overflow sessions, discard, Save As, cancellation, failed saves, and stale decisions. Interface tests cover keyboard operation, focus return, live status, and constrained layout. |
| FR-011 through FR-015, SC-004 through SC-006 | Recovery policy and host-store tests cover two-second idle and thirty-second maximum scheduling, clock discontinuity, atomic publication, exact quota accounting, protected records, expiry, corruption, truncation, future versions, symlinks, interruption, owner permissions, and safe startup isolation. |
| FR-016 through FR-019, SC-007 through SC-009 | Frontend recovery projections and the native gateway cover accept, refuse, defer, exact cleanup, source-conflicted restoration, safe inventory, redacted failures, and platform-independent contracts. Android backup rules exclude `recovery-v1` from cloud backup, device transfer, and legacy backup. |
| FR-020, FR-021, SC-010 | Focused Rust, frontend, host conformance, Android API 24, Android API 36, redaction, encoding, and complete repository gates passed. No production editor, clean-session restoration, synchronization, telemetry, collaboration, version history, or generalized database was introduced. |

## Local validation evidence

- `cargo fmt --all` passed.
- `cargo clippy --workspace --all-targets --locked -- -D warnings` passed.
- Core validation passed with 44 unit tests and 3 contract-schema tests.
- Host validation passed with 31 unit tests, 5 Android contract tests, 7 desktop source conformance tests, and 6 recovery-store conformance tests.
- `pnpm --dir apps/glitchpad check` passed lint, type checking, 30 tests including accessibility assertions, and the production build.
- Android x86_64 debug application assembly passed after the final native gateway integration.
- Android API 24 passed all 4 connected instrumentation tests and the explicit recovery seed, force-stop, and verify phases.
- Android API 36 passed all 4 connected instrumentation tests and the explicit recovery seed, force-stop, and verify phases.
- `pnpm check` passed the complete aggregate gate, including Rust, dependency and license policy, frontend, brand, site build and browser tests, configuration, formatting, Markdown, links, Mermaid, version, UTF-8, and public documentation checks.
- `git diff --check`, raw-locator and recovery-payload scans, and mojibake scans passed with no findings.

## Platform conclusion

Desktop and Android share lifecycle, conflict, receipt, recovery-record, quota, expiry, cleanup, and redaction policy. Platform-specific behavior is limited to native source authority, application-private directory discovery, quota selection, owner-permission support, and Android backup exclusion.

## Intentional policy tightening

The initial design phrase “oldest inactive record” was tightened so that only expired, superseded, or explicitly resolved records are eviction-eligible. Unreviewed crash candidates and active or unresolved recovery records remain protected because silent eviction would violate the slice’s stronger no-silent-loss requirement.
