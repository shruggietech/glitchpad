#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_enforcement.py: emit the teeth for a ShruggieTech sub-brand kit.

Writes:
    enforcement/AGENTS.md              the agent contract, read before any UI work
    enforcement/eslint.brand.mjs       raw hex banned, raw px banned, font
                                       allowlist, per-component prop allowlists.
                                       ESLint, NOT oxlint: oxlint 1.79 implements
                                       no no-restricted-* rules at all, so an
                                       oxlint-based adherence config silently
                                       never runs.
    enforcement/stylelint.config.json  the CSS-side equivalent

Usage:  python3 gen_enforcement.py <brand-spec.json> <output-dir>
"""
import json, os, sys
from coloraide import Color

HERE = os.path.dirname(os.path.abspath(__file__))

# Components every kit ships, with their declared prop surface.
BASE_COMPONENTS = {
    "Button":         ["variant", "size", "children"],
    "Badge":          ["tone", "children"],
    "Card":           ["children"],
    "Divider":        [],
    "SectionHeading": ["eyebrow", "title", "description"],
    "Input":          ["label", "type", "placeholder", "required", "error"],
    "Textarea":       ["label", "rows", "placeholder", "required", "error"],
    "Select":         ["label", "options", "required", "error"],
}
ALWAYS_OK = ["className", "style", "children", "key", "ref", "id",
             "onClick", "onChange", "onSubmit", "disabled", "aria-label"]

ENUMS = {
    ("Button", "variant"): ["primary", "secondary", "ghost"],
    ("Button", "size"):    ["sm", "md", "lg"],
    ("Badge",  "tone"):    ["accent", "emphasis", "neutral", "danger"],
}

def oklch(h):
    c = Color(h).convert("oklch")
    l, ch, hu = c["lightness"], c["chroma"], c["hue"]
    return "oklch(%.4f 0 0)" % l if ch < 0.0005 else "oklch(%.4f %.4f %.2f)" % (l, ch, hu)

def ratio(a, b): return round(Color(a).contrast(b, method="wcag21"), 2)
def legal_fg(f):
    b, w = ratio("#000000", f), ratio("#FFFFFF", f)
    return "#000000" if b >= w else "#FFFFFF"

def eslint_rules(canon, brand, components):
    fams = canon["typography"]["families"]
    allowed = "|".join(f["name"] for f in fams.values())
    syn = [
        {"selector": r"Literal[value=/#[0-9a-fA-F]{3,8}\b/]",
         "message": "Raw hex colour. Use a design-system token: var(--primary), "
                    "var(--muted-foreground), or a Tailwind class bound to one."},
        {"selector": r"Literal[value=/\b\d+px\b/]",
         "message": "Raw px value. Use a spacing or radius token. The scale is "
                    "4/8/12/16/24/32/48/64/96/120; radii are 6/8/12/16."},
        {"selector": r"Literal[value=/\b(?:rgb|rgba|hsl|hsla)\(/]",
         "message": "Raw colour function. Use a design-system token."},
        # CSS-string form
        {"selector": r"Literal[value=/font-family\s*:\s*(?!['\"]?(?:%s))/i]" % allowed,
         "message": "Font outside the system. Available: %s. Never a fourth family."
                    % ", ".join(f["name"] for f in fams.values())},
        {"selector": r"Literal[value=/font-weight\s*:\s*(?:100|200|300|600|800|900)/]",
         "message": "Weight not shipped. Geist has 400/500, Geist Mono has 400, "
                    "Space Grotesk has 500/700. Anything else synthesises a faux bold."},
        # JSX / JS style-object form: { fontFamily: "...", fontWeight: 800 }
        {"selector": r"Property[key.name='fontFamily'] > Literal[value=/^(?!['\"]?(?:%s))/i]" % allowed,
         "message": "Font outside the system. Available: %s. Never a fourth family."
                    % ", ".join(f["name"] for f in fams.values())},
        # numeric literals need exact matches: esquery does not regex-match numbers
        {"selector": ", ".join(
            "Property[key.name='fontWeight'] > Literal[value=%s]" % w
            for w in (100, 200, 300, 600, 800, 900)) +
            ", Property[key.name='fontWeight'] > Literal[value=/^(100|200|300|600|800|900)$/]",
         "message": "Weight not shipped. Geist has 400/500, Geist Mono has 400, "
                    "Space Grotesk has 500/700. Anything else synthesises a faux bold."},
        {"selector": r"JSXAttribute[name.name='className'] Literal[value=/\b(?:bg|text|border)-(?:slate|gray|zinc|neutral|stone|red|green|blue|emerald|cyan|violet)-\d{2,3}\b/]",
         "message": "Stock Tailwind palette class. Use the semantic slots: "
                    "bg-background, bg-card, text-foreground, text-muted-foreground, "
                    "bg-primary, border-border."},
        {"selector": r"JSXAttribute[name.name='className'] Literal[value=/\brounded-(?:none|full|\[)/]",
         "message": "Radius outside the pegs, unless this is a pill. Use rounded-sm "
                    "(6), rounded-md (8), rounded-xl (12), rounded-2xl (16)."},
    ]
    for comp, props in components.items():
        ok = "|".join(sorted(set(props + ALWAYS_OK)))
        syn.append({
            "selector": "JSXOpeningElement[name.name='%s'] > JSXAttribute > JSXIdentifier[name!=/^(?:%s)$/]" % (comp, ok),
            "message": "<%s> does not accept that prop. Declared: %s." % (comp, ", ".join(props) or "none")})
        for p in props:
            vals = ENUMS.get((comp, p))
            if vals:
                syn.append({
                    "selector": "JSXOpeningElement[name.name='%s'] > JSXAttribute[name.name='%s'] > Literal[value!=/^(?:%s)$/]"
                                % (comp, p, "|".join(vals)),
                    "message": "<%s %s> must be one of %s." % (comp, p, " | ".join(repr(v) for v in vals))})
    return syn

def eslint_flat(canon, brand, components):
    syn = eslint_rules(canon, brand, components)
    body = json.dumps(syn, indent=2, ensure_ascii=False)
    return """// GENERATED by shruggie-brandbuilder/gen_enforcement.py for %s.
