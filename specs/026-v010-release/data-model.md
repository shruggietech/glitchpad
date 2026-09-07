# Data Model: v0.1.0 Release Publication

## Release authority set

| Field | Rule |
| --- | --- |
| Keystore bytes | Required, non-empty, protected, never logged |
| Keystore password | Required, non-empty, protected, never logged |
| Key alias | Required, non-empty, protected, never logged |
| Key password | Required, non-empty, protected, never logged |
| Certificate fingerprint | Required, non-empty, protected during readiness and published later only as governed evidence |

## Readiness run

| Field                  | Rule                                 |
| ---------------------- | ------------------------------------ |
| Source revision        | Current reviewed revision            |
| Invocation             | Manual dispatch or exact release tag |
| Repository evidence    | Must pass existing v0.1.0 checks     |
| Authority availability | All five values present              |
| Publication effect     | None for manual dispatch             |

## State transitions

1. **Prepared**: S001-S025 are merged and release evidence exists.
2. **Reviewing**: S026 changes are locally verified and reviewed in a pull request.
3. **Ready**: S026 is merged and a manual readiness run from current `main` succeeds.
4. **Publishing**: The owner authorizes and pushes the exact `v0.1.0` tag.
5. **Published**: All platform jobs succeed and one immutable GitHub release contains the governed inventory.

Any missing secret, failed check, mismatched tag, failed platform job, existing release, or incomplete inventory transitions the attempt to **Blocked** before publication.
