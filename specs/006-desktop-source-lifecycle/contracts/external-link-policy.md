# Contract: External Link Policy

## Purpose

This policy separates validation and explicit user intent from the later operating-system launch side effect. It does not provide a generic opener.

## Request

An authorization request contains the raw target and a current native user-activation proof. The proof is single-use and expires when the initiating event dispatch ends.

## Allowed targets

- `https` with an absolute host and no embedded username or password
- `http` with an absolute host and no embedded username or password
- `mailto` with a syntactically valid non-empty address target and no control characters

Scheme matching is case-insensitive and the returned target is normalized by the URL parser.

## Rejected targets

- Missing, expired, replayed, or mismatched user activation
- Relative references and targets without a scheme
- `file`, `javascript`, `data`, `blob`, `shell`, custom application schemes, and every scheme not explicitly allowed
- Embedded credentials, ASCII controls, Unicode line separators, malformed percent escapes, or parser failure
- Any attempt to supply an executable, arguments, environment, working directory, or shell syntax

## Result

Success returns a random one-use authorization ID and normalized target. Failure returns a stable invalid-input or capability-denied error. Tests consume or inspect authorizations without launching another process.
