# Implementation Contract: Glitchpad

Generated from `enforcement/documentation-facts.json` under documentation contract `1.0.0`. This file describes the exact delivered kit and remains authoritative offline.

## Exact versions

| Domain | Version |
| --- | --- |
| Brand Canon | `1.3.0` |
| Interface Canon | `1.0.0` |
| Component recipes | `1.1.0` |
| Web/React adapter | `1.1.0` |
| egui adapter | `1.0.2` |
| BrandBuilder | `2.0.3` |
| Brand | `1.1.1` |

Package identity: `glitchpad-brand-1.1.1-bb2.0.3` (`glitchpad-brand-1.1.1-bb2.0.3.zip`)

## Bindings

- **Interface Canon:** `enforcement/interface-canon.json`
- **Component Recipes:** `enforcement/component-recipes.json`
- **Web Adapter:** `web/adapter.json`
- **Web Support Matrix:** `web/support-matrix.json`
- **Egui Adapter:** `native/egui/adapter.json`
- **Egui Support Matrix:** `native/egui/support-matrix.json`

## Inheritance and overrides

Inheritance mode: `shruggietech-house`.

Declared interface overrides:
- None.

Follow authority in this order: `brand.json` -> `enforcement/bundle.json` -> `enforcement/release-impact.json` -> `enforcement/interface-canon.json` -> `enforcement/component-recipes.json` -> `enforcement/version-policy.json` -> `enforcement/documentation-contract.json` -> `enforcement/consumer-contract.json` -> `human instructions that do not conflict`.

## Verification

- `python3 enforcement/brandbuilder/templates/verify.py .`
- `python3 enforcement/brandbuilder/templates/validate_glyph.py brand.json`

Success means zero verifier problems and zero glyph failures.

## Offline recovery

Verify `f8ae954806e9797cbde8270a0660dc16dd6c4018df03f8003ca95e633efc073f` for `enforcement/distributions/shruggie-brandbuilder-2.0.3.skill`, then extract it to `enforcement/brandbuilder`. Use the delivered bundle and never substitute an unspecified latest release.

Capability gaps stay local at `enforcement/capability-gap.example.json` until a human explicitly authorizes upstream submission.

## Migration impact

No approved identity redesign is included. Brand version `1.1.1` remains distinct from package `glitchpad-brand-1.1.1-bb2.0.3`.

| Surface | Classification | Guidance |
| --- | --- | --- |
| Identity | unaffected | Approved logo geometry, source bytes, ownership, and affiliation are unchanged. Glitchpad 1.1.1 and ESO Weave 1.0.2 advance package versions for native role presentation without identity redesign. |
| Palette | required | Consumers using generated semantic color roles must repin the rebuilt kit and retain its measured surface-specific values. |
| Typography | required | Consumers using generated typography bindings must repin the rebuilt kit and its local font declarations. |
| Platform Assets | required | Web, Android, and Windows consumers of affected icon roles must regenerate and repin assets; other platform assets remain optional. |
| Web React | optional | Web and React consumers may adopt the AppFrame and environment contracts when they use those generated surfaces. |
| Egui | required | Native Rust consumers using status or disabled controls should regenerate and repin egui adapter 1.0.2 for explicit readable text roles; ESO Weave must fix its local strong-label call separately. |
| Documentation | required | Readers and consumers using generated guidance should repin the rebuilt kit for native icon role, egui status, and exact-version bundle instructions. |
| Recovery | required | Consumers retaining a kit must preserve the delivered checksummed BrandBuilder recovery bytes and canonical immutable package identity. |

`required` applies to existing use of that surface, `optional` is an available capability, and `unaffected` requires no migration.

