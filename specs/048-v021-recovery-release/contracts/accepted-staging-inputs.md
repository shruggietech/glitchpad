# Accepted staging inputs

The later owner-authorized annotated v0.2.1 tag carries one UTF-8 JSON object as its entire annotation. This session prepares that object as a review artifact; it does not create or push the tag.

| Field | Required meaning |
| --- | --- |
| schema | Integer 1. |
| version, tag, repository | Exact target identity from packaging/release/package-contract.json. |
| accepted_source_commit | Full SHA actually compiled, installed and independently observed by native/frontend/package evidence. It must equal the tagged checkout. |
| publication_context | qualified_preparation_unpublished. |
| ci | workflow ci.yml, run_id and run_attempt for successful full exact-source CI, including ci-ok and the four ordinary/fault Android campaigns. |
| platforms | Exactly windows, macos, linux and android. Each names its package workflow, successful latest run_id/run_attempt and actual refs/heads source_ref. |
| platforms.*.artifacts | Complete exact artifact set defined by requiredStagingArtifacts in scripts/accepted-release-inputs.mjs. Each entry includes immutable id, name, size_in_bytes, digest with sha256 prefix and created_at. |
| payloads | Exactly the eight target payloads. Each includes name, bytes, sha256 and source_commit equal to accepted_source_commit. |

The consumer checks current run state, latest attempt, required terminal jobs, artifact run/source/time/expiration and complete artifact sets before download. It independently verifies every ZIP and payload, preserves separate artifact directories, revalidates both API release-runtime captures and the configured stable certificate, then invokes strict community assembly. Native receipt manifest digests and exact required practical-use results remain mandatory. No tag-triggered package rebuild is permitted.

An older successful attempt cannot substitute for a newer failed or running attempt. Missing, expired, duplicate, wrong-source, changed-byte or incomplete inputs stop publication. Restaging and qualification require an explicit new accepted record.

The intended tag in a staged desktop manifest identifies the target release. event workflow_dispatch_stage and publication_context staged_unpublished explicitly record that preparation did not publish a tag or release. Linux repository attestation binds the actual staging branch ref, actual source digest, workflow identity, GitHub-hosted runner and workflow_dispatch trigger. It is not relabelled as tag-built evidence after owner merge.

The final PR confirmation supplies the populated accepted record, archive/payload readback index, exact current head, successful checks, external review rounds and explicit unverified limits. A tracked checkpoint receipt cannot contain the hash of its own final commit.
