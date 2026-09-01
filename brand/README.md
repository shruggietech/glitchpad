# Glitchpad brand system

Glitchpad is a fast, cross-platform viewer and editor for local files. It opens text, source code, Markdown, images, PDFs, DOCX, and ODT files on desktop and Android.

## Build assumptions

- Glitchpad inspects local files and never executes their contents.
- The product name is written as Glitchpad in prose and lowercase only in technical identifiers.
- Sulfur gold carries product identity. The inherited ShruggieTech orange remains reserved for emphasis and warning states.
- The `800 × 1000` rectangular vector master preserves the calculator-shaped `0.8:1` silhouette. Standalone full and reduced mark PNGs are exported on transparent `1024 × 1024` canvases with equal side padding. Lockups and wordmarks retain their natural aspect ratios.

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
| Sulfur Gold | `#FFD900` | Identity, focus, selection, folded corner |
| Sulfur Deep | `#CBAD00` | Hover and active states on dark surfaces |
| Sulfur Accessible | `#867100` | Links and identity text on light surfaces |
| Paper | `#A8A39D` | Full-color document body in the mark |
| ShruggieTech Orange | `#FF5300` | Shared emphasis and warning hue |
| CTA Orange | `#C24000` | Fill with white foreground |
| Fault | `#E9505F` | Failure state on dark surfaces |
| Fault Deep | `#C0293A` | Failure state on light surfaces |

Measured color values and legal foreground pairings live in `brand.json` and `VERIFY.md`. Regenerate those numbers through the build scripts.

## Logo construction

The full-color mark is one solid paper silhouette with a capital G removed as a continuous negative-space channel. The sulfur corner is the recognition detail. It helps the mark stand out in app lists, tabs, and file association menus.

| Measurement | Value |
| --- | ---: |
| Canvas | 800 × 1000 units |
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

Clear space around the mark and every lockup is one `X`, where `X` is the 70-unit G channel on the master mark. Scale `X` with the mark. The supplied SVGs are the canonical compositions.

The shipped SVGs contain filled paths and outlined wordmarks. The reduced master removes the two-color fold treatment and uses one sulfur shape around the negative-space G.

### Prohibited treatments

- Do not detach the G from the paper into a separate glyph.
- Keep sulfur gold exclusive to the folded corner in the full-color mark.
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
