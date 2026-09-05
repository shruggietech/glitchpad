# macOS packaging

S020 defines macOS 13+ arm64/x86_64 universal DMG validation candidates for the v0.1.0 package contract. It does not change the repository's official v0.0.0 version and does not publish a release.

`../desktop/capabilities.json` is the shared Finder-association and native-dialog authority. `package-contract.json` governs the canonical DMG, application identity, architectures, inventory, size limits, candidate trust state, and official Apple evidence. `tauri.s020-macos.conf.json` is validated against both contracts.

Branch and pull-request builds use an ad-hoc application signature and explicitly record that notarization and stapling were not attempted. They can pass candidate mode only. Candidate validation reads the staged DMG and application, exact notices, checksums, CycloneDX SBOM, locked-tool provenance, and closed-schema native receipts rather than trusting manifest claims alone. Official mode additionally requires an authorized `v0.1.0` tag context, the exact runtime-authorized Developer ID Application identity, hardened runtime, secure timestamps, accepted notarization and retained log bound to the final DMG, a validated stapled ticket, Gatekeeper acceptance, both native-host receipts, and exact digest agreement.

Certificates, private keys, passwords, API keys, Apple identifiers, and team identifiers are release-operator inputs. They must never enter repository files, candidate artifacts, logs, fixtures, receipts, or provenance.
