---
name: glitchpad-brand
description: Apply the Glitchpad brand system to product interfaces, documentation, repositories, and generated assets.
license: Proprietary. Internal ShruggieTech use.
compatibility: Requires a filesystem for bundled fonts and assets. The optional verification scripts require Python 3.
metadata:
  version: 1.0.0
  canon: 1.0.0
  parent: ShruggieTech
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Glitchpad brand

Read `README.md`, `brand.json`, and `enforcement/AGENTS.md` before producing Glitchpad material.

Glitchpad is a fast, cross-platform viewer and editor for local files. Its voice is direct, calm, and matter-of-fact. Lead with the file or the task. Use familiar terms, short sentences, and specific labels. Product headlines should name a user action. Supporting copy should name relevant file categories or capabilities. Keep product language free of mystery, suspense, transformation, and self-important claims.

Use the supplied logo masters without recomposition. The horizontal lockup retains the approved 160-unit mark, 34-unit gap and optical-center alignment. In the stacked lockup, the mark is 1.80 cap heights with a 0.45-cap gap. Never resize the mark and wordmark independently.

Use the semantic tokens and bundled components. Preserve the document/G mark geometry exactly. Sulfur gold is the identity accent. The inherited orange retains its warning and emphasis role.

Run `build/verify.py` after any kit change. A nonzero problem count blocks delivery.
