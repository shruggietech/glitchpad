# Windows packaging

S019 defines unsigned Windows 11 x86_64 validation candidates for the v0.1.0 package contract. It does not change the repository's official v0.0.0 version and does not publish a release.

`capabilities.json` is the association and native-dialog authority for the stable Markdown, Mermaid, plain-text, and approved source families. `package-contract.json` defines canonical artifact names, inventory, size limits, candidate signature state, and the additional evidence required for official evaluation. The explicit S019 Tauri overlay is validated against both files.

Pull requests and branch runs must label their artifacts unsigned and cannot pass official mode. Official mode requires an authorized `v0.1.0` tag context, trusted and timestamped Authenticode evidence for the final application and installer bytes, a clean-machine receipt, checksums, CycloneDX SBOM, provenance, and exact digest agreement. Signing credentials are release-operator inputs and must never enter the repository or candidate logs.

The portable archive registers no associations. The NSIS installer uses current-user installation, declares only governed stable extensions, preserves user documents and application state on uninstall, and treats WebView2 Evergreen as a system prerequisite.
