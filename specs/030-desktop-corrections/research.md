# Research: Desktop Rendering and Shell Corrections

## Decision 1: Contain failures at the document boundary

**Decision**: Add a document-scoped React error boundary around active format surfaces and provide a Markdown-specific recovery route that explicitly changes to source mode. Reset containment when session identity, source revision, or format changes.

**Rationale**: Promise-level renderer failures already become terminal render results, but synchronous projection or component commit exceptions can bypass that path and blank the tree above the document. A boundary at the format-surface edge preserves application navigation and also protects future formats.

**Alternatives considered**: Catch only inside `SafeTree` leaves gaps around hooks, embedded components, and React commit work. A root application boundary preserves less functionality and cannot provide document-specific recovery. Silently switching to source would violate the requirement for explicit source disclosure.

## Decision 2: Treat renderer generations as session-and-revision scoped

**Decision**: Clear prior presentation state when the active session or source revision changes, retain a monotonically increasing request generation, and publish results only when generation, session identity, and source revision all match the current request.

**Rationale**: Cancellation is advisory around already-settling promises. Explicit generation and identity checks prevent stale work from showing or clearing another document even when clients or test doubles resolve out of order.

**Alternatives considered**: Relying on React keys alone does not protect same-session revisions. Relying only on renderer cancellation assumes a stronger guarantee than the asynchronous boundary provides.

## Decision 3: Pending rendered mode contains status only

**Decision**: Replace `markdown-pending-source` with a compact status surface whose visible and accessible content is constant, document-independent prose. Use `aria-busy`, a polite status, and static styling that needs no animation.

**Rationale**: The existing source placeholder directly causes the reported privacy and visual flash. A static state is deterministic, accessible, and naturally compliant with reduced-motion preferences.

**Alternatives considered**: Skeleton text can still resemble or leak document structure. Automatic source fallback exposes content without user intent. Fake percentage progress has no meaningful renderer signal.

## Decision 4: Separate trigger geometry from popup geometry

**Decision**: Left-anchor a fixed-size menu shell and absolutely position the popup beneath the trigger so popup width never changes the trigger's containing block.

**Rationale**: The current right-anchored shell grows from 2.25rem to 19rem and therefore moves its left-aligned trigger. The left edge also avoids the conventional right-side document scrollbar.

**Alternatives considered**: Reserving a right gutter permanently would consume document space. Animating the movement hides neither the collision nor the geometry defect. Portal rendering adds unnecessary focus and ownership complexity.

## Decision 5: Prove content and lifecycle with synthetic corpus fixtures

**Decision**: Add deterministic fixtures covering headings, tables, tasks, footnotes, raw HTML, long lines, Unicode, malformed constructs, local links/images, and embedded Mermaid, then run both document orders and injected failure paths in component and packaged Windows gates.

**Rationale**: Private user files are not suitable fixtures. A synthetic matrix can distinguish content-triggered failures from ordering and stale-lifecycle failures while remaining reproducible.

**Alternatives considered**: One trivial heading fixture cannot detect the regression. Capturing private real-world documents would violate privacy. Snapshot-only testing would not prove identity, interaction, or recovery behavior.

## Decision 6: Keep the README change surgical

**Decision**: Remove only the Platforms badge line and protect the supported-platform prose plus remaining badges with the existing public-surface checks.

**Rationale**: The issue is an isolated presentation defect and does not authorize changing platform claims.

**Alternatives considered**: Redesigning the badge row or platform section would expand scope without correcting application behavior.
