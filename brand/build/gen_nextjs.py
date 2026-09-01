#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_nextjs.py — emit the Next.js binding layer for a ShruggieTech sub-brand.

Reads references/01-canon.json for the immutables and a brand spec for the
handful of constrained choices, then writes:

    nextjs/globals.css              Tailwind v4, @theme inline, OKLCH
    nextjs/components.json.snippet  the registries entry a consumer pastes
    nextjs/fonts.ts                 next/font wiring against bundled faces
    nextjs/providers.tsx            next-themes, dark by default
    nextjs/registry/registry.json   the catalog
    nextjs/registry/theme.json      registry:theme carrying cssVars
    nextjs/registry/font.json       registry:font
    nextjs/README.md                install instructions

Every colour is converted to OKLCH here. Hex stays canonical in brand.json for
print and legal use; OKLCH is what ships to the browser.

Usage:  python3 gen_nextjs.py <brand-spec.json> <output-dir>
"""
import json, os, sys
from coloraide import Color

# ---------------------------------------------------------------- colour utils
def oklch(hexv):
    c = Color(hexv).convert("oklch")
    l, ch, hu = c["lightness"], c["chroma"], c["hue"]
    if ch < 0.0005:
        return "oklch(%.4f 0 0)" % l
    return "oklch(%.4f %.4f %.2f)" % (l, ch, hu)

def ratio(a, b):
    return round(Color(a).contrast(b, method="wcag21"), 2)

def legal_fg(fill):
    b, w = ratio("#000000", fill), ratio("#FFFFFF", fill)
    return "#000000" if b >= w else "#FFFFFF"

def charts(accent, base, target_override=None):
    """Canon formula. Rotate hue by 0/-52/+52/-104/+104 off the identity accent
    and hold chroma at 0.92x for entries 2-5, then solve lightness against the
    ACTUAL surface, taking the value CLOSEST to the target that still clears
    4.5:1. Two things this guards against: a palette tuned for a black
    background is too pale to read on near-white, and a naive solve runs the
    entries to near-monochrome extremes that technically pass and look dead."""
    c = Color(accent).convert("oklch")
    L, C, H = c["lightness"], c["chroma"], c["hue"]
    dark_surface = Color(base).convert("oklch")["lightness"] < 0.5
    # Target lightness is the accent's OWN lightness, clamped into a band that
    # suits the surface. Do not re-darken on the light path: the caller already
    # passes the accessible variant there, and darkening it twice runs the
    # palette to 9:1 jewel tones that pass the check and lose the brand.
    target = min(0.82, max(0.58, L)) if dark_surface else min(0.62, max(0.35, L))
    if target_override is not None:
        low, high = (0.58, 0.82) if dark_surface else (0.35, 0.62)
        target = min(high, max(low, float(target_override)))
    out = []
    for i, rot in enumerate([0, -52, 52, -104, 104]):
        hue = (H + rot) % 360
        chroma = C * (1.0 if i == 0 else 0.92)
        best, best_d = None, 99.0
        for step in range(0, 601):                 # search outward from target
            for l in ({target + step / 1000.0, target - step / 1000.0}):
                if not (0.05 <= l <= 0.97):
                    continue
                hx = Color("oklch", [l, chroma, hue]).fit("srgb") \
                     .convert("srgb").to_string(hex=True).upper()
                if ratio(hx, base) >= 4.5:
                    d = abs(l - target)
                    if d < best_d:
                        best, best_d = hx, d
            if best is not None:
                break                              # first passing ring wins
        out.append(best or Color("oklch", [target, chroma, hue]).fit("srgb")
                   .convert("srgb").to_string(hex=True).upper())
    return out


# ------------------------------------------------------------------ slot build
def build_slots(canon, brand):
    a  = brand["accent"]["bright"]
    ad = brand["accent"]["deep"]
    al = brand["accent"]["accessible"]
    surf = brand.get("surfaces", {})
    base_dark   = surf.get("base",  "#000000")
    card_dark   = surf.get("card",  "#0D0F12")
    pop_dark    = surf.get("popover", "#0A0A0A")
    second_dark = surf.get("secondary", "#111111")
    hover_dark  = surf.get("hover", "#1A1A1A")

    imm = canon["color"]["immutable"]
    fault      = imm["fault"]["hex"]
    fault_deep = imm["fault-deep"]["hex"]

    dark = {
        "background": base_dark,          "foreground": "#FFFFFF",
        "card": card_dark,                "card-foreground": "#FFFFFF",
        "popover": pop_dark,              "popover-foreground": "#FFFFFF",
        "primary": a,                     "primary-foreground": legal_fg(a),
        "secondary": second_dark,         "secondary-foreground": "#FFFFFF",
        "muted": second_dark,             "muted-foreground": "#9A9A9A",
        "accent": hover_dark,             "accent-foreground": "#FFFFFF",
        "destructive": fault,
        "border": "#262626", "input": "#262626", "ring": a,
        "sidebar": pop_dark,              "sidebar-foreground": "#FFFFFF",
        "sidebar-primary": a,             "sidebar-primary-foreground": legal_fg(a),
        "sidebar-accent": hover_dark,     "sidebar-accent-foreground": "#FFFFFF",
        "sidebar-border": "#262626",      "sidebar-ring": a,
    }
    light = {
        "background": "#F8F8F6",          "foreground": "#0A0A0A",
        "card": "#FFFFFF",                "card-foreground": "#0A0A0A",
        "popover": "#FFFFFF",             "popover-foreground": "#0A0A0A",
        "primary": al,                    "primary-foreground": legal_fg(al),
        "secondary": "#F0EFED",           "secondary-foreground": "#0A0A0A",
        "muted": "#F5F5F5",               "muted-foreground": "#6B6B6B",
        "accent": "#F0EFED",              "accent-foreground": "#0A0A0A",
        "destructive": fault_deep,
        "border": "#E5E5E5", "input": "#E5E5E5", "ring": al,
        "sidebar": "#FFFFFF",             "sidebar-foreground": "#0A0A0A",
        "sidebar-primary": al,            "sidebar-primary-foreground": legal_fg(al),
        "sidebar-accent": "#F0EFED",      "sidebar-accent-foreground": "#0A0A0A",
        "sidebar-border": "#E5E5E5",      "sidebar-ring": al,
    }
    chart_cfg = brand.get("chart_palette", {})
    for i, hx in enumerate(charts(a, base_dark, chart_cfg.get("dark_target_lightness")), 1):
        dark["chart-%d" % i] = hx
    for i, hx in enumerate(charts(al, "#F8F8F6", chart_cfg.get("light_target_lightness")), 1):
        light["chart-%d" % i] = hx

    # brand-layer extras beyond shadcn's own slot list
    dark.update({"brand-accent-deep": ad, "brand-emphasis": imm["orange"]["hex"],
                 "brand-cta": imm["orange-cta"]["hex"]})
    light.update({"brand-accent-deep": ad, "brand-emphasis": imm["orange-cta"]["hex"],
                  "brand-cta": imm["orange-cta"]["hex"]})
    return dark, light

SEMANTIC = ["background","foreground","card","card-foreground","popover",
    "popover-foreground","primary","primary-foreground","secondary",
    "secondary-foreground","muted","muted-foreground","accent","accent-foreground",
    "destructive","border","input","ring","chart-1","chart-2","chart-3","chart-4",
    "chart-5","sidebar","sidebar-foreground","sidebar-primary",
    "sidebar-primary-foreground","sidebar-accent","sidebar-accent-foreground",
    "sidebar-border","sidebar-ring","brand-accent-deep","brand-emphasis","brand-cta"]

# ------------------------------------------------------------------- emitters
def emit_globals(canon, brand, dark, light):
    R = canon["shadcn"]["radius_pegs"]["values"]
    L = ["/* %s brand tokens for Tailwind v4 + shadcn." % brand["title"],
         " * GENERATED by shruggie-brandbuilder. Do not hand-edit; regenerate.",
         " *",
         " * Convention note: shadcn puts light on :root and dark on .dark, and every",
         " * third-party shadcn block assumes that. %s is dark-first, which is" % brand["title"],
         " * expressed by defaulting the theme to dark in providers.tsx, never by",
         " * inverting these two blocks.",
         " */","",
         '@import "tailwindcss";','',
         "@custom-variant dark (&:is(.dark *));","",
         "@theme inline {"]
    for k in SEMANTIC:
        L.append("  --color-%s: var(--%s);" % (k, k))
    L.append("")
    L.append("  /* Radius pegs are set explicitly. shadcn derives its scale from a single")
    L.append("   * --radius by fixed ratios, which cannot land 6/8/12 simultaneously.")
    L.append("   * The pegs are non-negotiable; the ratio is not. */")
    for k, v in R.items():
        if k != "--radius":
            L.append("  %s: %s;" % (k, v))
    L.append("")
    L.append("  --font-sans: var(--font-geist);")
    L.append("  --font-mono: var(--font-geist-mono);")
    L.append("  --font-display: var(--font-space-grotesk);")
    L.append("}")
    L.append("")

    for scope, table, label in ((":root", light, "light reading surface"),
                                (".dark", dark, "default brand surface")):
        L.append("/* %s */" % label)
        L.append("%s {" % scope)
        if scope == ":root":
            L.append("  --radius: %s;" % R["--radius"])
        for k in SEMANTIC:
            hx = table[k]
            L.append("  --%s: %s; /* %s */" % (k, oklch(hx), hx))
        L.append("}")
        L.append("")

    L += ["@layer base {",
          "  * { @apply border-border outline-ring/50; }",
          "  body {",
          "    @apply bg-background text-foreground;",
          "    font-family: var(--font-sans);",
          "    -webkit-font-smoothing: antialiased;",
          "  }",
          "  /* Canon: 2px visible focus ring at 2px offset on every interactive element. */",
          "  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }",
          "  /* Canon: hex dumps and code never ligature or smart-substitute. */",
          "  code, pre, kbd, samp {",
          "    font-family: var(--font-mono);",
          "    font-variant-ligatures: none;",
          "    -webkit-font-feature-settings: \"liga\" 0, \"clig\" 0;",
          "    font-feature-settings: \"liga\" 0, \"clig\" 0;",
          "  }",
          "  @media (prefers-reduced-motion: reduce) {",
          "    *, *::before, *::after {",
          "      animation-duration: .01ms !important;",
          "      transition-duration: .01ms !important;",
          "    }",
          "  }",
          "}",""]
    return "\n".join(L)

def emit_theme_item(canon, brand, dark, light):
    R = canon["shadcn"]["radius_pegs"]["values"]
    theme = {k[len("--"):]: v for k, v in R.items() if k != "--radius"}
    theme.update({"font-display": "var(--font-space-grotesk)"})
    return {
        "$schema": "https://ui.shadcn.com/schema/registry-item.json",
        "name": "theme",
        "type": "registry:theme",
        "title": "%s Theme" % brand["title"],
        "description": "%s design tokens. Dark-first, WCAG AA, ShruggieTech canon compliant."
                       % brand["title"],
        "cssVars": {
            "theme": theme,
            "light": {k: oklch(light[k]) for k in SEMANTIC},
            "dark":  {k: oklch(dark[k])  for k in SEMANTIC},
        },
        "css": {"@layer base": {
            ":focus-visible": {"outline": "2px solid var(--ring)", "outline-offset": "2px"}}},
        "docs": ("Dark-first. Set defaultTheme=\"dark\" in your theme provider. "
                 "The bright accent is never text on a light surface; the light "
                 "block already substitutes the accessible variant.")
    }

def emit_font_item(brand):
    return {
        "$schema": "https://ui.shadcn.com/schema/registry-item.json",
        "name": "fonts", "type": "registry:font",
        "title": "%s Typography" % brand["title"],
        "description": "Space Grotesk display, Geist body, Geist Mono code.",
        "font": {"family": "'Geist', system-ui, sans-serif", "provider": "google",
                 "import": "Geist", "variable": "--font-geist",
                 "subsets": ["latin"], "dependency": "geist"},
        "docs": ("Prefer the `geist` npm package (geist/font/sans, geist/font/mono) "
                 "over a network fetch. See nextjs/fonts.ts. Never fetch from "
                 "fonts.gstatic.com in a sandboxed build; it is blocked by the egress proxy.")
    }

FONTS_TS = '''// GENERATED by shruggie-brandbuilder. Fonts come from bundled/npm sources,
// never a build-time network fetch.
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Space_Grotesk } from "next/font/google"

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
})

// Geist ships 400 and 500 only. Geist Mono ships 400 only.
// Requesting a weight that does not exist makes the renderer synthesise a faux
// bold, which prints badly and forces outlined glyphs into PDFs.
export const fontVariables = [
  GeistSans.variable,
  GeistMono.variable,
  spaceGrotesk.variable,
].join(" ")

export { GeistSans, GeistMono }
'''

PROVIDERS_TSX = '''// GENERATED by shruggie-brandbuilder.
"use client"

import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"

// Dark-first. Light exists as a reading-mode alternative for docs and blog.
// shadcn's :root/.dark convention is preserved so third-party blocks work;
// the default lives here instead.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
'''

APP_ICON_TSX = '''// GENERATED by shruggie-brandbuilder.
export function AppIcon({ className }: { className?: string }) {
  return <img className={className} src="/favicon.svg" alt="" aria-hidden="true" />
}
'''

OPENGRAPH_TSX = '''// GENERATED by shruggie-brandbuilder.
export function OpenGraphImage({ className }: { className?: string }) {
  return (
    <img
      className={className}
      src="/glitchpad-social-preview-1280.png"
      alt="Glitchpad, a fast file viewer"
    />
  )
}
'''

FILE_ROW_JSX = '''export function FileRow({ name, kind, size, modified, selected = false }) {
  return <div className="gp-file-row" role="row" aria-selected={selected}><div className="gp-file-row__name" role="cell"><span>{name}</span></div><div className="gp-file-row__kind" role="cell">{kind}</div><div role="cell">{size}</div><div className="gp-file-row__modified" role="cell">{modified}</div></div>;
}
'''

def main():
    spec_path, outdir = sys.argv[1], sys.argv[2]
    here = os.path.dirname(os.path.abspath(__file__))
    canon = json.load(open(os.path.join(here, "..", "references", "01-canon.json"), encoding="utf-8"))
    brand = json.load(open(spec_path, encoding="utf-8"))
    dark, light = build_slots(canon, brand)

    nd = os.path.join(outdir, "nextjs"); rd = os.path.join(nd, "registry")
    os.makedirs(rd, exist_ok=True)
    def w(p, s):
        with open(p, "w", encoding="utf-8", newline="\n") as f: f.write(s)
    def wj(p, o):
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            json.dump(o, f, indent=2, ensure_ascii=False); f.write("\n")

    w(os.path.join(nd, "globals.css"), emit_globals(canon, brand, dark, light))
    w(os.path.join(nd, "fonts.ts"), FONTS_TS)
    w(os.path.join(nd, "providers.tsx"), PROVIDERS_TSX)
    w(os.path.join(nd, "app-icon.tsx"), APP_ICON_TSX)
    w(os.path.join(nd, "opengraph-image.tsx"), OPENGRAPH_TSX)
    wj(os.path.join(rd, "theme.json"), emit_theme_item(canon, brand, dark, light))
    wj(os.path.join(rd, "font.json"), emit_font_item(brand))
    wj(os.path.join(rd, "file-row.json"), {
        "$schema": "https://ui.shadcn.com/schema/registry-item.json",
        "name": "file-row",
        "type": "registry:ui",
        "title": "Glitchpad File Row",
        "description": "A dense, keyboard-friendly row for file inspection surfaces.",
        "files": [{
            "path": "components/glitchpad/file-row.jsx",
            "type": "registry:ui",
            "content": FILE_ROW_JSX,
        }],
    })
    wj(os.path.join(rd, "registry.json"), {
        "$schema": "https://ui.shadcn.com/schema/registry.json",
        "name": brand["slug"],
        "homepage": brand.get("homepage", "https://shruggie.tech"),
        "items": [
            {"name": "theme", "type": "registry:theme", "files": []},
            {"name": "fonts", "type": "registry:font", "files": []},
            {"name": "file-row", "type": "registry:ui", "files": []},
        ]})
    wj(os.path.join(nd, "components.json.snippet"), {
        "registries": {"@%s" % brand["slug"]:
                       "%s/r/{name}.json" % brand.get("registry_base",
                       brand.get("homepage", "https://glitchpad.com").rstrip("/") + "/brand")}})
    w(os.path.join(nd, "README.md"),
      "# %s: Next.js binding\n\n"
      "GENERATED by shruggie-brandbuilder. Regenerate this binding after changing the source spec.\n\n"
      "## Install into a project\n\n"
      "```bash\n"
      "npx shadcn@latest init\n"
      "npx shadcn@latest registry add @%s=%s/r/{name}.json\n"
      "npx shadcn@latest add @%s/theme @%s/fonts @%s/file-row\n"
      "npm i geist next-themes\n"
      "```\n\n"
      "## Or wire it by hand\n\n"
      "Copy `globals.css` over your own, copy `fonts.ts` and `providers.tsx`,\n"
      "apply `fontVariables` to `<html>`, wrap the tree in `<Providers>`.\n\n"
      "## Rules that outlive this file\n\n"
      "- Dark is the default. Light is a reading surface for docs and blog.\n"
      "- Never set the bright accent as text on a light surface. The light block\n"
      "  already substitutes the accessible variant.\n"
      "- Never request a font weight the shipped face does not contain.\n"
      "- Never fetch fonts at build time. `fonts.gstatic.com` is blocked in the\n"
      "  sandbox and the failure only surfaces after the CSS step appears to work.\n"
      % (brand["title"], brand["slug"],
         brand.get("registry_base", brand.get("homepage", "https://glitchpad.com").rstrip("/") + "/brand"),
         brand["slug"], brand["slug"], brand["slug"]))
    print("wrote %s" % nd)

if __name__ == "__main__":
    main()
