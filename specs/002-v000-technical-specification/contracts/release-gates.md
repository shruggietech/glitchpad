# Contract: Release Gates

## Authority

The root Rust workspace package version is the canonical product version after repository foundation. `tauri.conf.json`, root and application `package.json`, Android version name, this technical specification, changelog release heading, release tag, artifact names, SBOM metadata, and provenance statements mirror that value. A mismatch blocks release before native builds begin.

## Required gates

| Gate | Required evidence | Failure result |
| --- | --- | --- |
| Specification | Completed release documentation pass, matching specification version, no unreconciled completed slices | Block tag creation |
| Changelog | Assembled non-empty release section from reviewed fragments | Block tag creation |
| Capability claims | Renderer registry, associations, dialog filters, appendix matrix, README, and release notes agree | Block tag creation |
| Source quality | Format, lint, typecheck, unit, contract, integration, property, and required fuzz regression suites pass | Block build fan-out |
| Security | Dependency advisories, license policy, secret scan, CSP tests, parser limits, and hostile corpus pass | Block build fan-out |
| Documentation | Markdown format/lint, internal anchors, external links, Mermaid render, terminology, UTF-8/BOM/mojibake, and version checks pass | Block build fan-out |
| Platform build | Required Windows, macOS, Linux, and Android artifacts build from locked inputs | Block publication |
| Automated package validation | Assembly, inventory, package identity, checksum, size, and supported lifecycle automation pass | Block platform artifact |
| Supply chain | Declared trust state, SHA-256 checksum, SBOM, provenance attestation, `LICENSE`, `NOTICE`, and third-party notices exist | Block platform artifact |
| Final join | Every release-blocking platform and documentation gate succeeds | Permit publication |
| Post-release validation | Assets remain downloadable and checksums valid; manual, accessibility, physical-device, and real-world checks proceed under issue #66 | File defects before v0.2 feature work |

Windows v0.1.0 artifacts are explicitly unsigned community packages. The macOS application is ad-hoc signed and its DMG is not Apple-notarized. These states are valid only when prominently disclosed and must never be represented as platform endorsement. Linux retains repository attestations. Android retains a stable project-owned update key because package installation and upgrade continuity technically require it; private key material remains external to the repository.

## Documentation pass receipt

The release commit must contain a machine-readable receipt listing the target version, prior version, completed Spec Kit slices reviewed, affected specification sections, capability rows changed, platform rows changed, security changes, contributor-tool changes, changelog fragment set, approver, and UTC completion timestamp. Release CI validates the receipt against repository state but does not generate or commit it.

```mermaid
flowchart TB
  prepare["Assemble changelog and documentation pass"] --> review["Review release commit"]
  review --> tagGate{"Version, docs, claims, and licenses agree?"}
  tagGate -->|No| blocked["Release blocked"]
  tagGate -->|Yes| tag["Push vX.Y.Z tag"]
  tag --> verify["Shared quality and security gates"]
  verify --> platform["Four-platform build fan-out"]
  platform --> package["Automated package validation"]
  package --> supply["Record trust, checksum, SBOM, and attest"]
  supply --> join{"All required evidence present?"}
  join -->|No| blocked
  join -->|Yes| publish["Publish official release"]
  publish --> post["Post-release issue #66 validation"]
```
