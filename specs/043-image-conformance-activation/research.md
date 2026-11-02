# Research: S043

## Qualification reuse

**Decision**: Reuse `image_contract`, `image_decode`, `image_metadata`, `image_family` and `image_family_decode` native suites, image frontend/accessibility tests, and existing three-desktop/API24/API36 CI jobs.

**Rationale**: Existing original fixtures already cover orientations, GIF/WebP composition, SVG denial, independent ICO entries, privacy and provider-export integrity. New fuzz/resource qualification fills a demonstrated evidence gap.

**Alternatives considered**: Rebuilding the engines or treating historical green receipts as current evidence would add unnecessary change or fail exact-candidate qualification.

## Activation authority

**Decision**: Extend `packaging/desktop/capabilities.json`, native desktop chooser/admission, Tauri overlays, Linux MIME registration, Android intent authority and resolver tests together.

**Rationale**: Existing chooser/admission still exposes only the raster subset, while image family rendering already exists. One shared capability matrix must govern every advertised extension.

**Alternatives considered**: Changing public prose alone would create unsupported native claims; making PDF/office changes would exceed the slice.

## Release and evidence policy

**Decision**: Prepare v0.2.0 with an explicit owner-amended automated/hosted evidence policy and preserve published v0.1.4 provenance until publication.

**Rationale**: The owner removes physical-device/manual screen-reader prerequisites. This does not establish either result. Existing community-package trust disclosures, source integrity, license/advisory checks and hosted native evidence remain required.

**Alternatives considered**: Leaving impossible gates binding would contradict the current owner requirement; labeling waived checks as passing would misrepresent evidence.

Research was delegated under the installed `speckit-plan` requirement to qualification and activation research agents. Neither agent changed repository files.
