# Research: Ship macOS Package

## Universal application and DMG construction

**Decision**: Build with Tauri's `universal-apple-darwin` target on a native Apple Silicon macOS 15 runner, request both `app` and `dmg` bundles, and verify the final main executable with `lipo` before accepting the candidate.

**Rationale**: Tauri documents native DMG creation and universal Apple targets, while the project requires one artifact containing both architectures. A live architecture inspection prevents an artifact name or build flag from becoming the only evidence.

**Alternatives considered**: Building two unrelated DMGs was rejected because issue #63 requires one universal DMG. Combining prebuilt application directories was rejected because resource and signature drift would be harder to detect.

## Native architecture evidence

**Decision**: Mount and exercise the same uploaded DMG on `macos-15` arm64 and `macos-15-intel` x86_64 GitHub-hosted runners.

**Rationale**: A universal header proves slices exist but does not prove either native host can mount, copy, launch, and remove the distributed product. GitHub's runner inventory identifies those labels as current native arm64 and Intel hosts.

**Alternatives considered**: Rosetta-only testing was rejected because it does not prove the Intel slice on an Intel host. Metadata-only validation was rejected because it cannot prove native execution.

## Candidate and official Apple trust states

**Decision**: Branch and pull-request builds use Tauri's explicit ad-hoc signing identity and remain `candidate_valid`; authorized release builds require a Developer ID Application signature with hardened runtime and secure timestamp, notarize the final outer DMG, retain the accepted result and log, staple the ticket, and verify with `codesign`, `stapler`, and Gatekeeper.

**Rationale**: Tauri documents ad-hoc signing for candidates without an Apple-authenticated identity. Apple requires Developer ID, hardened runtime, secure timestamps, notarization, and stapling for trusted direct distribution. Apple also recommends notarizing the outermost distributed container.

**Alternatives considered**: Treating ad-hoc signing as official was rejected because macOS can still require manual approval. Notarizing only the application was rejected because the DMG is the distributed outer container. `altool` was rejected because Apple no longer accepts it.

## Signing implementation boundary

**Decision**: Let Tauri perform nested application signing with a configured identity, then verify live signatures and final bytes in project-owned tooling. Do not use `codesign --deep` for signing; `--deep` is permitted only as an additional verification traversal.

**Rationale**: Apple warns that `--deep` applies entitlements indiscriminately and can miss nested code in unexpected locations. Project tooling should validate the output instead of implementing a second signing algorithm.

**Alternatives considered**: A recursive custom signing script was rejected as fragile and disproportionate. Fixture-only signature records were rejected because official mode requires live final-byte inspection.

## macOS document delivery

**Decision**: Handle `tauri::RunEvent::Opened` on macOS, convert only `file:` URLs with the URL library's file-path conversion, enqueue them as `Association` deliveries, emit the existing ready event, and focus the main window.

**Rationale**: Tauri exposes `RunEvent::Opened` specifically when macOS asks the application to open resources. Reusing S019's native delivery queue preserves exact-once behavior, content checks, path privacy, and interface compatibility.

**Alternatives considered**: Parsing URL strings manually was rejected because percent encoding and Unicode are security-sensitive. Forwarding URLs to the webview was rejected because native locators must not cross into interface state.

## Stable document declarations

**Decision**: Move S019's stable capability inventory from `packaging/windows` to `packaging/desktop` and make Windows and macOS validators consume it.

**Rationale**: The inventory already describes shared stable renderer capabilities. Copying it would create two public-claim authorities that could drift, while leaving it under Windows would make macOS depend on a misleading platform-specific path.

**Alternatives considered**: Duplicating a macOS inventory was rejected as an architectural defect. Leaving the shared authority named Windows was rejected because the correction is small, compatible, and directly required by S020.

## Supply-chain and clean-host evidence

**Decision**: Bind a normalized application inventory, main-executable digest, DMG digest, checksum file, CycloneDX SBOM, candidate provenance, architecture facts, and versioned clean-host receipt. Candidate receipts may record manual checks as `not_run_candidate`; official receipts require every governed automated and manual result to pass.

**Rationale**: Candidate automation should be truthful about checks that require a release operator while still validating the evidence schema. Official state remains unreachable until every native, accessibility, performance, signature, and notarization fact is complete and current.

**Alternatives considered**: Marking unexecuted manual checks as passing was rejected as false evidence. Requiring release secrets on pull requests was rejected as unsafe and incompatible with fork review.

## Primary references

- [Tauri DMG distribution](https://v2.tauri.app/distribute/dmg/)
- [Tauri macOS application bundles](https://v2.tauri.app/distribute/macos-application-bundle/)
- [Tauri macOS code signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri `RunEvent::Opened`](https://docs.rs/tauri/latest/x86_64-apple-darwin/tauri/enum.RunEvent.html)
- [Apple notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Apple custom notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
- [Apple distribution signing guidance](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac/)
- [Apple packaging guidance](https://developer.apple.com/documentation/xcode/packaging-mac-software-for-distribution)
- [GitHub Actions runner images](https://github.com/actions/runner-images)
