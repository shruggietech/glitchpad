# Contract: S040 Selected ICO Entry Export

**Date**: 2026-09-15

## Intent and Regeneration

Only the explicit Export selected entry action grants a native operation. Input is registered source ID, expected revision, bounded selected directory index and UUID. Native code rereads/revalidates ICO, decodes that entry under the common policy and regenerates verified PNG. Frontend bytes, filesystem paths or provider URIs cannot act as rendering/export source authority.

## Destination

Use a native Save As chooser with PNG type/name. Cancellation creates no write. Reject original path/canonical alias/native file identity on desktop and original provider/document identity on Android before opening a writable descriptor. Weak/unknown alias exclusion fails closed where original preservation cannot be established. Existing destination conflicts require reviewed revision-bound explicit overwrite authority; no automatic overwrite is inferred from a rendering capability.

## Commit and Receipt

Revalidate source revision/selection and destination conflict observation immediately before commit. Desktop uses an atomic replacement path where supported. Android retains provider capabilities, exact write verification, cleanup and truthful failure/durability results; partial provider failures must never claim success. Return a bounded path-free receipt and preserve original source identity, bytes, dirty state and source-save restrictions. All exit paths release staged PNG, request and destination authority.
