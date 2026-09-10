# Android File Opener Contract

## Exact-type resolver contract

- The main activity exposes an `ACTION_VIEW` filter group with `DEFAULT`, the `content` scheme, every governed released media type, and no authority or path constraint.
- An opaque `content://` URI with any governed exact media type resolves to the Glitchpad main activity on API 24 and API 36.
- Eligibility does not depend on URI path, display name, extension, provider identity, persisted permission, or current process state.

## Negative resolver contract

- Glitchpad does not declare unsupported image, PDF, DOCX, ODT, directory, wildcard, broad-family, `file://`, or `ACTION_SEND_MULTIPLE` handling.
- Caller-supplied `text/*`, `application/*`, and `*/*` requests resolve through Android's compatibility matching against Glitchpad's exact declarations; normal content detection governs the delivered document.
- Resolver declarations contain no broad storage permission and no exported component beyond the governed main activity.
- Every opener filter includes `DEFAULT`; unrelated actions and categories cannot combine with opener data rules.

## Generic-provider contract

- Generic media types are opt-in policy values, never wildcards.
- A generic type is intentionally rejected, including for suffix-bearing and opaque URIs, because the resolver cannot safely inspect the provider's display name or content before resolution.
- The v0.1.2 release delta describes this provider limitation without claiming unsupported interoperability.

## Delivery contract

- A resolved cold-start intent carries a scoped read grant and produces the matching synthetic filename and marker in the document viewport.
- A second resolved intent delivered to the running `singleTask` activity activates the second synthetic document and never leaves the first marker as active content.
- Delivery uses the existing Android source bridge and does not convert the provider URI into a desktop path.

## Final-package evidence contract

- Final universal and ARM64 APK inventories retain normalized intent-filter groups as well as aggregate public-surface fields.
- Package validation derives groups from each final merged manifest and requires exact policy equality plus cross-role equality.
- API 24 and API 36 instrumentation query the installed package manager before delivery and record only safe case identifiers, API level, package identity, component identity, and pass/fail state.
