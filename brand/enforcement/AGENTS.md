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
| `primary` | `#FFD900` | `#867100` |
| `muted-foreground` | `#9A9A9A` | `#6B6B6B` |
| `destructive` | `#E9505F` | `#C0293A` |
| `border` / `input` | `#262626` | `#E5E5E5` |

### Three colour mistakes that get made constantly

1. **White text on the accent.** `#FFFFFF` on `#FFD900` measures 1.38:1 and
   fails. The legal foreground is `#000000` at 15.18:1. Use
   `text-primary-foreground` and it is handled.
2. **The bright accent as text on a light surface.** `#FFD900` measures 1.3:1
   on `#F8F8F6`. The light block already substitutes `#867100`. Never override it.
3. **`#C24000` as text.** It measures 4.03:1 on the dark base. It is a fill.
   White on it measures 5.21:1.

## Spacing and radius

Spacing scale, in px: 4/8/12/16/24/32/48/64/96/120. Nothing between them.

Radii: `rounded-sm` 6 (chips), `rounded-md` 8 (buttons, inputs, popovers),
`rounded-xl` 12 (cards, dialogs), `rounded-2xl` 16, `rounded-full` (badges).
Never `rounded-none`, never an arbitrary `rounded-[...]`.

Layout: content 1200px, narrow 720px. Gutters 24px then 48px then 80px. Section rhythm 120px then 160px then 200px.

## Type

Space Grotesk for display at 500/700. Geist for body at 400/500. Geist Mono for labels,
code, and metadata.

**Geist has no 700 and Geist Mono has no bold.** Asking for a weight that does
not exist makes the renderer synthesise a faux bold, which prints badly and
forces outlined glyphs into PDFs. In mono, carry emphasis with colour.

## Density

Two settings ship, and both are correct in the right place. Default for
marketing and reading surfaces; compact for dense tabular data. Do not invent
a third.

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

Glitchpad copy is direct, calm, and matter-of-fact. Put the file, task, or
current state first. Use familiar nouns and verbs. Keep sentences short.

Headlines name an action a user can take. Supporting copy names the relevant
file categories or capabilities. Prefer literal product language such as
"View your files" over slogans, mood, or abstract benefit claims.

Describe the interface through what users can see or do. Do not frame file
viewing as mystery, revelation, transformation, decoding, or discovery. Keep
the tone useful and literal. Sulfur is a recognition and navigation color. It
identifies Glitchpad and marks selection, active views, and keyboard focus.

Never build a sentence out of `X, not Y`, or `X over Y`, or
`rather than merely Z`. It is the clearest tell of machine-written copy.
Avoid em-dashes; use parentheses, commas, or hyphens. No testimonials, no
feature grids standing in for an explanation, no manufactured urgency.

## Before you call it done

```bash
npx eslint --config enforcement/eslint.brand.mjs .
npx stylelint --config enforcement/stylelint.config.json "**/*.css"
python3 build/verify.py
```

A build that fails any of these is not finished, whatever it looks like.
