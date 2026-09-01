# Quickstart: Verify S005

## Prerequisites

Use the tool versions pinned by `rust-toolchain.toml`, `.node-version`, and the repository lockfiles. Install dependencies with `pnpm install --frozen-lockfile` when the existing workspace installation is unavailable.

## Automated verification

From the repository root, run:

```powershell
cargo xtask check
```

For focused development, run:

```powershell
cargo test -p glitchpad-core
pnpm --filter @shruggietech/glitchpad test:run
pnpm --filter @shruggietech/glitchpad typecheck
```

## Start the shell

```powershell
pnpm --filter @shruggietech/glitchpad dev
```

Open the local URL printed by Vite. The initial fixture set must demonstrate multiple document tabs, an active document surface, renderer-driven commands, dirty state, and overflow once more than five sessions are present.

## Manual interaction checks

1. Activate tabs by click or tap and confirm the document surface and commands follow the selected session.
2. Use Left Arrow, Right Arrow, Home, End, Ctrl+Tab, and Ctrl+Shift+Tab and confirm activation, selected state, and focus remain synchronized.
3. Use Alt+Shift+Left Arrow and Alt+Shift+Right Arrow to reorder the active tab and confirm focus remains on it.
4. Close a background tab and the active tab, then confirm the active tab follows the deterministic next-then-previous rule.
5. Open the overflow menu, activate an overflow item, and confirm it becomes visible inline without losing any session.
6. Compare sessions with different renderer and source capabilities and confirm unsupported commands are absent rather than disabled placeholders.
7. Close every tab and confirm the remaining interface is a minimal empty document surface.

## Accessibility checks

1. Navigate the entire shell with the keyboard and confirm every interactive element has a visible focus indicator and no focus trap exists.
2. Set browser zoom to 200 percent at a 1280 by 800 viewport and confirm the active tab, close control, overflow trigger, active commands, and document surface remain operable without horizontal page scrolling.
3. Emulate a coarse pointer or use an Android-class touch device and confirm essential targets expose at least a 44 by 44 CSS-pixel activation area.
4. With a screen reader, activate, reorder, and close tabs and confirm concise polite announcements occur without unexpected focus movement.
5. At a 1280 by 800 viewport and 100 percent zoom, confirm persistent chrome consumes no more than 80 CSS pixels and at least 720 CSS pixels remain for the document surface.

## Detection checks

Run the focused Rust tests and inspect failures for evidence order and source representation profiles:

```powershell
cargo test -p glitchpad-core detection
```

The fixtures must include Markdown, a standalone Mermaid document, plain text, recognized source code, conflicting extension and binary content, UTF-8 BOM, UTF-16 BOM in both byte orders, mixed line endings, invalid bytes, and a source larger than the 64 KiB probe.
