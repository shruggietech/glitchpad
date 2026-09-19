# Verification: BrandBuilder AppFrame Adoption

## Traceability and authority

- Upstream work slice: S042, issue [shruggietech/shruggie-brand#219](https://github.com/shruggietech/shruggie-brand/issues/219), pull request [shruggietech/shruggie-brand#231](https://github.com/shruggietech/shruggie-brand/pull/231).
- Downstream adoption: issue [shruggietech/glitchpad#196](https://github.com/shruggietech/glitchpad/issues/196), pull request pending.
- Consumer baseline: `3d9a56048d01bbe2e661933e2c6eaebc7526534b`. Adopted upstream candidate: `824a83f8452b815828cedafb63fca9f81c8e1d76`.
- Artifact authority: Build run `35455144038`, artifact `10588635229`, named `verified-brand-kits-e87737f592780bcf7fcffd718932a35e596c03a6`. GitHub built the pull-request artifact at synthetic merge commit `e87737f592780bcf7fcffd718932a35e596c03a6`; its tree `589e440f713cba96ade468fa8d48d71727055943` exactly matches the adopted candidate head tree.
- Contract identity: Glitchpad brand `1.1.0`, Brand Canon `1.2.1`, generated React/Vite renderer adapter, Tauri host, 313 governed files.
- Authority order: the successful SHA-qualified workflow artifact, its governed `manifest.json`, Glitchpad's immutable `brand/INTEGRATION.json` receipt, then generated kit guidance.
- Recovery: rerun `scripts/sync-brand-kit.mjs` with the recorded source revision, workflow run, artifact identity, and retrieval date. Never reconstruct or hand-edit governed files under `brand/`.

## Baseline

Before adoption, Glitchpad's product-local `.app-shell` element was also the semantic `main` landmark, while `html`, `body`, and `#root` duplicated height and overflow ownership in `apps/glitchpad/src/styles.css`. The imported pre-S042 kit had no generated React AppFrame surface. Historical host timing and prior review-round duration were not captured, so this slice establishes a prospective baseline instead of inventing measurements.

## Test progression

- Red: AppFrame composition and exact-agent-contract assertions could not pass against the pre-S042 kit because the generated adapter and enforcement contract were absent.
- Green: the exact successful S042 artifact imported with all 313 governed files verified. Brand governance passed 24 tests plus the full manifest, provenance, agent-contract, integration, encoding, and license checker. The AppFrame product suite passed 29 tests; typecheck and production build passed; the production-CSS shell matrix passed 48 cases covering three viewports, mouse and coarse pointers, tabs, light and dark themes, forced colors, reduced motion, display scales, browser zoom, and 100-200 percent root text scaling.
- Local aggregate observation: 298 of 300 frontend tests passed in the Windows bind-mounted validation container. Two pre-existing Mermaid render cases exceeded their five-second per-test timeout after unusually slow jsdom setup; the focused AppFrame suite and production build were green in the same environment. This local infrastructure result is not substituted for CI and remains open until the native CI matrix reports.

## Host evidence

- Android: pending CI execution on the actual Tauri WebView at API 24 and API 36. The instrumentation contract measures one AppFrame, one main landmark, root overflow ownership, portrait and landscape bounds, live visual-viewport or legacy viewport fallback values, IME variables, menu reachability, and API 36 cutout insets.
- Windows: pending CI execution of the real Tauri build/package and existing installed/portable lifecycle checks. Browser geometry remains supporting evidence only.

## Observations and limitations

- The downstream app deliberately uses the bounded generated `full-bleed` layout because Glitchpad already owns its document-local scrolling and compact shell chrome.
- Tauri retains native window/titlebar authority. AppFrame owns only web safe-area, visual viewport, IME, and root layout geometry.
- API 24 has no platform display-cutout API. Its evidence records that limitation while still proving the same AppFrame, orientation, IME, focus, and menu contract.
- Historical baseline timings, prior correction counts, and fresh-session measurements were not recorded at `3d9a560`, so no retrospective numbers are invented. Post-adoption observations currently include one automatic upstream Codex review round with three corrected findings, two integration-driven upstream corrections (legacy Android WebView geometry and complete site adapter staging), and one downstream provenance correction separating the adopted head from GitHub's synthetic artifact commit.
- The official artifact import, including Docker startup and 313-file verification, completed locally in 6.6 seconds. Deterministic brand validation completed in 8.5 seconds. Review-round totals, escaped defects, actual-host results, fresh-session continuation, and final handover completeness will be updated from observed PR evidence before merge.

## Merge order

Merge the upstream S042 compiler pull request first, then merge the Glitchpad adoption pull request. The downstream receipt remains pinned to the reviewed upstream commit even before the upstream merge, but the ordered merge preserves an obvious recovery history.
