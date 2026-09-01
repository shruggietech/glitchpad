# Research: Conflict-Safe Recovery

## Decision 1: Separate focus from edit integrity

**Decision**: Keep active/background focus independent from clean/dirty/saving/conflicted/recovery-only integrity. A dirty or conflicted session remains focusable without erasing its safety state.

**Rationale**: The existing Rust lifecycle and TypeScript reducer conflate focus with integrity. TypeScript activation currently turns a conflicted session back into active, while both close paths discard dirty state unconditionally.

**Alternatives considered**: Expanding the existing single lifecycle enum was rejected because focus and save safety are orthogonal and would produce an increasingly invalid transition matrix.

## Decision 2: Bind save completion to an exact operation

**Decision**: A save transaction binds one operation ID, source ID, session revision, expected external revision, payload byte count, and durability classification. Only the matching durable receipt may clear dirty state.

**Rationale**: Numeric session revision alone permits a receipt from another source or operation to clear a dirty session. One-use operation binding also rejects late receipts after more edits.

**Alternatives considered**: Checking only source ID was rejected because a late receipt for the same source can still target an obsolete buffer or revision.

## Decision 3: Use independent atomic JSON records in application-local data

**Decision**: Store one strict UUID-named JSON envelope per recovery record under `app_local_data_dir()/recovery-v1`, using same-directory atomic publication and no global manifest.

**Rationale**: Independent records isolate corruption and make updates replace only the intended record. Application-local data survives crashes without implying roaming or cache semantics.

**Alternatives considered**: A database and global manifest were rejected as disproportionate and as single consistency/corruption points. Cache and roaming roots were rejected because recovery must persist locally and must not roam.

## Decision 4: Reuse atomic-write-file on every target

**Decision**: Move the existing `atomic-write-file` dependency to the cross-platform host dependency set. Apply Unix/Android `0700` directory and `0600` file modes through opened handles where supported; Windows relies on inherited per-user application-data ACLs.

**Rationale**: The dependency already provides same-directory temporary files, synchronized commit behavior, Android support, and an allowed BSD-3-Clause license.

**Alternatives considered**: Hand-rolled temporary naming and rename logic was rejected because it would duplicate a reviewed primitive. A Windows ACL dependency was rejected as disproportionate to the "where supported" requirement.

## Decision 5: Persist hashes, not source authority

**Decision**: Persist domain-separated SHA-256 evidence for source identity and base external revision, plus a bounded display hint. Never serialize `SourceId`, desktop paths, Android provider URIs, grant tokens, or raw `ExternalRevision` identity fields.

**Rationale**: Android document identity can include provider document IDs. Recovery needs equality hints and corruption detection, not authority to reopen a source.

**Alternatives considered**: Persisting the current `ExternalRevision` was rejected because it can disclose provider identifiers. Encryption was rejected because it would require a separately specified key lifecycle and does not replace private-storage permissions.

## Decision 6: Treat SHA-256 as integrity evidence, not authentication

**Decision**: Add direct `sha2` 0.10.9 use for content checksums and domain-separated source/revision hashes.

**Rationale**: It is MIT/Apache-2.0, already transitive in the lockfile, deterministic, and sufficient to detect accidental corruption. An attacker who owns application storage can replace both payload and digest, so no tamper-resistance claim is made.

**Alternatives considered**: Platform-default hashers are not stable persistence formats. Authenticated encryption was rejected as out of scope.

## Decision 7: Bound before allocating and parse one record at a time

**Decision**: Quota is measured from committed serialized bytes. Inventory uses `symlink_metadata`, accepts only strict regular UUID JSON files, rejects oversized metadata before allocation, and parses records independently.

**Rationale**: Recovery files are local but untrusted after abnormal termination or external tampering. Bounded allocation and isolation prevent startup failure and memory amplification.

**Alternatives considered**: Reading the whole directory into memory was rejected because quota and corruption checks must precede payload allocation.

## Decision 8: Narrow inactive eviction to preserve the stronger no-loss rule

**Decision**: "Inactive" eviction eligibility means expired, superseded, explicitly declined/discarded, or covered by a newer confirmed snapshot. Unreviewed crash-recovery candidates and active dirty coverage are protected. If eligible cleanup cannot make space, reject the new snapshot, preserve the previous valid snapshot, and expose coverage-at-risk.

**Rationale**: The broad v0 wording that removes the oldest inactive record conflicts with Issue #50 and TS-FR-009, which require dirty content to survive until save, discard, or recovery refusal. S012 explicitly tightens that prior logic.

**Alternatives considered**: Evicting any non-live record was rejected because a crash candidate may be the user's only remaining copy.

## Decision 9: Use monotonic scheduling and wall-clock expiry

**Decision**: Snapshot scheduling uses monotonic elapsed time with a two-second idle threshold and thirty-second maximum dirty interval. Persisted UTC millisecond timestamps enforce a seven-day maximum with checked arithmetic and defensive future-time validation.

**Rationale**: Wall-clock changes must not disrupt in-process scheduling, while persisted expiry must survive process restarts.

**Alternatives considered**: A background timer service was rejected; the policy exposes deterministic due-time evaluation for host/UI scheduling.

## Decision 10: Recovery never reopens authority by itself

**Decision**: Accepting recovery matches only independently restored native source authority against hashed evidence. When equality cannot be proven, content opens dirty and conflicted with Save As.

**Rationale**: Recovery records must not become a hidden path/URI authority store, especially for temporary or revoked Android grants.

**Alternatives considered**: Persisting reopen locators was rejected for privacy and because Android temporary authority is not restorable.

## Decision 11: Exclude recovery from Android backup and transfer

**Decision**: Exclude `recovery-v1` in modern cloud-backup, device-transfer, and legacy full-backup rules.

**Rationale**: Dirty document text is private local recovery data and must not leave the device through platform backup.

**Alternatives considered**: Relying only on application-private access was rejected because Android backup can export private files unless explicitly excluded.

## Decision 12: Preserve destination truth after late durability failures

**Decision**: When file replacement commits but parent-directory synchronization or post-commit observation fails, report the strongest confirmed guarantee and preserve recovery coverage for revalidation. Never claim the original destination was preserved after commit.

**Rationale**: The existing desktop primitive can return an error after commit, which makes the destination indeterminate to the caller despite complete replacement.

**Alternatives considered**: Mapping every late error to partial-write-prevented was rejected because it is factually wrong after atomic commit.
