# Shell Interaction Contract

## Content-first layout

At a reference viewport of 1280 by 800 CSS pixels, combined persistent shell chrome must not exceed 80 CSS pixels and the document surface must receive at least 720 CSS pixels. The shell contains one compact tab row, one active-document command row when commands exist, and the document surface. It contains no dashboard, workspace, sidebar, promotional region, or permanent navigation.

## Tab behavior

| Input | Behavior |
| --- | --- |
| Click or tap a tab | Activate that session. |
| `ArrowLeft` or `ArrowRight` on a tab | Move focus and activation to the preceding or following tab, wrapping at the ends. |
| `Home` or `End` on a tab | Activate the first or last tab. |
| `Ctrl+Tab` or `Ctrl+Shift+Tab` | Activate the next or preceding session. |
| `Ctrl+W` | Close the active session. |
| `Alt+Shift+ArrowLeft` or `Alt+Shift+ArrowRight` | Move the active tab one position and retain focus. |
| Close control | Close its tab and focus the deterministic successor. |
| Overflow trigger | Open a menu containing every non-inline tab in document order. |
| Overflow item | Activate the selected tab and close the overflow menu. |

The tablist exposes selected state, each tab controls its tabpanel, and the active document panel is the only visible tabpanel. Dirty state appears in the accessible tab label and visual indicator.

## Overflow behavior

The default inline capacity is five. When capacity is exceeded, the projection keeps the active tab inline, fills remaining inline slots by nearest document order, and lists every other session in overflow without duplication. Closing or activating a session recomputes the projection deterministically.

## Command behavior

The command bar contains only commands supported by the active renderer, source, and session state. Every command has a visible or programmatically associated label. Keyboard shortcuts appear in accessible descriptions and are not the only means of activation.

A command captures the active session ID and revision when invoked. If either differs before execution, the operation returns a stale-session error and does not retarget the command.

## Accessibility behavior

- Interactive elements use native controls or complete semantic roles and states.
- Keyboard focus is visible and never trapped in the tab strip, command bar, overflow menu, or document surface.
- Essential touch controls expose at least a 44 by 44 CSS-pixel target or sit within an equivalent encompassing activation area under coarse-pointer or narrow-viewport conditions.
- Opening, activating, reordering, and closing documents produce concise polite live-region announcements without moving focus unexpectedly.
- At 200 percent browser zoom, document content, the active tab, close control, overflow trigger, and active commands remain operable without two-dimensional page scrolling.

## Empty state

Closing the final tab displays a minimal empty document surface with a concise status message. It does not introduce a dashboard or persistent navigation.
