# S047 issue acceptance map

Candidate evidence is pending until execution. Each criterion remains independently blocking.

| Criterion | Requirement | Candidate gate |
| --- | --- | --- |
| #249 AC1 | FR-001/002 | Launcher and every loaded/error state retain visible document identity, access to Add document, app destinations, and recovery; one document has a title and multiple documents have a reachable switcher. |
| #249 AC2 | FR-004/006 | Gesture/button Back dismisses IME or top transient layer once before navigation; cancellation of predictive Back causes no close/discard; dirty transitions defer to #247. |
| #249 AC3 | FR-005 | Modal phone sheets block background activation, fit the viewport, restore focus on dismissal, and keep completion actions above IME/system bars. Wide inspector behavior is explicitly nonmodal where chosen. |
| #249 AC4 | FR-015/023 | Portrait/landscape, short windows, gesture/three-button navigation, rotation, and 200% Android 14+ font scaling preserve 48dp-equivalent targets, visible focus, labels/states, contrast, and document space. |
| #249 AC5 | FR-003/027 | About/Help remains reachable after a contained failure; version/build match package evidence; links resolve to approved destinations; license notices work offline; no document/diagnostics are uploaded automatically. |
| #249 AC6 | FR-022/023 | Tests exercise the composed React/AppFrame and hosted WebView, with measured geometry and Back/focus transitions. |
| #250 AC1 | FR-007 | A generated/licensed representative SVG corpus renders inert previews when inside the documented supported profile; minimized regression fixtures cover each newly accepted construct and the reported file if supplied safely. |
| #250 AC2 | FR-008/009 | Active content, external URL/file resolution, entity expansion, excessive depth/nodes/pixels/time, and cyclic or unsupported references are refused with distinct stable reason codes without side effects. |
| #250 AC3 | FR-010/014 | Every refusal keeps the shell, original source, and metadata access available and states a useful next action in the content area. Deterministic refusal does not present identical Retry as a fix. |
| #250 AC4 | FR-022/025 | Host/core and actual Android delivery tests distinguish valid-supported, valid-unsupported, malformed, refused-reference, and transient failure cases; package evidence binds the exact APK/source revision. |
| #251 AC1 | FR-011 | Every exposed menu, keyboard, and local Zoom/Fit action changes the same intended viewport or returns a truthful unavailable/failure result; no validation-only success message is shown. |
| #251 AC2 | FR-002/015 | Relevant controls are discoverable and operable without sideways toolbar hunting on narrow portrait, landscape, short windows, IME open, and maximum text scale. Image/diagram content remains dominant; Add document and system gesture areas are clear. |
| #251 AC3 | FR-012/013 | Image pinch/drag, diagram pan, keyboard alternatives, animation Play/Pause/frame navigation, ICO entry selection, and PNG export operate on the correct document with bounded state and visible result. |
| #251 AC4 | FR-014 | No-preview states show the reason and valid next action beside content. Deterministic refusal does not offer an identical Retry as the only path. |
| #251 AC5 | FR-015/022/024 | Real React/AppFrame geometry tests measure every visible action's reachability and 48dp-equivalent target. Hosted Android tests exercise actual controls, focus order, and an exported ICO PNG. Existing unit checks remain lower-level evidence. |
| #253 AC1 | FR-020/021 | Every assigned CTRL ID has a disposition and evidence reference; unmounted CTRL-114 and passive CTRL-115 are explicitly recorded rather than counted as passing interactive controls. |
| #253 AC2 | FR-016 | Editor and search controls fit phone widths and IME states, announce query/match/no-match/invalid states, and perform the intended action once; replace/history change exact intended text only. |
| #253 AC3 | FR-017 | Markdown and Mermaid Read/Edit, source fallback, links, outline, diagram pan/zoom/Fit, and embedded controls preserve document identity, edits, position, and focus; errors remain contained. |
| #253 AC4 | FR-018 | Large-text navigation, search, go-to-line, and copy report actual outcomes, keep position, and use user-facing labels. |
| #253 AC5 | FR-019 | Metadata and preference controls expose current values, validation, scope, and result; copy verifies clipboard outcome and retains sensitive-value confirmation. |
| #253 AC6 | FR-015/023 | Actual composed Android WebView checks cover narrow portrait, landscape, IME, default/maximum font scale (including 200% on Android 14+), 48dp-equivalent targets, meaningful role/name/state, focus, contrast, and Back. Unsupported actions are absent or explained. |
| #254 AC1 | FR-022 | Every matrix row has pass/fail/not-run tied to candidate APK SHA-256, source commit, package identity, Android/API level, actual WebView version, viewport, text scale, and retained logs/screenshots. |
| #254 AC2 | FR-023/025 | API 24 and API 36 hosted provider/WebView paths pass, with a suitable Android 14+ environment for the 200% text-scale row. Flaky attempts and retries remain separate. |
| #254 AC3 | FR-022/024/026 | Tests use the actual composed app and released source-delivery routes; detect blank shell, offscreen controls, false command success, and missing destination writes. |
| #254 AC4 | FR-025 | Failed or unrun required rows stay open and block release; unrelated passing tests do not close this issue. |
| #254 AC5 | FR-028 | Physical-device, manual-screen-reader, and reference-hardware prerequisites remain waived by recorded owner decision. Supplementary checks are reported without false claims. |
| #254 AC6 | FR-023 | GUI/keyboard acceptance uses an explicitly isolated hosted CI desktop. Local checks remain headless and never take owner active-workstation focus. |
