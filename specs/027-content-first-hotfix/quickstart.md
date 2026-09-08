# Quickstart: Content-First Desktop Hotfix

All repository commands from an interactive Windows desktop run through `scripts/invoke-docker-hidden.ps1` using the prebuilt `glitchpad-validation:local` image. Git and GitHub commands use `scripts/invoke-vcs-hidden.ps1`.

## Focused interface validation

Run formatting, lint, type checks, and the focused shell, tab, delivery, Markdown, and editor tests in the validation container. Expected result: zero failures, zero fixture sessions from the production entry point, and zero serious or critical accessibility violations.

## Production build inspection

Build the frontend without the performance flag and inspect the generated application. Expected result: direct launch exposes the empty state; the fixture names `welcome.md`, `diagram.mmd`, `notes.txt`, `draft.md`, `guide.md`, `architecture.rs`, and `preview.webp` do not appear.

## Windows portable lifecycle

Assemble the Windows portable package, run `scripts/windows/test-portable-lifecycle.ps1` with clean isolated state and real TXT and Markdown fixtures, and inspect its JSON receipt. Expected result: empty launch, both content deliveries, conditional tabs, direct close controls, prohibited-state absence, and document preservation all report `pass`.

## Complete repository gate

Run `cargo xtask check` in the validation container. Expected result: formatting, lint, frontend tests, Rust tests, documentation, security, configuration, performance policy, and package-policy checks all complete successfully before push.
