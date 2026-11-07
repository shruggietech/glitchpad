# Mermaid CSSOM compatibility patch

S047 applies `mermaid@12.0.0.patch` through pnpm’s pinned patch mechanism. The patch retains Mermaid 12.0.0 and its original MIT license. Exact upstream integrity, original and modified file hashes, and the patch hash are recorded in [the provenance receipt](../packaging/mermaid-cssom-patch.json).

Mermaid constructs a stylesheet while assembling diagram and C4 styles. Android’s minimum WebView generation does not provide that constructor. The private fallback creates a disabled stylesheet in a separate HTML document and continues to use the browser’s CSSOM parsing and serialization. It does not change the global constructor or install styles in the application document. Native constructable stylesheets and Mermaid’s existing theme CSS fallback retain their behavior.

The runtime gate exercises the application renderer with the native constructor and with constructor support disabled. Exact Chromium 69 and installed Android candidate evidence are recorded separately in the slice validation artifacts. Reassess or remove the patch when upgrading Mermaid; do not carry it forward without comparing upstream behavior and rerunning those checks.
