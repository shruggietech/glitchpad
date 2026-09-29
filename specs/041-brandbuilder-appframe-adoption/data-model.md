# Data Model: BrandBuilder AppFrame Adoption

## PinnedKitReceipt

- upstream repository, revision, workflow run, and artifact
- manifest and consumer-contract versions
- file path, length, and SHA-256 for each governed file
- import timestamp as observation metadata only

## AppFrameHostContract

- layout variant (`full-bleed`)
- frame and content ownership markers
- safe-area inset variables
- visual viewport height/offset and IME inset variables
- native titlebar ownership declaration
- root scroll ownership

## HostEvidence

- host class (`android-webview` or `windows-tauri`)
- platform/API profile and orientation
- source revision and kit receipt
- command or workflow identity
- measured assertions, result, and limitation

## PilotHandover

- upstream and downstream issues and pull requests
- ordered merge rule
- observations and prospective baseline
- capability gaps and permitted exceptions
- offline recovery and verification entry points
