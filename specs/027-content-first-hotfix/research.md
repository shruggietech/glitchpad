# Research: Content-First Desktop Hotfix

## Production startup state

**Decision**: `App` defaults to an empty session list. Synthetic sessions move to a test-only fixture module, while performance sessions remain reachable only through the explicit performance build flag.

**Rationale**: Production currently imports test content as its default state. Keeping fixture creation outside the production entry path makes the required zero-session start structural and testable.

**Alternatives considered**: Clearing fixtures after mount was rejected because it can flash incorrect content and create recovery work. Marking fixtures non-persistent was rejected because visible fake documents remain unacceptable.

## Conditional tabs

**Decision**: Render no tab strip below two sessions. At two or more sessions, render each item as an activation tab with a sibling close button inside the same visual tab container.

**Rationale**: This directly implements the user's trigger rule while retaining valid tab semantics and a distinct accessible close action.

**Alternatives considered**: An always-visible single tab was rejected because it consumes space without navigation value. A single detached close button was rejected because its target is visually ambiguous.

## Compact command disclosure

**Decision**: Replace the two persistent command rows with one compact menu button in a small overlay chrome region. The menu presents Open, capability-derived document actions, Preferences, and Diagnostics in labeled groups and closes after invocation.

**Rationale**: Existing command contracts already centralize capability decisions. Reusing them avoids duplicated logic while moving infrequent controls out of the default viewport.

**Alternatives considered**: A native operating-system menu was deferred because cross-platform parity and testability would enlarge the hotfix. Permanent icon toolbars were rejected as another form of viewport consumption.

## Renderer controls and search

**Decision**: Use the shell menu for shared renderer commands, remove redundant always-visible renderer control rows where equivalent commands exist, and theme CodeMirror's search panel with the existing design tokens. Opening application panels closes editor search; only one application or metadata surface may remain open.

**Rationale**: The present duplication makes controls collide and contradicts content ownership. CodeMirror already provides bounded search behavior, so integration and styling are safer than replacing its engine.

**Alternatives considered**: Building a new search engine was rejected as disproportionate. Merely recoloring the existing white panel was rejected because it would preserve overlay collisions and persistent renderer rows.

## Packaged Windows evidence

**Decision**: Extend the portable lifecycle UI Automation probe to start from an isolated application-data directory, assert the empty-state control, deliver real TXT and Markdown fixtures, inspect visible filename/content signals, verify conditional close controls, and emit a bounded JSON receipt.

**Rationale**: The existing probe looks only for a filename element and therefore passed while fake documents dominated the UI. Visible user outcomes must become the release authority.

**Alternatives considered**: Component tests alone were rejected because they do not validate the packaged entry point. Screenshot-only comparison was rejected as brittle and less accessible than semantic UI Automation evidence.
