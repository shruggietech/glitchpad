# Glitchpad brand system

Glitchpad is a fast, cross-platform viewer and editor for local files. It opens text, source code, Markdown, images, PDFs, DOCX, and ODT files on desktop and Android.

## Build assumptions

- Glitchpad inspects local files and never executes their contents.
- The product name is written as Glitchpad in prose and lowercase only in technical identifiers.
- Pure sulfur carries product identity. Muddy and darkened yellow variants are prohibited. The inherited ShruggieTech orange remains reserved for emphasis and warning states.
- The protected `800 × 1000` rectangular page source is uniformly centered inside a permanent `1000 × 1000` square composition. Full, reduced, lockup, desktop, Android, and store forms all retain that square-based glyph.

## Positioning

| Axis | Decision |
| --- | --- |
| Category | Developer tool |
| Role | View and selectively edit common local file formats |
| Audience | Developers, support engineers, reverse engineers, and technical power users |
| Register | Direct and calm |
| Shruggie flourish | Declined |
| Product principle | View your files. |

## Identity color

| Token | Hex | Use |
| --- | --- | --- |
| Pure Sulfur | `#FFD900` | Identity, focus, selection, dark-context square, and light-context page |
| Cool Slate | `#667788` | Fold and subdued identity states |
| Charcoal | `#0B0C0D` | Dark-context page, light-context square, and accessible light-surface text |
| ShruggieTech Orange | `#FF5300` | Shared emphasis and warning hue |
| CTA Orange | `#C24000` | Fill with white foreground |
| Fault | `#E9505F` | Failure state on dark surfaces |
| Fault Deep | `#C0293A` | Failure state on light surfaces |

Measured color values and legal foreground pairings live in `brand.json` and `VERIFY.md`. Regenerate those numbers through the build scripts.

## Logo construction

The glyph is always a square containing the protected rectangular paper silhouette with a capital G removed as a continuous negative-space channel. Dark mode uses a sulfur square with charcoal paper. Light mode uses a charcoal square with sulfur paper. Both retain the cool-slate folded corner.

| Measurement | Value |
| --- | ---: |
| Protected page source canvas | 800 × 1000 units |
| Composed glyph canvas | 1000 × 1000 units |
| Square | 876 × 876 units at a 62-unit inset |
| Square edge | 24 units |
| Page scale in square | 72% |
| Paper | 720 × 900 units |
| G channel | 70 units |
| G-to-paper inset | 70 units on every side |
| Clear-space unit | 70 units, 9.7% of artwork width |
| Reduced-master threshold | 32 px |

### Lockup proportions

The horizontal banner retains its approved fixed composition. `C` is the cap height of the outlined Glitchpad wordmark and governs the stacked variant. Never resize the mark and wordmark independently.

| Lockup | Mark height | Gap | Alignment |
| --- | ---: | ---: | --- |
| Horizontal | 160 master units | 34 master units | Mark and wordmark ink are optically centered |
| Stacked | 1.80C | 0.45C | Mark and wordmark center on the wordmark ink width |

The delivered square master keeps 50 units of clear space between its visible edge and the canvas boundary. The protected page retains its 70-unit G channel and internal inset. Scale those relationships with the supplied canonical compositions, and never resize the mark and wordmark independently.

The shipped SVGs compose the permanent square around byte-identical filled page paths and outlined wordmarks. The reduced master removes the fold while retaining the same square, centered page, and negative-space G.

### Prohibited treatments

- Do not detach the G from the paper into a separate glyph.
- Keep the square enclosure in every full, reduced, lockup, desktop, Android, and store use.
- Use the approved dark and light contextual inversion without muddy or darkened yellow substitutes.
- Do not add fragments, scan lines, glow, bevel, texture, or motion effects.
- Do not alter the paper dimensions, G thickness, or G inset.
- Do not combine the Glitchpad and ShruggieTech marks into one lockup.

## Typography

Space Grotesk handles display text at 500 and 700. Geist handles body and interface text at 400 and 500. Geist Mono handles code, offsets, paths, and metadata at 400. The font binaries and OFL licenses are bundled in `fonts/`.

## Interface behavior

Dark is the default product surface. Light mode is a reading surface. Dense file lists and hex views use the compact density. Marketing and explanatory surfaces use the default density. Every focusable control carries a visible two-pixel focus ring with a two-pixel offset. Status always includes a label or shape.

## Installation

For a non-React surface, load `styles.css`, then `components/components.css`.

For Next.js, follow `nextjs/README.md`. The kit publishes Tailwind v4 and shadcn bindings through the `@glitchpad` registry namespace.

## Verification

Run the scripts from `build/` with the dependencies described in `build/README.md`. Delivery requires zero problems in `VERIFY.md`, a clean PDF render check, a clean pagination check, and visual inspection of every image in `qc/`.

## Parent endorsement

Set `A ShruggieTech project` in Geist Mono, uppercase, with positive tracking. Keep it visually subordinate and outside the product logo clear space.

Names, wordmarks, logos, endorsement lockups, and logo path geometry remain reserved as described in the repository's [brand asset terms](../../LICENSE-BRAND.md).
