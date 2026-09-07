# Release Readiness Contract

## Inputs

- Current repository revision and v0.1.0 committed evidence.
- Exact invocation context (manual dispatch or `v0.1.0` tag).
- Presence of the five protected Android update-authority values.

## Success

- Repository identity, version, and evidence checks pass.
- Every required secret is non-empty.
- Output confirms readiness without exposing values.
- Manual dispatch ends without tag or release mutation.

## Failure

- The job exits non-zero before artifact gathering or publication.
- Output may name a missing secret but must not print its value.
- No fallback key, candidate authority, partial release, or paid trust requirement is introduced.
