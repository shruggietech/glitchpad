# Shell Presentation Contract

## Production start

1. The production entry point supplies no demonstration sessions.
2. Zero sessions render one `main` application region, one document surface empty-state label, and one primary Open action when native desktop delivery is available.
3. Zero sessions expose no tab list, document commands, fixture filename, or dirty/recovery state unless a genuine recovery inventory entry exists.

## Real-source delivery

1. An opened delivery materializes exactly one source-backed session and activates it.
2. A duplicate delivery activates its existing session without creating another tab.
3. TXT and Markdown documents expose their display name and representative content through the accessibility tree after rendering.
4. Rejected or failed materialization leaves existing documents intact and exposes an actionable visible alert.

## Tab presentation

1. Session count below two produces no tab-list region.
2. Session count of two or more produces one tab-list region.
3. Each session produces one activation tab and one adjacent close button labeled `Close <display name>`.
4. A close button always dispatches against its own session identity, not the current active identity.
5. Returning below two sessions removes the tab-list region without changing the remaining session.

## Compact menu

1. One menu button labeled `Menu` exposes Open, application actions, and capability-derived document actions.
2. The menu closes after an action, Escape, or explicit dismissal and restores focus when appropriate.
3. Opening Preferences, Diagnostics, or metadata closes any competing application surface and editor search.
4. Actions retain their existing session and revision guards.

## Search and panels

1. Search uses application color, typography, spacing, border, and focus tokens in dark and light themes.
2. Search includes an accessible close action and Escape dismissal.
3. Application sheets are overlays rather than shell grid rows and never coexist with one another.

## Packaged Windows evidence

The portable lifecycle receipt is authoritative only when it proves clean empty launch, visible TXT content, visible Markdown content, multi-document tabs, direct tab close controls, absence of synthetic fixture names, absence of spurious recovery, and source digest preservation.
