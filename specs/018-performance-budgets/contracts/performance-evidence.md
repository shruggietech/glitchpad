# Performance Evidence Contract

## Authority

`fixtures/performance/budgets.json` is the machine-readable catalog for v0.1.0 performance metrics, reference profiles, hosted smoke profiles, scenarios, thresholds, sample bounds, and activation state. Runtime consumers MUST NOT silently redefine these values. Catalog changes require a dated Spec Kit decision and corresponding contract fixtures.

## Classification

For every `at_most` numeric metric:

| Observation                                   | Classification |
| --------------------------------------------- | -------------- |
| Value at or below target                      | `pass`         |
| Value above target and at or below hard limit | `warning`      |
| Value above hard limit                        | `failure`      |

An invariant listed by the metric fails independently of aggregate timing. Current invariant failures include stale Mermaid publication, repeated editor stalls above 100 milliseconds, post-cancellation publication after 250 milliseconds, incomplete cleanup, and resource growth across lifecycle cycles.

The classifier recomputes median, p95, maximum, invariant state, and final classification. A stored classification or percentile that disagrees is invalid evidence rather than an alternate result.

## Evidence classes

- `reference` evidence comes from the exact named release profile, uses a release build, and may satisfy hardware-sensitive release activation.
- `hosted_smoke` evidence runs on declared hosted CI and may block a regression but cannot satisfy a reference-profile claim.
- `structural` evidence proves deterministic policy, boundary, cancellation, disposal, or classification behavior without making a wall-clock or memory claim.

The class is part of comparability. Promotion from hosted smoke to reference evidence is prohibited.

## Required fields

Every accepted evidence record contains the fields defined in [data-model.md](../data-model.md). It has no arbitrary extension map. Identifiers and runtime strings are bounded, samples are finite and bounded, timestamps are canonical UTC, fixture digests match repository bytes, and cleanup is complete.

## Applicability

A metric is `required`, `smoke`, or `inactive` for a release stage and profile. Every release-required metric declares its exact `release_profiles`, and the gate requires a valid receipt for each one. Evidence from another valid profile, including structural evidence for a timing metric or desktop evidence for an Android obligation, cannot substitute for a missing profile. `inactive` is the only state that accepts `not_applicable`. Package-size metrics remain inactive until the corresponding packaging slice supplies an actual compressed installer or universal APK. Once activated, a missing artifact or receipt fails.

## Warning history

Histories retain at most 20 records per metric and order by measurement time. Two adjacent comparable warning classifications require a performance follow-up. A pass resets the streak. Failures block immediately. Invalid, missing, stale, inactive, and incomparable records never satisfy or join a warning sequence.

## Diagnostics and privacy

Validation emits only stable codes plus allowlisted identifiers such as metric, scenario, profile, and field. It never emits fixture contents, filenames supplied by users, native paths, document URIs, provider identifiers, environment variables, command lines, or raw logs. At most 100 diagnostics are retained per gate evaluation.

## Collector protocol

Collectors receive an explicit catalog path, scenario ID, profile ID, evidence output directory, and optional actual package path. They use monotonic clocks, clear or declare caches for cold scenarios, bound sample counts, reuse process hosts where safe, finish resource cleanup, write UTF-8 JSON without BOM, and exit nonzero on an invalid or hard-failing smoke result. Reference collectors additionally verify the declared environment before measuring.

## Aggregate result

The performance gate fails when any declared profile receipt for an activation-required metric is missing, invalid, stale, a hard failure, incompletely cleaned, or in an unresolved two-warning streak. It warns when applicable evidence is valid but beyond target. It passes only when all required policy and evidence conditions pass. This result feeds `cargo xtask check` for pull-request-safe checks and the later `release-check` for activated reference receipts.