// Regenerate this file after changing the source brand specification.
//
// These selectors require ESLint. oxlint 1.79 implements none of the
// no-restricted-* rules used here.
//
//   npx eslint --config enforcement/eslint.brand.mjs .

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parserOptions: { ecmaVersion: "latest", sourceType: "module",
                       ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-restricted-syntax": ["error", ...%s],
      "no-restricted-imports": ["error", { patterns: [{
        group: ["*/components/core/*", "*/components/forms/*"],
        message: "Import design-system components from the package index, not internals.",
      }]}],
    },
  },
  { ignores: ["tokens/**", "**/node_modules/**", "**/.next/**", "**/dist/**"] },
]
""" % (brand["title"], body)


def stylelint(canon, brand):
    return {
        "rules": {
            "color-no-hex": True,
            "declaration-property-value-disallowed-list": {
                "/^(color|background|background-color|border-color|fill|stroke)$/":
                    ["/^#/", "/^rgb/", "/^hsl/"],
                "/^(padding|margin|gap|border-radius)/": ["/^\\d+px$/"],
            },
            "font-family-no-missing-generic-family-keyword": True,
        },
    }

def agents_md(canon, brand):
    a = brand["accent"]["bright"]; al = brand["accent"]["accessible"]
    imm = canon["color"]["immutable"]
    g = canon["geometry"]; fams = canon["typography"]["families"]
    return """# Agent Contract: {title}

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
| `background` | `{base}` | `#F8F8F6` |
| `foreground` | `#FFFFFF` | `#0A0A0A` |
| `card` | `{card}` | `#FFFFFF` |
| `primary` | `{acc}` | `{accl}` |
| `muted-foreground` | `#9A9A9A` | `#6B6B6B` |
| `destructive` | `{fault}` | `{faultd}` |
| `border` / `input` | `#262626` | `#E5E5E5` |

### Three colour mistakes that get made constantly

