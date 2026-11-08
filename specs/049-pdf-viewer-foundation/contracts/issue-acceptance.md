# S049 issue acceptance map

Every issue remains open until its included criteria are satisfied and the owner merges. This table names required evidence; it is not a passing result. Current observations and artifact identities belong in validation.md.

| Issue criterion | Story | Required behavior | Verification |
| --- | --- | --- | --- |
| #77.1 | US1/US4 | Versioned renderer contracts | Contract tests and unchanged source/session/metadata regression |
| #77.2 | US1/US3 | No worker native/network authority | Production-worker CSP/bridge probes on actual WebViews |
| #77.3 | US1/US3 | Capability-driven controls | Controller/UI capability matrix tests |
| #77.4 | US4 | Preserve existing contracts | Existing text/image/source/session/metadata suites |
| #78.1 | US1/US4 | Four-platform representative rendering | Actual Windows/macOS/Linux/Android packaged WebView observations |
| #78.2 | US1 | Cancellation hard bounds | Measured cancel/switch/close/stale-result tests |
| #78.3 | US1 | 512/256MiB and10000page limits | Exact boundaries and source adapter tests |
| #78.4 | US1 | Reduced cache and refusal | Surface/cache pressure and stable error fixtures |
| #79.1 | US2 | Accessible navigation journeys | Keyboard/touch/semantic accessibility plus explicit existing manual AT waiver |
| #79.2 | US2 | Malformed destinations/outline | Cyclic/malformed/out-of-range/cross-owner corpus |
| #79.3 | US2 | Large-document responsiveness | Reduced-cache lazy search/thumbnail runtime measurement |
| #79.4 | US2 | Session-only navigation | Source hash and persistence payload checks |
| #80.1 | US3 | Truthful print | Actual supported native print handoff/output smoke, cancel/failure/unavailable states |
| #80.2 | US3 | No automatic navigation/network | Link/action corpus observed network/opener counters |
| #80.3 | US3 | Metadata provenance/availability | Known PDF facts and absent/unreadable field assertions |
| #80.4 | US3 | No executable PDF features | Scripts/attachments/actions/forms/resource corpus and worker denial probes |

#81 exhaustive conformance and #82 stable activation are outside S049. They cannot absorb any unmet criterion above. Existing owner-approved physical/reference/manual-screen-reader waivers remain explicit; no unexecuted observation is called a pass.
