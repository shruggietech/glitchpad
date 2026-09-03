# Quickstart: Validate Local Markdown Viewing and Editing

## Prerequisites

Use the pinned repository toolchain and install dependencies from the lockfile. Do not enable network access in the application under test.

## Focused Domain Validation

Run the application package tests that cover the parser, sanitizer, URL policy, renderer lifecycle, and Markdown surface.

```powershell
pnpm --filter @shruggietech/glitchpad test:run
```

Expected: supported syntax produces deterministic semantic trees; hostile fixtures create no active properties or navigable URLs; size, stale revision, cancellation, and disposal tests pass.

## Render and Source Workflow

1. Open `fixtures/markdown/sources/kitchen-sink.md` and verify rendered mode is selected.
2. Use the outline and rendered search, including duplicate headings and a footnote.
3. Select Edit, change unrelated text in source mode, then return to preview.
4. Verify the newest revision renders and the raw-text save projection preserves untouched line endings and whitespace.
5. Repeat with a read-only source and verify source remains viewable but cannot be changed.

Expected: supported content is readable, navigation is synchronized, controls remain compact, and source is the only save authority.

## Hostile Input and Link Policy

1. Open every fixture listed as hostile in `fixtures/markdown/corpus.json`.
2. Verify raw HTML appears as text and scripts, handlers, styles, frames, objects, remote images, and unsafe links never execute or request a resource.
3. Activate a permitted HTTPS link and verify the normalized destination is shown before confirmation.
4. Cancel once, then confirm once through a test gateway and verify exactly one host request.
5. Attempt `file:`, `javascript:`, `data:`, protocol-relative, credential-bearing, and malformed targets.

Expected: all forbidden targets remain inert, permitted navigation requires confirmation, and no document-driven network or native call occurs.

## Boundaries and Performance

Run the deterministic performance and size-boundary tests from the application suite. Record the fixture digest, production build profile, host, sample count, median, p95, and maximum in `verification.md`.

Expected: 1 MiB first rendered content is at most 800 ms p95 on the desktop reference profile; 16 MiB remains fully capable; above 16 MiB through 32 MiB uses source mode; existing larger-source and refusal modes remain unchanged.

## Accessibility and Print

At 320 by 640 logical pixels and a desktop viewport, operate mode switching, outline, search, link confirmation, editing, and save by keyboard. Repeat primary controls with touch-sized targets. Run the existing axe-core gate and inspect print preview once on a supported desktop host.

Expected: no critical or serious automated accessibility findings, focus returns predictably, destination disclosures are announced, controls meet the 44-pixel coarse-pointer target, and print preview contains document content without application chrome.

## Complete Repository Gate

Run the aggregate validation in the foreground and evaluate its final exit status before publishing a pull request.

```powershell
pnpm check
```

Expected: Rust, frontend, application, site, browser, dependency, advisory, license, documentation, link, Mermaid, version, UTF-8/no-BOM, mojibake, Android, and repository policy checks complete successfully.
