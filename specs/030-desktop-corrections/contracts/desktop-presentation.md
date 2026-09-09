# Desktop Presentation Contract

## Markdown state contract

- A rendered-mode document exposes exactly one of pending, ready, empty, or failed presentation.
- Pending contains the constant status text `Rendering preview` and no source-derived visible or accessible value.
- Ready contains only the sanitized tree for the current session, revision, and request generation.
- Empty explicitly identifies a valid empty document.
- Failed remains inside the document region and exposes View source plus the normal document Close path.
- A failure in one document cannot unmount the application menu, tab strip when applicable, or another document.

## Sequential-open contract

- A-to-B and B-to-A deliveries activate the newly delivered session and show its matching content.
- Switching tabs cannot retain links, dialogs, outlines, search state, results, or failures from the previous session.
- Same-byte/different-name fixtures remain distinct sessions.
- Same-session revisions invalidate earlier render generations.
- Restored state follows the same identity and failure-containment rules as fresh delivery.

## Menu geometry contract

- The trigger rectangle before open, while open, and after close differs by at most one device pixel.
- Popup width is independent of trigger-shell width.
- Trigger and popup rectangles do not intersect the document's horizontal or vertical scrollbar hit regions.
- Disclosure changes neither document client width nor scroll position.
- Escape, outside pointer, and action dismissal return focus to the stationary trigger.
- Tab-strip presence affects only the documented vertical offset.

## Packaged evidence contract

- The Windows lifecycle gate runs two nontrivial synthetic Markdown fixtures in both orders against final portable and installed artifacts.
- The gate detects blank application or document surfaces, source-only pending sentinels, active filename/content mismatch, missing recovery actions, trigger movement, and scrollbar overlap.
- Failures include only artifact class, test case, bounded state, and safe synthetic marker identifiers.

## README contract

- The Platforms badge is absent from the header.
- The supported-platform section and all unrelated badges and links remain unchanged.