1. **White text on the accent.** `#FFFFFF` on `{acc}` measures {wr}:1 and
   fails. The legal foreground is `{fg}` at {fgr}:1. Use
   `text-primary-foreground` and it is handled.
2. **The bright accent as text on a light surface.** `{acc}` measures {lr}:1
   on `#F8F8F6`. The light block already substitutes `{accl}`. Never override it.
3. **`{cta}` as text.** It measures {ctar}:1 on the dark base. It is a fill.
   White on it measures {ctaw}:1.

## Spacing and radius

Spacing scale, in px: {scale}. Nothing between them.

Radii: `rounded-sm` 6 (chips), `rounded-md` 8 (buttons, inputs, popovers),
`rounded-xl` 12 (cards, dialogs), `rounded-2xl` 16, `rounded-full` (badges).
Never `rounded-none`, never an arbitrary `rounded-[...]`.

Layout: content {cw}, narrow {nw}. Gutters {gut}. Section rhythm {sec}.

## Type

{disp} for display at 500/700. {body} for body at 400/500. {mono} for labels,
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
""".format(
        title=brand["title"], base=brand.get("surfaces", {}).get("base", "#000000"),
        card=brand.get("surfaces", {}).get("card", "#0D0F12"),
        acc=a, accl=al, fault=imm["fault"]["hex"], faultd=imm["fault-deep"]["hex"],
        wr=ratio("#FFFFFF", a), fg=legal_fg(a), fgr=ratio(legal_fg(a), a),
        lr=ratio(a, "#F8F8F6"), cta=imm["orange-cta"]["hex"],
        ctar=ratio(imm["orange-cta"]["hex"], "#000000"),
        ctaw=ratio("#FFFFFF", imm["orange-cta"]["hex"]),
        scale="/".join(str(x) for x in g["spacing"]["scale_px"]),
        cw=g["layout"]["content_max"], nw=g["layout"]["narrow_max"],
        gut=" then ".join(g["layout"]["gutter"].values()),
        sec=" then ".join(g["layout"]["section_gap"].values()),
        disp=fams["display"]["name"], body=fams["body"]["name"], mono=fams["mono"]["name"])

def main():
    spec, outdir = sys.argv[1], sys.argv[2]
    canon = json.load(open(os.path.join(HERE, "..", "references", "01-canon.json"), encoding="utf-8"))
    brand = json.load(open(spec, encoding="utf-8"))
    comps = dict(BASE_COMPONENTS)
    comps.update(brand.get("domain_components", {}))
    d = os.path.join(outdir, "enforcement"); os.makedirs(d, exist_ok=True)
    def wj(p, o):
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            json.dump(o, f, indent=2, ensure_ascii=False); f.write("\n")
    with open(os.path.join(d, "AGENTS.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(agents_md(canon, brand))
    with open(os.path.join(d, "eslint.brand.mjs"), "w", encoding="utf-8", newline="\n") as f:
        f.write(eslint_flat(canon, brand, comps))
    wj(os.path.join(d, "stylelint.config.json"), stylelint(canon, brand))
    # oxlint and stylelint both reject unknown top-level keys, so provenance
    # cannot live inside the configs. It lives here instead.
    with open(os.path.join(d, "README.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("# Enforcement: %s\n\n"
                "GENERATED by shruggie-brandbuilder/gen_enforcement.py. Regenerate\n"
                "this file after changing the source brand specification.\n\n"
                "| File | Runs with |\n| --- | --- |\n"
                "| `AGENTS.md` | read by the agent before any UI work |\n"
                "| `eslint.brand.mjs` | `npx eslint --config enforcement/eslint.brand.mjs .` |\n"
                "| `stylelint.config.json` | `npx stylelint --config enforcement/stylelint.config.json \"**/*.css\"` |\n\n"
                "Add `tokens/` to `.stylelintignore`. That directory is the one place\n"
                "raw literals are legal, because it is where the tokens are defined.\n\n"
                "Use ESLint for these rules. oxlint 1.79 implements none of the\n"
                "no-restricted-* rules, so an oxlint adherence config never runs.\n" % brand["title"])
    print("wrote %s  (%d components guarded)" % (d, len(comps)))

if __name__ == "__main__":
    main()