For shared architecture and extension guidance, read [/docs/](https://brand.shruggie.tech/docs/). The hosted reference describes only the current generated kit. This bundled contract continues to govern these pinned delivered bytes.

## Brand-specific governed rules

# Agent Contract: Glitchpad

**Read this before writing any UI. It takes a minute and it is binding.**

You are working inside a brand with a fixed vocabulary. If you need a value
that is not in this document, **stop and ask**. Do not invent one, and do not
reach for a stock Tailwind palette class because it is faster.

## The stop condition

Inventing a colour, a spacing value, a radius, a font, or a component prop is
the failure this contract exists to prevent. When the vocabulary below does not
cover what you need, say so and wait.

## Colour: use the slot, never the value

Write `bg-primary`, `text-muted-foreground`, `border-border`. Never write a
hex, an `rgb()`, or `bg-slate-900`.

| Slot | Dark | Light |
| --- | --- | --- |
| `background` | `#0B0C0D` | `#F8F8F6` |
| `foreground` | `#FFFFFF` | `#0A0A0A` |
| `card` | `#121416` | `#FFFFFF` |
| `primary` | `#FFD900` | `#0B0C0D` |
| `muted-foreground` | `#9A9A9A` | `#6B6B6B` |
| `destructive` | `#E9505F` | `#C0293A` |
| `border` / `input` | `#262626` | `#E5E5E5` |

### Three colour mistakes that get made constantly

1. **White text on the accent.** `#FFFFFF` on `#FFD900` measures 1.38:1 and
   fails. The legal foreground is `#000000` at 15.18:1. Use
   `text-primary-foreground` and it is handled.
2. **The bright accent as text on a light surface.** `#FFD900` measures 1.3:1
   on `#F8F8F6`. The light block already substitutes `#0B0C0D`. Never override it.
3. **`#C24000` as text.** It measures 4.03:1 on the dark base. It is a fill.
   Its legal foreground is `#FFFFFF` at 5.21:1.

## Spacing and radius

Spacing scale, in px: 4/8/12/16/24/32/48/64/96/120. Nothing between them.

Radii: `rounded-sm` 6 (chips), `rounded-md` 8 (buttons, inputs, popovers),
`rounded-xl` 12 (cards, dialogs), `rounded-2xl` 16, `rounded-full` (badges).
Never `rounded-none`, never an arbitrary `rounded-[...]`.

Layout: content 1200px, narrow 720px. Gutters 24px then 48px then 80px. Section rhythm 120px then 160px then 200px.

## Type

Space Grotesk for display at 500/700. Geist for body at 400/500. Geist Mono for labels,
code, and metadata at 400.

Asking for an undeclared weight makes the renderer synthesise or substitute a face, which prints badly and forces outlined glyphs into PDFs. In mono, carry emphasis with colour.

## Affiliation

This is a ShruggieTech-owned child brand. The only approved ownership endorsement is `A ShruggieTech project`. Keep it outside the logo clear space.



## Density

Two settings ship, and both are correct in the right place. Default for
marketing and reading surfaces; compact for dense tabular data. Do not invent
a third.

## Components and AppFrame

Read `component-recipes.json` and `../web/adapter.json` before composing shared controls. Use `../tokens/interface.css` for semantic custom properties without React. React consumers import static components from `../web/react/server.tsx` and behavior-heavy controls from `../web/react/client.tsx` with exact `radix-ui@1.6.7`.

`AppFrame` is the application shell owner. It owns safe areas, dynamic viewport behavior, root scrolling, fixed chrome, IME obstruction, titlebar avoidance, and global focus unless the selected browser, Tauri, or Wails profile transfers that one responsibility to the host. Never apply the same inset in native and web layers. Product screens, navigation trees, raw style props, and open-ended element substitution are outside the recipe grammar.

## Icons

lucide, inline SVG, `currentColor`, 1.5 to 2px stroke on a 24 grid. Do not
install another icon library. If lucide lacks a domain symbol, it goes in
`icons/` drawn to the same spec.

## Accessibility, non-negotiable

- Visible 2px focus ring at 2px offset on every interactive element
- Status never carried by colour alone; pair it with a label or a shape
- Respect `prefers-reduced-motion`
- WCAG AA at rendered size

## Copy

Glitchpad copy is direct, calm and matter-of-fact. Put the file and the user task first. Use familiar nouns and verbs. Keep
sentences short.

Headlines name something a reader can act on. Prefer literal product
language such as "View your files." to slogans, mood, or abstract benefit claims.

Do not reach for: mystery and suspense; revelation or transformation metaphors; self-important product claims; language that makes the interface the subject.

Near-black surfaces keep controls visually secondary to file content. Pure sulfur provides identity, focus, and selection; cool slate supplies the fold and subdued states. Muddy and darkened yellows are prohibited.


Never build a sentence out of `X, not Y`, or `X over Y`, or
`rather than merely Z`. It is the clearest tell of machine-written copy.
Avoid em-dashes; use parentheses, commas, or hyphens. No testimonials, no
feature grids standing in for an explanation, no manufactured urgency.

## Before you call it done

```bash
npx eslint --config enforcement/eslint.brand.mjs .
npx stylelint --config enforcement/stylelint.config.json "**/*.css"
python3 enforcement/brandbuilder/templates/verify.py .
python3 enforcement/brandbuilder/templates/validate_glyph.py brand.json
```

A build that fails any of these is not finished, whatever it looks like.
