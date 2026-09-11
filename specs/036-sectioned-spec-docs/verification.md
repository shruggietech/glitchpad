# Verification: Sectioned Technical Specification Documentation

## Scope and authority

S036 implements GitHub issue #170 without changing `docs/glitchpad-technical-specification.md`, the released product version 0.1.2, or application capability claims. The generated documentation introduction and manifest are reviewable repository outputs; the 38 section MDX pages, compatibility MDX page, and runtime project facts remain regenerated build artifacts.

The export audit exposed a pre-existing relative `SECURITY.md` link in the generated Support page. S036 proportionally maps that repository-relative authority link to the existing public `/security` route because excluding a known broken internal destination would contradict the slice's full-link audit contract.

## Evidence register

| Evidence | Result |
| --- | --- |
| E1 Generator, authority, deterministic-publication, content, and export unit contracts | Pass: 14 tests, 0 failures |
| E2 Canonical generation inventory | Pass: one introduction, 38 ordered section pages, one unlisted compatibility page, one ordered navigation file, and one 38-section manifest |
| E3 Static site build | Pass: 46 static pages generated, including 41 documentation paths |
| E4 Export audit | Pass: complete expected route set, no stale documentation route, unique section metadata, canonical navigation order, and zero broken internal route or fragment destinations |
| E5 Browser and accessibility suite | Pass: 73 Chromium scenarios, 0 failures |
| E6 Formatting and generated-output stability | Pass: prebuild followed by repository Prettier check reports no changes required |
| E7 Complete repository gate | Pass: `cargo xtask check` exited 0 in the pinned hidden Linux validation environment |
| E8 Pull-request CI | Pending official pull request |
| E9 Codex and security reviews | Pending official pull request; no more than one explicit `@codex review` round is authorized |
| E10 Production deployment | Pending merge and the merge-triggered `glitchpad.com` deployment verifier |

## Functional requirement traceability

| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-001 | Canonical source path in the parser and manifest; generated markers; canonical file unchanged | Pass |
| FR-002 | Generated `/docs` introduction presents the Technical Specification as the documentation set | Pass |
| FR-003 | Generated introduction includes product, authority, document-control, release, repository, contribution, and provenance content | Pass |
| FR-004 | Version/license/document-control cross-check tests and repository-derived release URLs | Pass |
| FR-005 | E1, E2, E4 prove each of 38 TOC entries maps exactly once | Pass |
| FR-006 | Parser-owned source ranges, ordered manifest, and early/middle/final content checks | Pass |
| FR-007 | Nested heading, table, fenced code, Mermaid, inline-code, and browser rendering checks | Pass |
| FR-008 | Content and compatibility tests plus E4 prove zero rendered manual TOCs | Pass |
| FR-009 | Generated `meta.json`, manifest order, and complete sidebar browser traversal | Pass |
| FR-010 | Browser pager checks prove the middle route targets sections 18 and 20 | Pass |
| FR-011 | Anchor-owner transformation tests and E4 route/fragment audit | Pass |
| FR-012 | External, same-page, fenced-code, inline-code, image, and unknown-fragment transformation boundaries | Pass |
| FR-013 | Explicit unlisted `/docs/technical-specification` forwarder and browser/export checks | Pass |
| FR-014 | E4 checks distinct descriptions, canonical URLs, Open Graph titles/URLs, and Twitter titles for all 38 routes | Pass |
| FR-015 | Every generated MDX page carries the canonical-source marker | Pass |
| FR-016 | Stale-file publication fixture and exact export-route audit | Pass |
| FR-017 | Byte-identical repeated-publication fixture and stable generated-format check | Pass |
| FR-018 | Missing, duplicate, skipped, reordered, mismatched, colliding, unclosed-fence, and authority diagnostic contracts | Pass |
| FR-019 | E1 and E2 exact coverage, content, TOC-absence, and cleanup assertions | Pass |
| FR-020 | E4 full route, order, metadata, internal route, and fragment checks | Pass |
| FR-021 | E5 introduction, early/middle/final, compatibility, responsive, keyboard, heading, table, Mermaid, sidebar, and pager scenarios | Pass |
| FR-022 | Production verifier covers introduction, representative routes, navigation, diagrams, metadata, compatibility, and links | Pending merge deployment |
| FR-023 | Canonical specification and version unchanged; E7 complete regression gate | Pass |
| FR-024 | This matrix maps issue #170 and explicitly reports E10 as incomplete before merge | Pass |

## Success criterion traceability

| Criterion | Evidence | Status |
| --- | --- | --- |
| SC-001 | E1, E2, and E4 prove 38 of 38 sections exactly once and ordered | Pass |
| SC-002 | Parser range tests plus representative nested content and E3 compilation | Pass |
| SC-003 | Unit, browser, and compatibility checks find zero manual TOC bodies | Pass |
| SC-004 | E4 validates unique complete metadata for 38 of 38 section routes | Pass |
| SC-005 | E4 reports zero broken generated routes or fragments | Pass |
| SC-006 | Repeated fixture publication and E6 report zero differences | Pass |
| SC-007 | Seeded stale output is absent after regeneration | Pass |
| SC-008 | Every governed malformed fixture fails before live replacement | Pass |
| SC-009 | E5 proves visible skip-link focus, one primary heading, narrow navigation, and representative reachability | Pass |
| SC-010 | E4 and E5 prove the legacy route forwards without monolithic content | Pass |
| SC-011 | E3 through E7 prove local static export, navigation, diagrams, metadata, and representative routes | Pass locally; hosted confirmation pending E8 |
| SC-012 | Merge-triggered production verification on `glitchpad.com` | Pending merge deployment |
| SC-013 | Canonical source remains sole maintained section-body authority; generated bodies remain ignored artifacts | Pass |
| SC-014 | Every issue #170 criterion maps to E1 through E10, with E10 explicitly pending | Pass for pre-merge handoff |

## Review and deployment status

- Pull-request CI: pending publication.
- First external Codex/security review: pending publication.
- Authorized second Codex review: pending first-round resolution; trigger at most once.
- Production `glitchpad.com` observation: pending the user's final review, merge ritual, and merge-triggered deployment.
