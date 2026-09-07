# Android Intent Surface Contract

## Purpose

Define the exact Android package declarations through which Glitchpad may receive implemented document families. This contract governs the merged release manifest rather than source fragments alone.

## Exported activity

- `com.shruggietech.glitchpad.MainActivity` is the only exported application activity.
- Launcher delivery uses `android.intent.action.MAIN` plus `android.intent.category.LAUNCHER`.
- External document viewing uses `android.intent.action.VIEW`, `android.intent.category.DEFAULT`, `android.intent.category.BROWSABLE`, and the `content` scheme.
- External single-document sharing uses `android.intent.action.SEND` plus `android.intent.category.DEFAULT`.
- `android.intent.action.SEND_MULTIPLE` is prohibited.

## Stable media-type allowlist

- `application/json`
- `application/toml`
- `application/x-typescript`
- `application/x-yaml`
- `text/css`
- `text/html`
- `text/javascript`
- `text/markdown`
- `text/plain`
- `text/rust`
- `text/vnd.mermaid`
- `text/x-python`

The allowlist must remain traceable to `packaging/desktop/capabilities.json`. Android may use platform-specific mapping metadata, but it may not introduce a family absent from the shared inventory.

## Stable extension allowlist

`cjs`, `css`, `htm`, `html`, `js`, `json`, `jsonc`, `jsx`, `markdown`, `md`, `mermaid`, `mjs`, `mmd`, `py`, `rs`, `toml`, `ts`, `tsx`, `txt`, `yaml`, and `yml`.

Because content-provider URIs do not reliably preserve filenames, MIME declarations remain authoritative for Android resolution. Extension declarations may narrow eligible URI paths when a provider supplies them but must not replace MIME support.

## Prohibited package surface

- No image, PDF, office, archive, executable, APK, or AAB media type or extension.
- No broad external-storage read, write, or manage permission.
- No file-scheme intent delivery.
- No wildcard `*/*`, `application/*`, or `text/*` claim.
- No exported provider, receiver, or service introduced by S022.
- No cleartext-traffic enablement in release packages.

## Automated evidence

The package validator compares the merged APK and AAB manifests with this contract, the Android intent map, and the shared stable capability inventory. Source-manifest text alone is insufficient evidence because manifest merging may add or broaden declarations.

Manual provider interoperability begins after v0.1.0 publication and does not block this contract.
