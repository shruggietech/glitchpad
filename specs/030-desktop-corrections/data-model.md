# Data Model: Desktop Rendering and Shell Corrections

## Markdown presentation lifecycle

| Field | Meaning | Constraint |
| --- | --- | --- |
| Session identity | Active document authority | Must match the surface receiving a result |
| Source revision | Monotonic document content revision | A result is publishable only for the current revision |
| Request generation | Local render-attempt sequence | Older generations are ignored even if they settle later |
| Mode | Rendered or explicit source | Pending and failure never switch to source automatically |
| Status | Idle, scheduled, rendering, ready, empty, failed, or limited | Exactly one visible state is presented |
| Result | Sanitized tree, outline, search text, diagnostics, and measurements | Cleared before a different session or revision starts |
| Recovery action | View source or close document | Remains available after a contained Markdown failure |

### State transitions

1. Eligible rendered document enters `scheduled` with no document-derived pending content.
2. Matching work may advance to `rendering`, `ready`, `empty`, or `failed`.
3. A new session, revision, or request generation invalidates every older result.
4. `failed` preserves an explicit source route and shell controls.
5. User-selected source mode suspends implicit preview disclosure until Preview is invoked.

## Contained document failure

| Field | Meaning | Constraint |
| --- | --- | --- |
| Failure class | Bounded category for the failed surface | Never includes document contents or private source identity |
| Recovery label | User-facing explanation | Must be actionable and nontechnical |
| Reset key | Session, revision, and format tuple | A changed tuple resets the boundary |
| Source capability | Whether explicit source viewing is available | Offered only for compatible text-backed formats |
| Close capability | Whether the affected session can be closed | Must preserve dirty-document safeguards |

## Menu geometry state

| Field | Meaning | Constraint |
| --- | --- | --- |
| Trigger rectangle | Stable menu button bounds | Maximum one-device-pixel variation across disclosure |
| Popup rectangle | Disclosed menu bounds | Remains inside viewport and outside scrollbar hit regions |
| Document client rectangle | Usable content viewport | Width and position do not change on disclosure |
| Scrollbar gutters | Vertical and horizontal scrolling regions | Must not intersect trigger or popup |
| Vertical shell offset | Zero/one-document or tab-strip offset | May change only when tab-strip presence changes |
| Focus owner | Trigger or active menu item | Escape and dismissal restore trigger focus |

## Packaged desktop receipt

| Field | Meaning | Constraint |
| --- | --- | --- |
| Artifact class | Installed or portable Windows package | Both classes are governed |
| Open order | A-to-B or B-to-A sequence | Both orders must pass |
| Visible identity | Synthetic filename and safe marker | Must match the active delivered fixture |
| Surface state | Preview, explicit source, or contained error | Blank and raw pending states fail |
| Menu measurement | Trigger and scrollbar geometry before/after disclosure | Movement or intersection fails |
| Diagnostic result | Bounded pass/failure evidence | Contains no private source data |
