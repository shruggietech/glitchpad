# Data Model: Android File Opener Correction

## Resolver filter group

| Field | Meaning | Constraint |
| --- | --- | --- |
| Identifier | Stable policy name for one resolver job | Unique within the intent map |
| Actions | Android operations accepted by the group | `ACTION_VIEW` only for opener groups |
| Categories | Required resolver categories | Includes `DEFAULT`; no unrelated category dependency |
| Schemes | URI schemes accepted | `content` only |
| Authorities | Optional provider hosts | Empty for exact-type opaque URI support |
| Path suffixes | Optional URI-path constraints | Empty for exact types; effective only with a governed authority rule |
| Media types | Exact types accepted | No wildcard or broad family |
| Purpose | Exact-type matching or generic-type rejection | Determines validation rules and test matrix |

## Resolver probe

| Field | Meaning | Constraint |
| --- | --- | --- |
| Case ID | Stable synthetic test identifier | Contains no private source identity |
| Action | Requested Android operation | Normally `ACTION_VIEW` |
| Categories | Categories attached to the request | Supports default resolver behavior |
| URI shape | Opaque, suffix-bearing, forbidden, or absent | Synthetic authority and path only |
| Media type | Exact, generic, broad, or unsupported type | Lowercase and bounded |
| Expected result | Eligible or rejected | Derived from one explicit filter group |
| Observed component | Resolved Glitchpad activity, another app, or none | Evidence records only component identity |

## Delivery fixture

| Field | Meaning | Constraint |
| --- | --- | --- |
| Provider class | Controlled document-provider behavior | Local synthetic provider only |
| Document ID | Provider-internal identifier | May intentionally omit an extension |
| Display name | User-visible synthetic name | Safe fixed fixture value |
| Media type | Provider-reported exact type | Governed released type |
| Marker | Safe visible content | Unique per cold or warm case |
| Grant | Scoped read authority | No broad storage permission |

## Android package resolver receipt

| Field | Meaning | Constraint |
| --- | --- | --- |
| Package role | Universal or ARM64 APK | Both roles required |
| API level | Governed runtime level | API 24 or API 36 for instrumentation |
| Filter groups | Normalized final-manifest matchers | Equivalent across APK roles |
| Probe results | Case IDs and eligible/rejected outcomes | No raw URIs or private values |
| Delivery results | Cold and warm visible marker outcomes | Safe synthetic identifiers only |
| Result | Pass or bounded failure category | Redacted and deterministic |
