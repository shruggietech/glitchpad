# Research: BrandBuilder AppFrame Adoption

## Decision 1: Full exact kit import

Use `scripts/sync-brand-kit.mjs` against the successful upstream S042 workflow artifact. This preserves manifest verification, provenance, recovery bytes, and the existing project receipt contract. Copying selected files would create a false partial authority.

## Decision 2: One web geometry owner

Generated AppFrame owns safe-area and visual viewport/IME variables plus root web geometry. Glitchpad retains only product-local panel and document scrolling. Native Tauri titlebar geometry stays host-owned and is not duplicated in CSS.

## Decision 3: Dependency-free environment entry

Import environment synchronization from generated `web/react/environment.tsx`, not the interactive Radix client entry. This keeps the root bridge usable without forcing unrelated component dependencies.

## Decision 4: Non-substitutable host evidence

Android evidence evaluates the actual application WebView through `ActivityScenario<MainActivity>` on existing API 24 and API 36 CI jobs. Windows evidence uses the actual Tauri build/package path and existing shell checks. Vitest remains fast supporting evidence only.

## Decision 5: Governance merge

Retain the human root `AGENTS.md` and append or refresh one delimited generated BrandBuilder block sourced from `brand/enforcement/AGENTS.md`. Tests reject zero or multiple blocks so fresh sessions have deterministic authority without instruction loss.

## Rejected Alternatives

- Local CSS-only safe-area fixes were rejected because they fork the generated contract.
- Browser viewport simulation alone was rejected because it cannot prove WebView or Tauri host behavior.
- A second renderer wrapper was rejected because it creates competing root owners.
- Selective kit copying was rejected because it breaks recovery and provenance guarantees.
