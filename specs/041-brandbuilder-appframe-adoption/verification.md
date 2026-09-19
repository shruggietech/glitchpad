# Verification: BrandBuilder AppFrame Adoption

## Traceability and authority

- Upstream work slice: S042, issue [shruggietech/shruggie-brand#219](https://github.com/shruggietech/shruggie-brand/issues/219), pull request [shruggietech/shruggie-brand#231](https://github.com/shruggietech/shruggie-brand/pull/231).
- Downstream adoption: issue [shruggietech/glitchpad#196](https://github.com/shruggietech/glitchpad/issues/196), pull request [shruggietech/glitchpad#197](https://github.com/shruggietech/glitchpad/pull/197).
- Consumer baseline: `3d9a56048d01bbe2e661933e2c6eaebc7526534b`. Adopted upstream candidate: `f5d699831043d1ee5facf350ef10451e0da95bb8`.
- Artifact authority: successful Build run `35460685229`, artifact `10590086274`, named `verified-brand-kits-a4016df28e48e1467b931db70f90a2cecd8139bc`. GitHub built the pull-request artifact at synthetic merge commit `a4016df28e48e1467b931db70f90a2cecd8139bc`; its tree `185375af091b58fff15ad1b4db7a370575c67ff1` exactly matches the adopted candidate head tree.
- Contract identity: Glitchpad brand `1.1.0`, Brand Canon `1.2.1`, generated React/Vite renderer adapter, Tauri host, 313 governed files.
- Authority order: the successful SHA-qualified workflow artifact, its governed `manifest.json`, Glitchpad's immutable `brand/INTEGRATION.json` receipt, then generated kit guidance.
- Recovery: rerun `scripts/sync-brand-kit.mjs` with the recorded source revision, workflow run, artifact identity, and retrieval date. Never reconstruct or hand-edit governed files under `brand/`.

## Baseline

Before adoption, Glitchpad's product-local `.app-shell` element was also the semantic `main` landmark, while `html`, `body`, and `#root` duplicated height and overflow ownership in `apps/glitchpad/src/styles.css`. The imported pre-S042 kit had no generated React AppFrame surface. Historical host timing and prior review-round duration were not captured, so this slice establishes a prospective baseline instead of inventing measurements.

## Test progression

- Red: AppFrame composition and exact-agent-contract assertions could not pass against the pre-S042 kit because the generated adapter and enforcement contract were absent.
- Green: the exact successful final S042 artifact imported with all 313 governed files verified. Brand governance passed 24 tests plus the full manifest, provenance, agent-contract, integration, encoding, and license checker. Documentation formatting and 434-file link validation passed, including the generated absolute hosted-manual link. The AppFrame product suite passed 29 tests; typecheck and production build passed; the production-CSS shell matrix passed 48 cases covering three viewports, mouse and coarse pointers, tabs, light and dark themes, forced colors, reduced motion, display scales, browser zoom, and 100-200 percent root text scaling.
- Local aggregate observation: the full `cargo xtask check` passed every Rust, Android-source, policy, lint, and typecheck stage, then the Windows bind-mounted validation container failed to start Vitest workers for `resource-ledger.test.ts` and `performance.test.ts` after unusually slow filesystem I/O. The focused AppFrame suite and production build were green in the same environment, and the native shared frontend CI job passed. This local infrastructure result is recorded rather than substituted for CI.

## Host evidence

- Android: the initial PR run `35457241343` reached the actual Tauri WebView on API 24 and API 36. Both hosts passed portrait and landscape AppFrame ownership before menu disclosure, then reproduced the reviewed headerless-row defect when the disclosed menu moved outside the reported visual viewport. Run `35459533690` proved the corrected headerless row, portrait and landscape ownership, and menu reachability on both API levels before finding that the IME probe did not publish a positive inset. Run `35461108985` exposed an API 36 Gradle DNS outage and, on API 24, a teardown defect that terminated the instrumented app before JUnit could preserve the IME diagnostic. The final candidate declares `adjustResize` for the legacy host and resets the scenario without terminating the app. Final API 24/API 36 evidence is pending the replacement host run. The instrumentation contract measures one AppFrame, one main landmark, root overflow ownership, portrait and landscape bounds, live visual-viewport or legacy viewport fallback values, IME variables, menu reachability, and API 36 cutout insets.
- Windows: the initial PR and push package runs `35457241332` and `35457224247` built the real NSIS candidate and reached the installed lifecycle, where UI Automation could not discover the editor after the headerless content track collapsed. Corrected Windows package runs `35459533686` and `35459531344` passed the real package, installed, and portable lifecycles. Browser geometry remains supporting evidence only.

## Observations and limitations

- The downstream app deliberately uses the bounded generated `full-bleed` layout because Glitchpad already owns its document-local scrolling and compact shell chrome.
- Tauri retains native window/titlebar authority. AppFrame owns only web safe-area, visual viewport, IME, and root layout geometry.
- API 24 has no platform display-cutout API. Its evidence records that limitation while still proving the same AppFrame, orientation, IME, focus, and menu contract.
- Historical baseline timings, prior correction counts, and fresh-session measurements were not recorded at `3d9a560`, so no retrospective numbers are invented. Post-adoption observations currently include one automatic upstream Codex review round with three corrected findings, two integration-driven upstream corrections (legacy Android WebView geometry and complete site adapter staging), one downstream provenance correction separating the adopted head from GitHub's synthetic artifact commit, and one automatic downstream Codex review round with two accepted findings (headerless AppFrame row placement and repository-relative generated guidance).
- The final official artifact import, including Docker startup and 313-file verification, completed locally in 7.3 seconds. Deterministic brand validation and 24 contract tests completed in 4.0 seconds. Review-round totals, corrected actual-host results, fresh-session continuation, and final handover completeness will be updated from observed PR evidence before merge.

## Merge order

Merge the upstream S042 compiler pull request first, then merge the Glitchpad adoption pull request. The downstream receipt remains pinned to the reviewed upstream commit even before the upstream merge, but the ordered merge preserves an obvious recovery history.
