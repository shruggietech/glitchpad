# Research: Enforce Performance Budgets

## Decision 1: Separate reference evidence from hosted smoke evidence

**Decision**: Every result declares `reference`, `hosted_smoke`, or `structural` evidence class. Only evidence from the matching named reference profile can satisfy hardware-sensitive release claims; hosted CI still blocks deterministic boundary, classification, cancellation, disposal, and deliberately loose hard-smoke regressions.

**Rationale**: GitHub-hosted machines are variable and cannot support defensible p95 memory or latency claims. Ignoring timing in pull requests would also permit obvious regressions. Explicit evidence classes preserve truth while keeping CI useful.

**Alternatives considered**: Treat all hosted timings as release evidence (flaky and misleading); keep all measurements manual (not regression-blocking); normalize to a synthetic CPU score (adds an unstable benchmark unrelated to user tasks).

## Decision 2: Keep one canonical data catalog and independently verify consumers

**Decision**: Store metric thresholds, profile applicability, sample requirements, and scenario identities in governed JSON. Node validates the catalog and evidence; Rust and TypeScript implement narrow typed policy consumers with cross-contract fixtures that must agree at every boundary.

**Rationale**: Scattered constants already exist across renderer slices. A versioned catalog prevents silent threshold drift, while independent consumers catch serialization and case-mapping errors at native/interface boundaries.

**Alternatives considered**: Generate source code from JSON (hides reviewable policy behind generation); make TypeScript the sole authority (native gates cannot validate independently); duplicate free-form constants (drift-prone).

## Decision 3: Use bounded samples and nearest-rank percentiles

**Decision**: A metric defines a minimum and maximum sample count. Evidence stores finite non-negative samples only within that bound, sorts a copy, and derives median and p95 with the nearest-rank rule. Measurements using counters or invariant outcomes store a bounded summary instead of fake timing samples.

**Rationale**: The method is deterministic, portable, simple to audit, and consistent with existing S013 measurement code. Bounded arrays prevent evidence from becoming a memory or repository-growth vector.

**Alternatives considered**: Streaming approximate percentiles (unnecessary error and complexity at this scale); unbounded raw traces (privacy and size risk); averages alone (hide tail latency).

## Decision 4: Model warning history only across comparable runs

**Decision**: Consecutive warnings count only when metric version, scenario digest, profile, build profile, evidence class, cold/warm state, and method match. A pass resets the streak; a failure blocks immediately; missing or incomparable records cannot complete a required history.

**Rationale**: Comparing different binaries, fixtures, or machines creates false regressions. Exact comparability makes the two-warning rule deterministic.

**Alternatives considered**: Compare by metric ID alone (invalid across environment changes); use time-window averaging (can bury consecutive warnings); let maintainers label runs comparable manually (not repeatable).

## Decision 5: Track owned resources, not the whole JavaScript heap

**Decision**: Add a lightweight resource ledger that records bounded counts and size estimates for renderer-owned workers, timers, object URLs, observers, subscriptions, callbacks, leases, and regenerable surfaces. Owners transition through active, suspended, resumed, and disposed states; disposal is idempotent. Platform collectors separately record process memory.

**Rationale**: Browser heap estimates are inconsistent across WebViews and cannot prove that a particular renderer released a worker or timer. Ownership counts provide deterministic regressions, while native memory collectors cover the user-facing memory budget.

**Alternatives considered**: Heap snapshots in ordinary CI (browser-specific and noisy); monkey-patch every global allocation (unsafe and overbroad); trust component unmount alone (cannot show which resources remain).

## Decision 6: Reuse one headless browser process per collection run

**Decision**: The repository collector builds the production interface once, starts one loopback-only static server, launches one existing governed headless browser, and runs all browser-compatible scenarios in that process with explicit cleanup between samples.

**Rationale**: Process reuse matches project headless policy, reduces startup noise, and allows cold-state scenarios to be distinguished from accidental repeated launcher cost.

**Alternatives considered**: One browser per metric (slow and noisy); development server measurements (not release build); remote browser services (violates offline operation and reproducibility).

## Decision 7: Activate package metrics only on real artifacts

**Decision**: S018 validates size classification and provides an artifact collector accepting an explicit file. Desktop and Android package receipts remain `not_applicable` until issues #62-#65 create the required compressed artifacts, after which absence becomes a release failure.

**Rationale**: A debug bundle or fabricated archive does not predict the official signed installer/APK and would create a false claim. The contract must exist before packaging so every platform slice inherits the same limits.

**Alternatives considered**: Measure unpacked build directories (not comparable); create placeholder archives (misleading); defer size policy entirely (invites package slices to diverge).

## Decision 8: Preserve the explicit cooperative Mermaid limitation

**Decision**: Mermaid retains the S015 bounded, revision-keyed, cooperatively timed application-WebView renderer because its DOM-dependent synchronous engine cannot be forcibly preempted there. S018 measures first render/current preview, fails stale or repeated over-limit results, yields before dispatch, and keeps cancellation immediate before and after engine execution.

**Rationale**: Pretending an abort signal interrupts synchronous third-party DOM code would violate verification-before-claims. Moving rendering to a new isolated DOM process is a materially larger architecture change and is unnecessary while governed representative workloads meet hard limits.

**Alternatives considered**: Claim hard mid-call cancellation (false); embed an additional hidden WebView or browser process (large platform/security expansion); fork Mermaid (unmaintainable and disproportionate).
