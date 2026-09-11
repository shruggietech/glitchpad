# Research: Sectioned Technical Specification Documentation

## Decision 1: Use the canonical table of contents as the page boundary contract

**Decision**: Parse the manual table of contents and pair each ordered entry with exactly one numbered level-two heading. Each matched heading owns source content until the next matched heading.

**Rationale**: Issue #170 defines every top-level table-of-contents entry as one page and requires source order. Pairing both structures detects missing, duplicate, renamed, colliding, or reordered sections instead of silently accepting one side as authoritative.

**Alternatives considered**: Splitting on every level-two heading would ignore table-of-contents drift. Maintaining a separate route manifest would create a second authority. Manually authored pages would make exact coverage and future regeneration unreliable.

## Decision 2: Parse headings and fences with a narrow Markdown state machine

**Decision**: Recognize ATX headings only outside backtick or tilde fenced code blocks, with up to three leading spaces and fence-length-aware closing rules. Reject unsupported top-level structure with actionable errors.

**Rationale**: The canonical source contains code and Mermaid fences whose contents must remain opaque. A narrow state machine covers the required document grammar without adding a Markdown parser dependency or mistaking example text for structure.

**Alternatives considered**: Regular-expression splitting alone can create pages from heading-like code. Adding a general Markdown AST dependency would enlarge the dependency and license surface for a bounded build-time problem.

## Decision 3: Derive stable numbered routes from canonical titles

**Decision**: Generate two-digit route slugs in the form `NN-readable-title`, using lowercase ASCII letters and digits, hyphenating other runs, and rejecting collisions. The numeric prefix preserves visible order independently of lexical title changes.

**Rationale**: Readable numbered routes communicate section identity, sort predictably, and can be rebuilt from the canonical source. Collision rejection prevents one page from overwriting another.

**Alternatives considered**: Unnumbered title slugs obscure source order. Numeric-only routes are less useful to readers. Persisted IDs would create another authority.

## Decision 4: Preserve section content while adapting its page-level heading

**Decision**: Remove each source level-two section heading because Fumadocs renders the frontmatter title as the page's single level-one heading. Demote its nested headings by one level, preserve all other source bytes after normalized line endings, and retain original heading anchors through title-derived link ownership.

**Rationale**: This yields one correctly ordered primary heading per route and avoids beginning page content at level three. Heading text, tables, code, Mermaid, and prose stay on the owning page.

**Alternatives considered**: Retaining the level-two section heading duplicates the page title. Leaving nested headings at level three creates a skipped heading level. Rewriting content through a full renderer risks non-semantic source churn.

## Decision 5: Rewrite only canonical fragment destinations

**Decision**: Build an anchor-to-owner map from all canonical headings. Rewrite Markdown links whose fragment matches a known heading to either a same-page fragment or the owning section route plus fragment; a link to a section's own page title becomes the section route. Leave external, mail, non-fragment, code-fenced, and unknown same-page links unchanged.

**Rationale**: Section splitting changes route ownership, not link meaning. A known-anchor map makes the transformation deterministic and testable without touching unrelated links or examples.

**Alternatives considered**: Rewriting every fragment could corrupt links to generated framework anchors. Leaving all fragments unchanged would break cross-section navigation.

## Decision 6: Generate the introduction and metadata from repository authorities

**Decision**: Extract the document-control table from the canonical specification, validate its version and license against `package.json`, validate the current release statement in `README.md`, and generate the introduction with stable product, release, repository, contribution, and provenance copy.

**Rationale**: The introduction needs useful narrative while release and document-control facts cannot become manually copied drift. Build-time validation turns discrepancies into explicit failures.

**Alternatives considered**: Keeping the current hand-authored introduction duplicates version facts. Rendering only the raw table would omit the product and contribution context required by issue #170.

## Decision 7: Publish complete generated directory sets from staging

**Decision**: Write documentation and generated-library outputs into sibling staging directories, validate their complete expected inventory, then replace the prior generated directories. Clean abandoned staging directories before each run.

**Rationale**: Preparing all files before replacement prevents stale pages from surviving and avoids a partially updated mixture if parsing or writing fails. The set can be compared byte-for-byte across repeated generation.

**Alternatives considered**: Writing files individually into the live directory leaves stale outputs and mixed generations. Deleting first makes any parse failure remove the previously valid site sources.

## Decision 8: Keep legacy compatibility explicit and static-export safe

**Decision**: Generate `/docs/technical-specification` as a lightweight forwarding page that clearly states the specification is now sectioned and links to `/docs`; exclude it from the ordered documentation navigation.

**Rationale**: Static export cannot rely on an application server redirect. A stable 200 route preserves inbound links and offers a clear next action without serving the former monolith.

**Alternatives considered**: Client-side automatic redirection is less dependable for scripts and accessibility. Removing the route breaks inbound links. Keeping the monolith undermines sectioned authority.

## Decision 9: Share an ordered manifest across validation layers

**Decision**: Generate a JSON manifest containing source identity, document-control facts, ordered section routes/titles/anchors, navigation neighbors, and compatibility route. Unit tests, export audit, browser tests, and production verification consume that contract.

**Rationale**: A common generated manifest proves exact coverage and prevents independently maintained test route lists from drifting while remaining non-normative and reproducible.

**Alternatives considered**: Re-parsing Markdown in every test duplicates logic. Hard-coded route lists become a second maintenance surface.

## Decision 10: Separate pre-merge evidence from post-merge deployment evidence

**Decision**: Pull-request CI must prove generation, static export, full route/link/metadata audit, representative browser behavior, and accessibility. The existing deployment job must verify representative routes and production navigation after the approved commit is merged and published.

**Rationale**: Production cannot contain an unmerged commit. Explicitly recording the post-merge observation preserves honest verification while ensuring the same export contract is exercised before review.

**Alternatives considered**: Claiming local export as deployed evidence would violate verification governance. Deploying pull-request code to production would bypass the requested merge ritual.
