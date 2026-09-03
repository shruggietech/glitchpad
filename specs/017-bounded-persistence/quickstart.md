# Quickstart: Bounded Local Persistence

## Prerequisites

- Use the repository-pinned Rust, Node.js, pnpm, and Android toolchains.
- Run from the repository root with no network-dependent application service.

## Focused validation

1. Run the persistence domain and host tests for valid, missing, corrupt, oversized, legacy, future-schema, atomic-write, cleanup, reset, and hostile-diagnostic fixtures.
2. Run the frontend persistence gateway, controller, preferences, diagnostics preview, and shell integration tests.
3. Confirm the maximum session projection contains no document text and that dirty sessions contain only opaque recovery references.
4. Confirm a future-schema fixture remains byte-for-byte unchanged after load and unrelated writes.
5. Confirm diagnostic preview and export output are identical and contain none of the hostile fixture sentinels.

## Full validation

Run `pnpm check` and require a real zero exit status. Then audit the diff for dependency changes, raw locators, document-content persistence, unrestricted diagnostic strings, UTF-8 BOMs, and mojibake.

## Expected outcomes

- Supported preferences and safe session context survive restart.
- Storage failures and invalid state degrade to defaults without blocking document work.
- Future-schema state is preserved until an explicit category reset.
- Recovery remains independent and is never deleted by preference, session, or diagnostic cleanup.
- Diagnostic preview/export contains only bounded allowlisted facts.
