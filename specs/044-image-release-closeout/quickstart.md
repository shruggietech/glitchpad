# Quickstart: S044 Validation

Use the approved hidden Docker launcher and persistent validation container on Windows. Native UI qualification runs only in isolated hosted CI.

1. Run focused sampler/comparison tests: `node --test scripts/macos/*.test.mjs`.
2. Run native diagnostic regression tests and unchanged image/fuzz-lock checks.
3. Run `cargo xtask check`, affected package validators and advisory/license gates; observe actual exit status.
4. Push/open official PR, inspect both Mac architecture comparison artifacts and all desktop/Android native jobs; read back all eight package bytes.
5. Resolve every review comment within two rounds; bind final candidate evidence in verification/handoff documents.
6. Stop for owner final review and merge. Runbook publication steps remain separately authorized.
