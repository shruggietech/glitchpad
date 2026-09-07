# macOS packaging

S020 defines the macOS 13+ arm64/x86_64 universal DMG for the v0.1.0 community release.

`../desktop/capabilities.json` is the shared Finder-association and native-dialog authority. `package-contract.json` governs the canonical DMG, application identity, architectures, inventory, size limits, and community trust evidence. `tauri.s020-macos.conf.json` is validated against both contracts.

Branch and pull-request builds use an ad-hoc application signature and record that notarization and stapling were not attempted. The official v0.1.0 tag retains that truthful `adhoc_non_notarized_community` state with checksums, CycloneDX SBOM, provenance, and exact digest agreement. macOS may block the first launch; users should verify the checksum and use the ordinary per-application Open Anyway control. Glitchpad does not claim Developer ID, notarization, Gatekeeper acceptance, or Apple endorsement.

Certificates, private keys, passwords, API keys, Apple identifiers, and team identifiers are release-operator inputs. They must never enter repository files, candidate artifacts, logs, fixtures, receipts, or provenance.
