#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_guide_pdf.py: the brand guide, built to the ShruggieTech house standard.

House standard, set by fragcap 1.1.0 and recorded in canon as
pdf-surface-consistency: FULL-BLEED DARK ON EVERY SHEET. The light reading
surface appears only as specimen chips inside dark pages. Consistent eyebrow
and section title top-left, hairline rule above a running footer with a folio,
outlined callout boxes for hard rules.

Do not argue yourself into a light guide on ink-budget grounds. That argument
has been made, produced a document with a floating dark cover panel and white
body pages, and fragcap's changelog already records a light guide for a
dark-first brand as the defect 1.1.0 fixed.

Prose: every section reads brand.json `guide.<key>` when present and falls back
to a default generated from the measured values, so two operator inputs still
produce a complete document.

    python3 build/gen_guide_pdf.py <brand.json> <kit-dir> [--html-only]
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _guidekit import tokens, faces, asset, copy_for

def chips(t, keys, light=False):
    o = ""
    for k in keys:
        if k not in t: continue
        o += ('<div class="sw"><div class="chip" style="background:%s;border-color:%s"></div>'
              '<div class="m">%s</div><div class="m dim">%s</div></div>'
              % (t[k], "#D6DAE2" if light else "#26304A", k, t[k]))
    return o

def _personality(B):
    rows = (B.get("guide") or {}).get("personality") or [
        ["Precise", "Exact units and observable outcomes", "Round numbers"],
        ["Bounded", "States what it does not cover", "Implied magic"],
        ["Competent", "Assumes a capable reader", "Condescending tutorials"]]
    prom = (B.get("guide") or {}).get("promises") or [
        "Every number shown is a measurement that happened.",
        "Unknowns are labelled as unknowns.",
        "Terminology stays identical across CLI, docs and interface."]
    return ('<div class="two" style="margin-top:4mm"><div class="card"><div class="ey">Personality</div>'
            '<table><tr><th>Trait</th><th>Expression</th><th>Avoid</th></tr>%s</table></div>'
            '<div class="card"><div class="ey">Promises</div><ul class="m dim" '
            'style="line-height:1.9">%s</ul></div></div>'
            % ("".join("<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % tuple(r) for r in rows),
               "".join("<li>%s</li>" % p for p in prom)))

def _scope(B):
    g = B.get("guide") or {}
    ins = g.get("in_scope") or ["The behaviour the product measures or manages",
                                "The surfaces it owns end to end"]
    out = g.get("out_of_scope") or ["Anything the product infers rather than observes",
                                    "Adjacent problems it deliberately declines"]
    edge = g.get("sharp_edge") or "State the product limits in plain language."
    return ('<div class="rule"></div><div class="three">'
            '<div class="card"><div class="ey">In scope</div><ul class="m dim" style="line-height:1.9">%s</ul></div>'
            '<div class="card"><div class="ey">Out of scope</div><ul class="m dim" style="line-height:1.9">%s</ul></div>'
            '<div class="card"><div class="ey">Limits</div><p class="m dim" style="margin:0">%s</p></div>'
            '</div>' % ("".join("<li>%s</li>" % x for x in ins),
                        "".join("<li>%s</li>" % x for x in out), edge))

def _semantics(B, D, A, OR, FA):
    return ('<div class="two"><div class="card"><div class="ey">Semantic use</div><table>'
            '<tr><th>Colour</th><th>Means</th></tr>'
            '<tr><td style="color:%s">Accent</td><td>Primary value, selection, links, focus</td></tr>'
            '<tr><td style="color:%s">Orange</td><td>Needs attention, threshold exceeded</td></tr>'
            '<tr><td style="color:%s">Fault</td><td>Failed or timed out. Always with text.</td></tr>'
            '</table></div><div class="card"><div class="ey">Colour vision</div>'
            '<p class="dim" style="margin:0">The emphasis orange and the failure red sit close in hue '
            'and are not reliably separable under deuteranopia. That is acceptable only because state '
            'is never carried by colour alone: every state ships a written label.</p></div></div>'
            % (A, OR, FA))

def _scales():
    disp = [("display-xl", 72, "-0.030em"), ("display-lg", 56, "-0.025em"),
            ("display-md", 40, "-0.020em"), ("display-sm", 28, "-0.015em"),
            ("display-xs", 20, "-0.010em")]
    body = [("body-lg", 18.4, 1.60), ("body-md", 16, 1.70), ("body-sm", 14, 1.60),
            ("body-xs", 12, 1.50), ("eyebrow", 12, "0.12em caps")]
    return ('<div class="rule"></div><div class="two">'
            '<div class="card"><div class="ey">Scale, display</div><table>'
            '<tr><th>Token</th><th>Size</th><th>Tracking</th></tr>%s</table></div>'
            '<div class="card"><div class="ey">Scale, reading</div><table>'
            '<tr><th>Token</th><th>Size</th><th>Leading</th></tr>%s</table></div></div>'
            % ("".join("<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % r for r in disp),
               "".join("<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % r for r in body)))

def _ships(kit):
    """Read from the kit that actually exists rather than a hardcoded list."""
    want = [("logos/svg", "Vector masters, every lockup and colourway"),
            ("favicons", "SVG, multi-entry ICO, touch, android, manifest"),
            ("fonts/woff2", "Web faces plus OFL licences"),
            ("tokens", "CSS and JSON with measured contrast"),
            ("nextjs", "globals.css, shadcn registry, fonts, provider"),
            ("enforcement", "AGENTS.md, ESLint, stylelint"),
            ("qc", "Contact sheets. Proof somebody looked."),
            ("guidelines", "The system rendered from itself")]
    rows = []
    for d, desc in want:
        p = os.path.join(kit, *d.split("/"))
        if os.path.isdir(p):
            n = sum(len(f) for _, _, f in os.walk(p))
            rows.append("<tr><td>%s/</td><td>%s</td><td>%d</td></tr>" % (d, desc, n))
    if not rows: return ""
    half = (len(rows) + 1) // 2
    tbl = lambda rs: ('<table><tr><th>Path</th><th>Contents</th><th>n</th></tr>%s</table>' % "".join(rs))
    return ('<div class="rule"></div><h3>What ships in the kit</h3>'
            '<div class="two"><div>%s</div><div>%s</div></div>'
            % (tbl(rows[:half]), tbl(rows[half:])))


def _variants(kit, slug, img):
    """Show the colourways that were actually produced, at the sizes they matter."""
    from _guidekit import b64 as _b64
    pngs = os.path.join(kit, "logos", "png")
    def has(n):
        p = os.path.join(pngs, n)
        return _b64(p) if os.path.exists(p) else None
    cells = []
    for fn, label, lite in (
        ("%s-horizontal-color-1024.png" % slug, "Horizontal, product surface", False),
        ("%s-mark-color-1024.png" % slug, "Mark", False),
        ("%s-horizontal-light-1024.png" % slug, "Light surface", True),
        ("%s-mark-reduced-color-1024.png" % slug, "Reduced master", False)):
        b = has(fn)
        if not b: continue
        cells.append('<div class="card%s" style="text-align:center;padding:5mm 2mm">%s'
                     '<div class="m dim" style="margin-top:3mm">%s</div></div>'
                     % (" lite" if lite else "",
                        img(b, "", "height:%dmm" % (7 if "horizontal" in fn else 9)), label))
    return "" if not cells else '<div class="grid4" style="margin-top:4mm">%s</div>' % "".join(cells)

def _charttable(D, L, B):
    rows = "".join("<tr><td>chart-%d</td><td>%s</td><td>%s</td></tr>"
                   % (i, D.get("chart-%d" % i, ""), L.get("chart-%d" % i, "")) for i in range(1, 6))
    return ('<div class="two" style="margin-top:4mm"><div class="card"><div class="ey">'
            'Derived values</div><table><tr><th>Series</th><th>Dark</th><th>Light</th></tr>%s</table>'
            '</div><div class="card"><div class="ey">Rules of use</div>'
            '<p class="m dim" style="margin:0">Series order is fixed: chart-1 is always the primary '
            'measurement. Never reorder to make a chart look better. Never introduce a sixth colour; '
            'past five series, switch to a form that does not depend on hue. A series never uses the '
            'emphasis orange or the failure red, because those carry state.</p></div></div>' % rows)


def build(B, kit):
    D, L = tokens(kit)
    slug, title = B["slug"], B["title"]
    A, AL = D["primary"], L["primary"]
    AD = D.get("brand-accent-deep", A)
    OR, FA = D["brand-emphasis"], D["destructive"]
    BG, CARD, LINE = D["background"], D["card"], D["border"]
    TX, MU = "#F2F5FA", "#8B95A8"
    M = B.get("measured", {})
    sep = M.get("hue_separation_deg", {})
    near = min(sep.values()) if sep else None
    LG = B.get("logo", {})
    grid = LG.get("grid", 512); cs = LG.get("clear_space_units", 60)
    canvas_width = LG.get("canvas_width", grid); canvas_height = LG.get("canvas_height", grid)
    artwork_width = LG.get("artwork_width", canvas_width)
    lockups = LG.get("lockups") or {}
    horizontal_lockup = lockups.get("horizontal") or {}
    stacked_lockup = lockups.get("stacked") or {}
    mono_logo = asset(kit, "%s-horizontal-color-1024.png" % slug)
    mono_light = asset(kit, "%s-horizontal-light-1024.png" % slug)
    def img(b, cls="", st=""):
        return '' if not b else '<img class="%s" style="%s" src="data:image/png;base64,%s">' % (cls, st, b)

    F = faces(kit)
    css = """
%s
@page { size:A4; margin:0; }
* { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
html,body { margin:0; padding:0; background:%s; color:%s;
  font-family:Geist,system-ui,sans-serif; font-size:8.3pt; line-height:1.6; }
h1,h2,h3 { font-family:'Space Grotesk'; margin:0; }
h2 { font-weight:700; font-size:16pt; letter-spacing:-.02em; line-height:1.12; margin-bottom:4mm; }
h3 { font-weight:500; font-size:9.6pt; margin:5mm 0 2mm; }
p { margin:0 0 2.6mm; }
.dim { color:%s; }
.m { font-family:'Geist Mono'; font-size:5.9pt; letter-spacing:.02em; }
.ey { font-family:'Geist Mono'; font-size:5.9pt; letter-spacing:.16em; text-transform:uppercase;
  color:%s; margin-bottom:2mm; }
.pg { position:relative; width:210mm; height:297mm; background:%s;
  padding:16mm 16mm 18mm 16mm; overflow:hidden; break-after:page; }
.pg:last-child { break-after:auto; }
.pg::after { content:""; position:absolute; left:16mm; right:16mm; bottom:11mm;
  height:.25mm; background:%s; }
.foot { position:absolute; left:16mm; right:16mm; bottom:6mm; display:flex;
  justify-content:space-between; font-family:'Geist Mono'; font-size:5.4pt;
  letter-spacing:.14em; text-transform:uppercase; color:#5B6577; }
.cover { padding:0; }
.cover .inner { position:absolute; inset:0; padding:24mm 20mm 20mm 20mm; }
.cover img.lockup { display:block; width:160mm; height:auto; margin-top:12mm; }
.cover .sys { margin:0; font-family:'Geist Mono'; font-size:5.9pt;
  letter-spacing:.16em; text-transform:uppercase; color:%s; }
.cover .message { margin-top:20mm; padding:1mm 0 1mm 7mm; border-left:1mm solid; }
.cover .tag { margin:0; font-family:'Space Grotesk'; font-weight:600; font-size:23pt;
  letter-spacing:-.025em; line-height:1.08; max-width:145mm; }
.cover .idea { margin-top:4mm; font-size:10pt; color:%s; max-width:132mm; }
.cover .base { position:absolute; left:20mm; bottom:18mm; font-family:'Geist Mono';
  font-size:5.6pt; letter-spacing:.14em; text-transform:uppercase; color:#5B6577; }
.two { display:grid; grid-template-columns:1fr 1fr; gap:7mm; }
.three { display:grid; grid-template-columns:1fr 1fr 1fr; gap:5mm; }
.grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:3.4mm; margin:3mm 0 4mm; }
.grid5 { display:grid; grid-template-columns:repeat(5,1fr); gap:2.8mm; margin:3mm 0 4mm; }
.sw .chip { height:13mm; border-radius:1.6mm; border:.25mm solid; }
.sw .m { margin-top:1mm; }
.card { background:%s; border:.25mm solid %s; border-radius:2.6mm; padding:4.5mm; }
.card.lite { background:#FFFFFF; border-color:#D6DAE2; color:#0A0A0A; }
.card.lite .dim { color:#6B6B6B; }
.rule { height:.25mm; background:%s; margin:4.5mm 0; }
table { width:100%%; border-collapse:collapse; font-family:'Geist Mono'; font-size:6.1pt; }
th { text-align:left; font-weight:400; text-transform:uppercase; letter-spacing:.13em;
  font-size:5.5pt; color:%s; padding:1.6mm 2mm; border-bottom:.25mm solid %s; }
td { padding:1.6mm 2mm; border-bottom:.25mm solid #17202F; vertical-align:top; }
.kv { display:grid; grid-template-columns:30mm 1fr; gap:1.4mm 4mm; }
.kv .k { font-family:'Geist Mono'; font-size:5.7pt; text-transform:uppercase;
  letter-spacing:.13em; color:%s; padding-top:.5mm; }
.callout { border:.25mm solid %s; border-left:1mm solid %s; border-radius:1.6mm;
  padding:3.4mm 4mm; margin:4mm 0; background:#160C06; }
.callout .ey { color:%s; }
.callout.acc { border-color:%s; border-left-color:%s; background:#0E0C1E; }
.callout.acc .ey { color:%s; }
.badge { font-family:'Geist Mono'; font-size:5.5pt; letter-spacing:.1em; text-transform:uppercase;
  border:.25mm solid currentColor; border-radius:9mm; padding:.5mm 2mm; }
.charts { display:flex; gap:1.6mm; align-items:flex-end; height:22mm; margin:3mm 0 1mm; }
.charts div { flex:1; border-radius:1.2mm 1.2mm 0 0; }
ul { margin:1mm 0 0; padding-left:4mm; } li { margin-bottom:1.4mm; }
""" % (F, BG, TX, MU, A, BG, LINE, A, MU, CARD, LINE, LINE, MU, LINE, MU, OR, OR, OR, A, A, A)

    def foot(n):
        return '<div class="foot"><span>%s brand system</span><span>%02d</span></div>' % (slug, n)
    def pg(ey, h2, body, n):
        return '<div class="pg"><div class="ey">%s</div><h2>%s</h2>%s%s</div>' % (ey, h2, body, foot(n))

    dark_bars = "".join('<div style="background:%s;height:%d%%"></div>' % (D["chart-%d" % i], 34 + i * 13)
                        for i in range(1, 6))
    light_bars = "".join('<div style="background:%s;height:%d%%"></div>' % (L["chart-%d" % i], 34 + i * 13)
                         for i in range(1, 6))

    pages = []
    pages.append('<div class="pg cover"><div class="inner">'
                 '<div class="sys">Brand &amp; design system</div>%s'
                 '<div class="message" style="border-color:%s"><div class="tag">%s</div><div class="idea">%s</div></div>'
                 '<div class="base">A ShruggieTech project &nbsp;·&nbsp; Version %s &nbsp;·&nbsp; '
                 'Canon %s &nbsp;·&nbsp; %s</div></div></div>'
                 % (img(mono_logo, "lockup"), A,
                    copy_for(B, "idea", B.get("brand_idea", B["title"])),
                    copy_for(B, "descriptor", B.get("descriptor", "")),
                    B.get("version", "1.0.0"), B.get("canon", "1.0.0"),
                    B.get("homepage", "").replace("https://", "")))

    pages.append(pg("Product", copy_for(B, "foundation_title", "What %s is" % title),
        '<p>%s</p><div class="kv" style="margin-top:5mm">%s</div>'
        '<h3>Product principle</h3><p style="font-family:\'Space Grotesk\';font-weight:500;'
        'font-size:11pt;color:%s">%s</p>%s%s' % (
            copy_for(B, "foundation", B.get("descriptor", "")),
            "".join('<div class="k">%s</div><div>%s</div>' % (k, v) for k, v in [
                ("Descriptor", B.get("descriptor", "")),
                ("Parent", "ShruggieTech, shared typography and dark-first discipline, independent identity"),
                ("Register", B.get("register", "precise-dry")),
                ("Flourish", "Declined" if not B.get("shruggie_flourish") else "Permitted, once per view"),
                ("Casing", "The product name is lowercase in prose and technical identifiers."
                 if B.get("wordmark_text", title).islower()
                 else "Write %s in title case in prose. Use lowercase for technical identifiers." % title),
            ]), A, B.get("brand_idea", title), _personality(B), _scope(B)), 2))

    pages.append(pg("Logo system", "Marks and lockups",
        '<p>%s</p><div class="card" style="text-align:center;padding:9mm 4mm;margin:4mm 0">%s</div>'
        '<div class="two"><div><h3 style="margin-top:0">Clear space</h3>'
        '<p class="dim">One clear-space unit on every side: %d units on the %d × %d canvas, '
        '%.1f percent of artwork width. No text, border, icon or crop enters that band.</p></div>'
        '<div class="card"><div class="ey">Minimum size</div><table>%s</table>'
        '<p class="m dim" style="margin-top:3mm">Below %d px the reduced master takes over. '
        'It ships as its own file. Do not rasterise the full mark down at runtime.</p></div></div>'
        '<div class="rule"></div><h3>Fixed lockup proportions</h3>'
        '<table><tr><th>Lockup</th><th>Mark height</th><th>Gap</th><th>Alignment</th></tr>'
        '<tr><td>Horizontal</td><td>%.0f units</td><td>%.0f units</td><td>Optical center</td></tr>'
        '<tr><td>Stacked</td><td>%.2fC</td><td>%.2fC</td><td>Centered on wordmark ink width</td></tr></table>'
        '<p class="m dim">The horizontal row records its approved master composition. C is the outlined wordmark cap height used by the stacked lockup. X is the 70-unit G channel. Keep one X '
        'clear around every master and never resize the mark and wordmark independently.</p>'
        '<div class="callout"><div class="ey">Prohibited</div><p style="margin:0" class="dim">'
        'No rotation, skew, stretch, outline, bevel or glow. Never recolour individual elements. '
        'Never set the wordmark in live text or a substitute typeface. Never combine the %s and '
        'ShruggieTech marks into one lockup.</p></div>' % (
            copy_for(B, "logo", "The mark is built on a declared grid and ships as filled outlines, "
                                "never live text."),
            img(mono_logo, "", "height:17mm"), cs, canvas_width, canvas_height, 100.0 * cs / artwork_width,
            "".join("<tr><td>%s</td><td>%s px</td></tr>" % (k, v)
                    for k, v in (LG.get("min_px") or {}).items()),
            LG.get("reduced_below_px", 32),
            float(horizontal_lockup.get("mark_height_units", 160.0)),
            float(horizontal_lockup.get("gap_units", 34.0)),
            float(stacked_lockup.get("mark_height_c", 1.8)),
            float(stacked_lockup.get("gap_c", 0.45)), slug) + _variants(kit, slug, img), 3))

    pages.append(pg("Colour", "Palette",
        '<p>%s</p><h3 style="margin-top:4mm">Accents on dark surfaces</h3><div class="grid4">%s</div>'
        '<h3>Neutrals, dark surfaces</h3><div class="grid4">%s</div>'
        '<div class="card lite" style="margin-top:4mm"><div class="ey" style="color:%s">'
        'Light reading surface</div><div class="grid4" style="margin-bottom:0">%s</div></div>'
        '<div class="callout"><div class="ey">Light surfaces</div><p style="margin:0" class="dim">'
        'The bright accent %s measures <b style="color:%s">%s:1</b> on the light reading surface and is '
        'never text there. The light token block substitutes %s at %s:1 automatically. The legal '
        'foreground on an accent fill is %s at %s:1. Every fill token in brand.json carries its '
        'measured foreground.</p></div>' % (
            copy_for(B, "palette", "Dark and close to monochrome. The accent is the signal; the "
                                   "inherited orange marks a state needing attention."),
            chips(D, ["primary", "brand-accent-deep", "brand-emphasis", "destructive"]),
            chips(D, ["background", "card", "secondary", "border"]),
            AL, chips(L, ["primary", "background", "muted", "muted-foreground"], True),
            A,
            TX,
            (B.get("color", {}).get("accent-bright", {}).get("contrast", {}) or {}).get("on_light_base", "?"),
            AL,
            (B.get("color", {}).get("accent-accessible", {}).get("contrast", {}) or {}).get("on_light_base", "?"),
            (B.get("color", {}).get("accent-bright", {}).get("legal_foreground_when_used_as_fill", {}) or {}).get("color", "?"),
            (B.get("color", {}).get("accent-bright", {}).get("legal_foreground_when_used_as_fill", {}) or {}).get("ratio", "?"),
        ) + _semantics(B, D, A, OR, FA), 4))

    pages.append(pg("Colour", "Chart colors",
        '<p>Chart colors serve data visualization. Brand applications use sulfur gold and neutral surfaces. Each chart color is derived from the identity accent and measured against its surface so every entry clears 4.5:1.</p>'
        '<div class="charts">%s</div><div class="grid5">%s</div>'
        '<div class="callout acc"><div class="ey">Contrast checks</div>'
        '<p style="margin:0" class="dim">Lightness is calculated separately for dark and light surfaces. Chart hues remain at least 25 degrees from warning orange and failure red.</p></div><div class="card lite"><div class="ey" style="color:%s">The same palette on '
        'the light reading surface</div><div class="charts">%s</div><div class="grid5" '
        'style="margin-bottom:0">%s</div></div>' % (
            dark_bars, chips(D, ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]),
            AL, light_bars, chips(L, ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"], True))
        + _charttable(D, L, B), 5))

    pages.append(pg("Typography", "Display, interface, data",
        '<p>Glitchpad uses three type families. Space Grotesk handles display text, Geist handles interface and reading text, and Geist Mono handles paths, offsets, and data.</p>'
        '<div class="card" style="margin:4mm 0"><div style="font-family:\'Space Grotesk\';'
        'font-weight:700;font-size:22pt;letter-spacing:-.025em;line-height:1.08">%s</div>'
        '<div class="dim" style="margin-top:2mm">%s</div><div class="ey" style="margin-top:5mm">'
        'Key readability test</div><div class="m" style="font-size:8pt;line-height:1.8">'
        '0O 1lI 8B 5S 2Z &nbsp; {{ }} [ ] ( )</div></div>'
        '<div class="two"><div class="card"><div class="ey">Roles</div><table>'
        '<tr><th>Function</th><th>Typeface</th><th>Weights</th></tr>'
        '<tr><td>Display, headings</td><td>Space Grotesk</td><td>500, 700</td></tr>'
        '<tr><td>Body, interface</td><td>Geist</td><td>400, 500</td></tr>'
        '<tr><td>Telemetry, code</td><td>Geist Mono</td><td>400</td></tr></table></div>'
        '<div class="card"><div class="ey">Geometry</div><table>'
        '<tr><th>Axis</th><th>Value</th></tr>'
        '<tr><td>Radii</td><td>6 / 8 / 12 / 16 / pill</td></tr>'
        '<tr><td>Spacing</td><td>4 8 12 16 24 32 48 64 96 120</td></tr>'
        '<tr><td>Focus</td><td>2px ring at 2px offset</td></tr></table></div></div>'
        '<div class="callout"><div class="ey">Available weights</div><p style="margin:0" class="dim">'
        'Geist ships 400 and 500. Geist Mono ships 400 only. Space Grotesk ships 500 and 700. Any other '
        'weight makes the renderer synthesise a faux bold, which prints badly and forces outlined glyphs '
        'into exported PDFs. In mono, carry emphasis with colour.</p></div>' % (
            copy_for(B, "idea", B.get("brand_idea", title)),
            copy_for(B, "descriptor", B.get("descriptor", ""))) + _scales(), 6))

    pages.append(pg("Parent", "A ShruggieTech project",
        '<p>%s uses the ShruggieTech type families, dark product surfaces, and orange warning color <span class="m" style="color:%s">%s</span>. The G paper mark and sulfur accent belong to Glitchpad.%s</p>'
        '<div class="card" style="text-align:center;padding:7mm;margin:4mm 0"><div class="m" '
        'style="letter-spacing:.2em;text-transform:uppercase;color:%s">A ShruggieTech project</div></div>'
        '<p class="dim">Geist Mono, uppercase, positive tracking. Visually subordinate and outside the '
        'logo clear space. Never a combined parent-product lockup.</p><div class="rule"></div>'
        '<h3>Load the system</h3><div class="card"><div class="m" style="line-height:2">'
        'npx shadcn@latest registry add @%s=%s/r/{name}.json<br>'
        'npx shadcn@latest add @%s/theme @%s/fonts<br>npm i geist next-themes</div></div>'
        '%s' % (
            title, OR, OR,
            ("" if near is None else
             " The identity accent sits %.1f degrees from its nearest sibling." % near),
            MU, slug, B.get("registry_base", B.get("homepage", "https://glitchpad.com").rstrip("/") + "/brand"), slug, slug,
            _ships(kit) + '<div style="position:absolute;left:16mm;bottom:20mm">%s</div>'
            % img(mono_logo, "", "height:8mm")), 7))

    html = ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>%s brand guide"
            "</title><style>%s</style></head><body>%s</body></html>"
            % (slug, css, "\n".join(pages)))
    return html

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("brand"); ap.add_argument("kit"); ap.add_argument("--html-only", action="store_true")
    a = ap.parse_args()
    B = json.load(open(a.brand, encoding="utf-8"))
    os.makedirs(os.path.join(a.kit, "build"), exist_ok=True)
    hp = os.path.join(a.kit, "build", "brand-guide.print.html")
    with open(hp, "w", encoding="utf-8", newline="\n") as f: f.write(build(B, a.kit))
    print("wrote", hp)
    if a.html_only: return 0
    try:
        from playwright.sync_api import sync_playwright
        import pathlib
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page()
            pg.goto("file://" + str(pathlib.Path(hp).resolve())); pg.wait_for_timeout(1800)
            pg.emulate_media(media="print")
            pg.pdf(path=os.path.join(a.kit, "brand-guide.pdf"), format="A4", print_background=True,
                   margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
            b.close()
        print("wrote", os.path.join(a.kit, "brand-guide.pdf"))
        print("Now run qc_render.py --expect-ground dark AND OPEN THE CONTACT SHEET.")
    except Exception as e:
        print("PDF step skipped (%s). The print HTML is written; render it with headless Chromium." % e)
    return 0

if __name__ == "__main__":
    sys.exit(main())
