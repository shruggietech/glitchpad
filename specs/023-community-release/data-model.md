# Data Model: v0.1.0 Community Release

## Release manifest

| Field          | Type             | Rule                                   |
| -------------- | ---------------- | -------------------------------------- |
| schema_version | integer          | Exactly 1                              |
| version        | semantic version | Exactly 0.1.0                          |
| tag            | string           | Exactly v0.1.0                         |
| repository     | string           | Exactly shruggietech/glitchpad         |
| artifact_names | array            | Exactly eight unique canonical names   |
| trust_states   | object           | One approved state per platform family |
| publication    | enum             | prepared, tagged, published, or failed |

## Platform artifact

Each artifact records canonical name, platform, architecture, version, final-byte SHA-256, positive size, tagged source commit, approved trust state, and complete evidence references.

## Trust state

The closed vocabulary is `unsigned_community`, `adhoc_non_notarized_community`, `repository_attested`, `stable_project_key`, and the non-publishable `blocked_candidate`.

## Publication transaction

The transaction begins `prepared`, reaches `tagged` only for the exact repository and tag, and reaches `published` only after all gates. Any failure occurs before release creation; an existing release is never overwritten.
