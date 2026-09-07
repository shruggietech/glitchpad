# S024 Dependency Disposition

## Dependabot pull requests

| PR | Proposal | Disposition |
| --- | --- | --- |
| #123 | Jackson Databind 2.22.2 | Excluded. Tauri's newer Jackson line raises the Android floor to API 26, while Glitchpad supports API 24 and intentionally pins the final compatible 2.13 line. |
| #124 | AndroidX Test Core 1.7.0 | Excluded after the coherent AndroidX Test 1.7 suite caused the API 36 instrumentation process to crash before test discovery in two independent CI attempts. API 24 and the proven 1.6 baseline remain green. |
| #125 | Espresso Core 3.7.0 | Excluded with the AndroidX Test 1.7 cluster after two reproducible API 36 instrumentation crashes before test discovery. |
| #126 | sysinfo 0.39.6 | Included. |
| #127 | sha2 0.11.0 | Excluded. This is a non-urgent major API migration with no associated repository advisory. |
| #128 | npm minor and patch group | Partially included. Compatible root and application updates are consolidated. The grouped site updates are held because Fumadocs duplicates the site's main landmark and the proposed Next/Tailwind combination breaks shared brand stylesheet resolution under the workspace layout. |
| #129 | @types/node 26.4.1 | Excluded. Node 26 types conflict with the repository's Node 24 runtime authority; the site types are aligned to Node 24 instead. |
| #130 | Testing Library jest-dom 7.0.1 | Included. |
| #131 | jsdom 30.0.1 | Excluded. Its declared minimum on the Node 24 line is 24.15.0, newer than the pinned 24.11.0 runtime. |
| #132 | TypeScript 7.0.2 | Excluded. The repository is intentionally standardized on TypeScript 6 and a compiler-major migration is outside maintenance scope. |

## Advisory disposition

The moderate `glib` iterator advisory remains transitive through Tauri's GTK/WebKit runtime dependency family. The fixed `glib` 0.20 line cannot be selected independently while the current Tauri Linux stack requires 0.18, and Glitchpad does not directly use the affected `VariantStrIter` API. S024 configures cargo-deny to reject all unsound advisories, including transitive dependencies, then names `RUSTSEC-2024-0429` as the sole documented exception. The governing specification assigns that exception to the maintainers and expires it at the first compatible Tauri GTK transition or the v0.2 dependency pass, whichever occurs first.
