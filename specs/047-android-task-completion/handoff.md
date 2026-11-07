# S047 owner handoff (incomplete)

S047 remains in installed qualification. [PR #258](https://github.com/shruggietech/glitchpad/pull/258) is open and unmerged, with auto-merge off. Issues #249, #250, #251, #253 and #254 remain open and In Progress. Final owner review is not requested yet.

## Changed behavior

The slice adds compact Android document navigation, managed task surfaces with Back/IME ownership, installed About and offline notices, inert SVG handling, shared image/diagram actions, and editor, Markdown, Mermaid, large-text, metadata and preferences tasks. Android range reads use bounded binary responses on the existing blocking-worker boundary. Dialog cleanup preserves completed document/Add focus handoffs. The installed-APK observer streams framed shell-v2 output with exact-byte equality and retains failed/mismatched observations. Source and package notices retain exact upstream license texts.

Live system font changes now update the existing WebView text scale without replacing its activity and losing native task bounds. Recovery dialogs use the same existing TaskSurface native constraints; duplicate late dimension overrides are removed. Geometry setup uses native taps, recognizes the effective native IME intersection, and requires applied native bounds before the single control scroll. Actual process-restart recovery still measures all real controls at default/maximum font in portrait/landscape. All action deadlines, attempt limits and positive outcome checks remain unchanged.

## Verified checkpoints

All601 frontend tests across68 files, lint, type checking, production build, pinned brand/glyph checks,12 modern and12 Chrome69 recovery profiles pass at their recorded source checkpoints. Regression checks reproduce the old focus/CSS/capture/parser failures before passing the corrections. The current source binding independently matches35 hashes,351 reference updates and0 unresolved/drift, retaining119 controls,459 pending cases,437 supplemental entries and27 issue criteria. Supporting receipt/driver and Android policy suites pass78 and25 tests.

Actual retained APK probes isolate the font-change failure: activity recreation leaves the native viewport null. The manifest-only attempt retains native bounds but correctly fails actual200% text. The completed JVM correction passes actual16px-to32px text scaling and retains native view320x640, visible y48..592 and the bounded recovery dialog. Its original native/frontend payload and changed manifest/JVM identity are recorded separately. This probe is diagnostic and does not qualify the final public candidate. Both APIs have independently verified exact installed APK readbacks at the R51 checkpoint; its failed geometry remains diagnostic.

Two later interaction defects are isolated from physical-touch traces: button focus can dismiss the IME and move its target before click, and API24 CSSOM rounds a fractional heading measurement so string comparisons cause an unbounded style-observer loop. Current local corrections defer touch button focus (including confirmed touch-generated compatibility mouse events) and compare measured pixel values numerically. Three bounded regressions fail against the old public component. These changes pass all606 frontend tests, lint/types/build and12 modern plus12 Chrome69 recovery profiles atfc6b13045dd3e36718c67e7fbd6290ab02985225. All35 freshly bound source hashes independently match,351 reference updates have0 unresolved/drift, and all459 cases remain pending. Native qualification remains running. The Pause test now uses a separate generated infinite animation fixture; all29 original fixture identities remain unchanged and109 core tests pass.

## Remaining gates

T036-T041 remain open: focused geometry on both APIs; all four final Android role/API campaigns and ten journeys; exact APK/destination/receiver readbacks; current aggregate/browser/platform checks; formal Spec-Kit convergence; and119-control/459-case/27-criterion reconciliation. Fresh compiled layout qualification is running at84839f2bf341fb7626a71b3294f66220027ec393 on both APIs. Subsequent privatefc6b13045dd3e36718c67e7fbd6290ab02985225 changes only regression-test lint. Final public source/run/artifact identities will be recorded after qualification. validation.md retains the chronological failures, corrections and archive digests.

## Review boundary

Both authorized external review rounds are used. Round1's two findings are fixed and resolved. Round2 at988818c57efba8c611074c193d6ec5c560987cae returns no findings. Subsequent corrections have no additional external review. No third request or draft/ready toggle is made. Stop unmerged for final owner review; no release, tag or deployment is performed.

## Traceability and unverified behavior

Source/unit/browser evidence, installed debug behavior, signed assembly, publication and physical-device evidence remain distinct. Conditional animation outcomes, unavailable capabilities, unmounted CTRL-114 and passive CTRL-115 are reported individually and cannot inflate native action passes. Original incident bytes, APK hash and trace are unavailable. Physical-device, manual-screen-reader and reference-hardware prerequisites are waived; manual macOS/Linux GUI and VoiceOver checks are unrun. Release reconciliation #244/#255 remains separate.
