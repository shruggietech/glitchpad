# Research: Android File Opener Correction

## Decision 1: Model each resolver job as a separate filter group

**Decision**: Represent every `ACTION_VIEW` job as a filter group and validate the group after Android's same-filter `<data>` merging rules are applied. Keep exact supported media types in a content-scheme group that has no authority or path requirement.

**Rationale**: Android documents that every `<data>` element inside one intent filter contributes to the same matcher and recommends separate filters for distinct combinations. A flat union of actions, types, schemes, and suffixes cannot prove which combinations the installed activity actually accepts.

**Alternatives considered**: Retaining only aggregate set equality misses broken combinations. Creating one filter per media type is correct but unnecessarily duplicates identical action, category, and scheme policy.

**Authority**: [Android intents and intent filters](https://developer.android.com/guide/components/intents-filters), [Android data element](https://developer.android.com/guide/topics/manifest/data-element)

## Decision 2: Exact media type is authoritative for opaque content URIs

**Decision**: Match every released exact media type against `content://` without requiring a path, display name, or provider authority.

**Rationale**: A content provider exposes the resolved media type to Android, while its URI path is an opaque provider identifier and frequently does not contain a filename. Resolver eligibility must therefore use the type supplied with the intent rather than an extension hidden in provider metadata.

**Alternatives considered**: Filename suffixes cannot be matched against `OpenableColumns.DISPLAY_NAME` by the package manager. Accepting a broad media family would claim unsupported formats.

**Authority**: [Android intent data matching](https://developer.android.com/guide/components/intents-filters#Resolution), [IntentFilter API](https://developer.android.com/reference/android/content/IntentFilter)

## Decision 3: Generic types remain bounded and honest

**Decision**: Reject generic-type resolution, including suffix-bearing and opaque URIs, when Android cannot establish an exact supported media type. Document the provider limitation and keep the in-app picker available.

**Rationale**: An opaque URI plus `application/octet-stream` supplies no trustworthy resolver-time signal that distinguishes a supported text document from arbitrary binary content. Glitchpad must not become a universal opener to paper over provider metadata defects.

**Alternatives considered**: `*/*`, `text/*`, and `application/*` violate the issue and security boundary. Sniffing after selection cannot prevent the application from being advertised for unsupported content.

## Decision 4: Query the installed package, then prove delivery

**Decision**: Add instrumentation that calls the Android package manager for a governed resolver matrix and follows successful resolution with cold-start and warm `singleTask` fixture delivery through the existing content-resolver bridge.

**Rationale**: Source XML and flattened manifest inventories cannot establish runtime eligibility. Package-manager queries prove the installed merged manifest, while visible filename and marker assertions prove the selected file reaches the application.

**Alternatives considered**: Static parsing alone caused the original false confidence. Explicit component launches bypass intent resolution and therefore cannot prove chooser eligibility.

## Decision 5: Preserve grouped semantics in final-package evidence

**Decision**: Extend the APK/AAB manifest parser and inventory schema to retain normalized intent-filter groups in addition to aggregate actions, categories, schemes, media types, and extensions. Require equivalent groups for universal and ARM64 APKs.

**Rationale**: Final package roles can drift during manifest merging or variant assembly even when source declarations agree. Grouped evidence makes the security and interoperability contract reviewable and machine-checkable.

**Alternatives considered**: Comparing only raw XML is brittle across tooling output. Aggregate arrays cannot distinguish safe separate filters from an unsafe combined filter.
