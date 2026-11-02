# macOS startup historical baseline

`v0.1.4-package-contract.json` is the package contract from Glitchpad source `1d7dcd46689fb0ea68e4cee5c3d43a06d94bc94b`, normalized as UTF-8 JSON. It retains the historical version, extension list and community trust requirements so current candidate validation does not silently reinterpret the published package. Original Glitchpad project source is Apache-2.0.

The comparison downloads the immutable v0.1.4 evidence archive, verifies its pinned SHA-256, extracts only the manifest and DMG, verifies the independently pinned DMG digest, then verifies every installed application byte against the published inventory. Both versions use one current sampler on the same isolated hosted runner. First launch means first process launch within this comparison; later process starts retain warm OS caches. No fresh OS-cold or reference-hardware claim is made.
