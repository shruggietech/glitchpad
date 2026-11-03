# Dependency disposition: S044

The 2026-11-02 assessment covers every proposal in Cargo PR #240 and npm PR #226. Selected versions are read from the current workspace manifests. Deferrals keep the pre-slice direct version and do not suppress advisories; the full selected workspace graph has zero npm audit findings. PR #226 remains partially integrated.

## Cargo PR #240

| Package | Previous | Proposed and selected | Disposition and qualification |
| --- | --- | --- | --- |
| roxmltree | 0.21.1 | 0.21.2 | Integrated. Parser depth hardening; unchanged SVG preflight and hostile/decode regressions. |
| notify | 8.2.0 | 8.2.1 | Integrated. Native watcher maintenance; all desktop source/native contracts retained. |
| schemars | 1.2.2 | 1.2.3 | Integrated. Schema fixes; root/fuzz schema graph aligned and native tests pass. |
| serde_json | 1.0.151 | 1.0.154 | Integrated. JSON fixes; root/fuzz graph aligned and source/metadata regressions pass. |
| tauri-plugin | 2.6.3 | 2.7.2 | Integrated. Compatible native build-plugin update; exact licensed Linux plugin patches retained. |
| uuid | 1.26.1 | 1.29.0 | Integrated. Identifier maintenance; source/recovery and affected native contracts pass. |

The root/fuzz locks agree for their shared updated parser/JSON/schema dependencies. UUID is not in the fuzz graph. The maintained Linux zbus 6 plugin patches remain exact. The notice-source inventory records every selected changed Cargo identity, including native transitive changes.

## npm PR #226

| Package | Previous | Proposed | Selected | Disposition | Reason and qualification |
| --- | --- | --- | --- | --- | --- |
| react | 19.3.0 | 19.3.1 | 19.3.1 | integrated | Integrate compatible shared runtime patch; frontend/site and native package consumers qualified. |
| react-dom | 19.3.0 | 19.3.1 | 19.3.1 | integrated | Integrate with React at the same version across all three workspace manifests. |
| @tauri-apps/cli | 2.11.5 | 2.12.4 | 2.11.5 | deferred | Defer native packaging CLI migration; retain the qualified 2.11.5 build boundary. |
| markdownlint-cli2 | 0.23.3 | 0.24.0 | 0.24.0 | integrated | Integrate patched tooling/advisory graph; documentation gates qualify the new rule engine. |
| prettier | 3.9.9 | 3.9.10 | 3.9.9 | deferred | Defer formatting-only patch unrelated to advisory/native fixes; avoid incidental formatter churn. |
| puppeteer | 25.12.0 | 25.16.0 | 25.16.0 | integrated | Integrate maintained BiDi/Zod4 dependency path and align reusable image/browser; browser gates qualify consumers. |
| @codemirror/autocomplete | 6.20.3 | 6.20.4 | 6.20.4 | integrated | Integrate editor patch with existing editing, source and native regressions. |
| @codemirror/language | 6.12.4 | 6.13.1 | 6.12.4 | deferred | Defer language-service minor migration; selected view/autocomplete patches leave grammar contracts unchanged. |
| @codemirror/view | 6.43.13 | 6.43.15 | 6.43.15 | integrated | Integrate editor patch with existing geometry, editing and source regressions. |
| @tauri-apps/api | 2.11.1 | 2.12.4 | 2.11.1 | deferred | Defer bridge API migration with CLI; preserve current native invocation contracts. |
| core-js | 3.50.0 | 3.51.0 | 3.50.0 | deferred | Defer polyfill minor migration; preserve the pinned legacy-WebView compatibility contract. |
| dompurify | 3.4.16 | 3.4.17 | 3.4.17 | integrated | Integrate security patch; hostile Markdown/Mermaid/SVG rendering boundaries remain covered. |
| mermaid | 12.0.0 | 12.2.0 | 12.0.0 | deferred | Defer runtime migration and diagram behavior changes; patched transitive advisory paths are qualified separately. |
| unist-util-visit | 5.1.0 | 5.2.0 | 5.1.0 | deferred | Defer traversal API minor migration; no selected advisory requires it. |
| @types/node | 24.13.6 | 24.19.2 | 24.13.6 | deferred | Defer type-surface expansion; keep the qualified source/tooling type baseline. |
| @vitejs/plugin-react | 6.1.1 | 6.1.2 | 6.1.1 | deferred | Defer HMR/compiler peer behavior change unrelated to release advisory fixes. |
| axe-core | 4.13.0 | 4.14.0 | 4.13.0 | deferred | Defer audit rule-set migration for separate baseline qualification; existing accessibility checks remain enabled. |
| eslint | 10.11.0 | 10.14.0 | 10.14.0 | integrated | Integrate patched tooling/advisory graph; lint and actual repository consumers pass. |
| globals | 17.12.0 | 17.13.0 | 17.12.0 | deferred | Defer unrelated lint-global inventory change; existing lint configuration remains qualified. |
| typescript-eslint | 8.70.1 | 8.72.1 | 8.70.1 | deferred | Defer unrelated rule/type-service migration; existing lint configuration remains qualified. |
| vite | 8.3.0 | 8.3.5 | 8.3.5 | integrated | Integrate patched build/advisory graph; production builds and runtime tests qualify consumers. |
| vitest | 5.0.1 | 5.0.5 | 5.0.5 | integrated | Integrate patched test/advisory graph; full existing test suites qualify the runner. |
| fumadocs-core | 16.15.14 | 16.17.9 | 16.15.14 | deferred | Defer coordinated Fumadocs stack migration; patched Next/Zod close the selected advisory paths. |
| fumadocs-ui | 16.15.14 | 16.17.9 | 16.15.14 | deferred | Defer with Fumadocs core/MDX for coherent component and rendering qualification. |
| next | 16.3.6 | 16.4.3 | 16.4.3 | integrated | Integrate security fixes; static build, exported routes and browser suites qualify consumers. |
| zod | 4.6.5 | 4.6.7 | 4.6.7 | integrated | Integrate security patch and compatible Zod4 consumers; validation/site/browser gates pass. |
| @playwright/test | 1.63.0 | 1.64.1 | 1.63.0 | deferred | Defer test-browser migration; retain the qualified Playwright runner/browser combination. |
| fumadocs-mdx | 15.4.4 | 15.4.10 | 15.4.4 | deferred | Defer with the coordinated Fumadocs core/UI stack despite its patch version. |

Twelve proposals are integrated and sixteen are deferred. Package-lock transitive fixes for the retained direct graph are explicit overrides in the root package manifest, with advisory evidence in packaging/s044-advisory-disposition.json and upstream notice texts/source digests in packaging/s044-dependency-notice-sources.json. Additional changed transitive identities are tracked there rather than being presented as direct #226 proposals. Basic-ftp 6 retains its CommonJS Client entry and minimatch 11 supports the pinned Node 24; the full aggregate qualifies their actual consumers. No separate unrelated major-tooling PR is implicitly incorporated or closed.
