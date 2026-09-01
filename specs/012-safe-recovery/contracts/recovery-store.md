# Contract: Recovery Store

## Root and entry rules

- The native host supplies an application-local root and the platform quota.
- The store rejects a root that is a symbolic link or non-directory.
- Unix-like targets use directory mode `0700` and record mode `0600` where supported.
- Record names are exact lowercase UUIDs with a `.json` suffix; unrelated entries are ignored and never removed.
- Android excludes `recovery-v1` from cloud backup, device transfer, and legacy full backup.

## Snapshot publication

1. Validate the record, timestamps, content bound, and checksum in memory.
2. Serialize once and account for the exact bytes.
3. Remove expired records and eligible superseded coverage under the store lock.
4. Refuse the snapshot if protected coverage plus the candidate exceeds quota.
5. Write a same-directory temporary file, restrict permissions, flush, synchronize, and atomically commit.
6. Preserve the previous committed record on every pre-commit failure.

## Inventory and load

- Metadata size is checked before allocation; each record is parsed independently.
- Expired and corrupt supported-version records are isolated and cleaned deterministically.
- Future-schema records are preserved, counted against quota, and reported as unsupported without parsing their payload.
- A checksum mismatch, filename/envelope mismatch, timestamp violation, oversized field, invalid UTF-8, or malformed JSON never blocks other records or startup.

## Cleanup

- Durable save, explicit discard, and explicit recovery refusal remove exactly one matching record.
- Cleanup is idempotent and leaves unrelated records byte-for-byte unchanged.
- Active or unresolved recovery candidates are never silently evicted.
- Failure to remove a record returns a stable safe warning and never reverses a completed save or discard decision.
