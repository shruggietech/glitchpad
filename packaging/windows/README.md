# Windows packaging

S019 defines Windows 11 x86_64 packages for the v0.1.1 community release.

`../desktop/capabilities.json` is the shared association and native-dialog authority for the stable Markdown, Mermaid, plain-text, and approved source families. `package-contract.json` defines canonical artifact names, inventory, size limits, candidate signature state, and the additional evidence required for official evaluation. The explicit S019 Tauri overlay is validated against both contracts.

Pull requests and branch runs label artifacts as non-publishable candidates. The official v0.1.1 tag publishes the same deliberately unsigned package form with checksums, CycloneDX SBOM, provenance, and explicit `unsigned_community` evidence. Windows may show reputation warnings; users should verify the SHA-256 checksum and use only the ordinary per-application Windows approval flow. Glitchpad does not claim Authenticode, publisher, or Microsoft endorsement.

The portable archive registers no associations. The NSIS installer uses current-user installation, declares only governed stable extensions, preserves user documents and application state on uninstall, and treats WebView2 Evergreen as a system prerequisite.
