# Contract: Sectioned Documentation Generation

## Canonical input

1. `docs/glitchpad-technical-specification.md` remains the sole normative specification source.
2. Generation accepts one level-one title, one `Table of Contents` level-two heading, an ordered numbered TOC, and consecutively numbered level-two specification sections.
3. Headings inside fenced code blocks, Mermaid blocks, blockquotes, and nested section content never become page boundaries.
4. A missing, duplicate, mismatched, colliding, skipped, or reordered boundary fails with a message identifying the invalid entry or section.

## Generated output

1. `/docs` introduces the authoritative specification and combines canonical document-control facts with product, release, repository, contribution, and provenance access.
2. Every canonical TOC entry produces exactly one `/docs/NN-readable-title` page in source order.
3. A page contains all source content after its numbered level-two heading and before the next numbered level-two heading.
4. Nested headings are adapted to begin at level two. Tables, code blocks, Mermaid, prose, and supported Markdown constructs remain on their source-owning page.
5. Every generated page contains a source marker and must not be manually maintained.
6. The manual table-of-contents block appears on no rendered article page.
7. `/docs/technical-specification` remains a lightweight unlisted compatibility page leading to `/docs`; it never contains the monolithic specification.

## Routes, navigation, and links

1. The navigation order is `/docs`, sections 1 through 38, with the compatibility route excluded.
2. Framework previous/next controls follow that same order where present.
3. Every known canonical heading anchor has one page owner.
4. Cross-section fragment links target the owner route and fragment. A top-level section link targets the owner route.
5. Same-page fragments, external URLs, mail links, and link-like code text retain their meaning.
6. Every generated section route has a distinct title, description, canonical URL, Open Graph URL/title, and Twitter title.

## Publication and cleanup

1. Generation normalizes input line endings and emits UTF-8 without BOM.
2. Repeated generation from unchanged authorities produces byte-identical documentation and manifest files.
3. All outputs are prepared and inventoried in staging before the live generated directories are replaced.
4. Obsolete live pages and abandoned staging files are absent after successful generation.
5. A parse, validation, or staging failure leaves the previous live generated set unchanged.

## Evidence

1. Unit tests prove parsing, pairing, ordering, fence handling, slug collisions, link rewriting, deterministic output, stale cleanup, and authority validation.
2. Static-export audit proves the exact ordered route inventory, no stale routes, unique metadata, correct canonical/social identity, and zero broken internal destinations or fragments.
3. Browser tests cover the introduction, early/middle/final section pages, legacy compatibility, sidebar and previous/next order, responsive controls, keyboard focus, headings, tables, and Mermaid.
4. Pull-request CI runs the full site and repository gates against the generated set.
5. The post-merge deployment verifier confirms the approved revision, introduction, representative section routes, navigation, diagram, metadata, and internal links on `glitchpad.com`.
