#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_guidelines.py: the guidelines page, rendered from the system it documents.

Reads the SAME tokens the product ships (nextjs/globals.css), so the page and
the interface cannot drift apart. Dark by default with a light reading mode,
matching the product rather than the print guide.

Writes guidelines/index.html and, if a ui_kits directory is wanted, a demo
surface alongside it.

    python3 build/gen_guidelines.py <brand.json> <kit-dir>
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _guidekit import tokens, faces, asset, copy_for

def sw(t, keys):
    return "".join('<div class="sw"><div class="chip" style="background:%s"></div>'
                   '<div class="mono">%s</div><div class="mono dim">%s</div></div>'
                   % (t[k], k, t[k]) for k in keys if k in t)

def build(B, kit):
    D, L = tokens(kit)
    slug, title = B["slug"], B["title"]
    A, AL = D["primary"], L["primary"]
    logo = asset(kit, "%s-horizontal-color-1024.png" % slug)
    mark = asset(kit, "%s-mark-color-1024.png" % slug)
    stacked = asset(kit, "%s-stacked-color-1024.png" % slug)
    lockups = (B.get("logo") or {}).get("lockups") or {}
    horizontal_lockup = lockups.get("horizontal") or {}
    stacked_lockup = lockups.get("stacked") or {}
    M = B.get("measured", {}); sep = M.get("hue_separation_deg", {})
    near = min(sep.values()) if sep else None
    cb = (B.get("color", {}).get("accent-bright", {}) or {})
    ca = (B.get("color", {}).get("accent-accessible", {}) or {})
    on_light = (cb.get("contrast") or {}).get("on_light_base", "?")
    acc_light = (ca.get("contrast") or {}).get("on_light_base", "?")
    fg = (cb.get("legal_foreground_when_used_as_fill") or {})
    dv = "".join("  --%s: %s;\n" % (k, v) for k, v in D.items())
    lv = "".join("  --%s: %s;\n" % (k, v) for k, v in L.items())
    def im(b, cls): return "" if not b else '<img class="%s" src="data:image/png;base64,%s">' % (cls, b)

    return """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%(title)s brand guidelines</title><style>
%(faces)s
:root {
%(lv)s  --radius-sm:6px; --radius-md:8px; --radius-xl:12px;
}
.dark {
%(dv)s}
* { box-sizing:border-box; }
body { margin:0; background:var(--background); color:var(--foreground);
  font-family:Geist,system-ui,sans-serif; font-size:16px; line-height:1.7;
  -webkit-font-smoothing:antialiased; }
.wrap { max-width:1200px; margin:0 auto; padding:0 24px; }
@media(min-width:768px){ .wrap{ padding:0 48px; } }
@media(min-width:1024px){ .wrap{ padding:0 80px; } }
header { padding:96px 0 48px; }
h1 { font-family:'Space Grotesk'; font-weight:700; font-size:clamp(2.25rem,6vw,3.5rem);
  line-height:1.1; letter-spacing:-.025em; margin:.2em 0; }
h2 { font-family:'Space Grotesk'; font-weight:500; font-size:1.75rem; line-height:1.2;
  letter-spacing:-.015em; margin:0 0 8px; }
h3 { font-family:'Space Grotesk'; font-weight:500; font-size:1.1rem; margin:32px 0 8px; }
.eyebrow { font-family:'Geist Mono'; font-size:.75rem; letter-spacing:.12em;
  text-transform:uppercase; color:var(--primary); }
section { padding:56px 0; border-top:1px solid var(--border); }
.lead { color:var(--muted-foreground); max-width:720px; }
.grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); margin-top:24px; }
.sw .chip { height:64px; border-radius:var(--radius-md); border:1px solid var(--border); }
.mono { font-family:'Geist Mono'; font-size:.75rem; margin-top:6px; }
.dim { color:var(--muted-foreground); }
.card { background:var(--card); border:1px solid var(--border);
  border-radius:var(--radius-xl); padding:24px; }
.two { display:grid; gap:24px; grid-template-columns:1fr 1fr; }
@media(max-width:800px){ .two{ grid-template-columns:1fr; } }
.row { display:flex; gap:16px; flex-wrap:wrap; align-items:center; margin-top:24px; }
.btn { font-family:Geist; font-weight:500; font-size:.875rem; border-radius:var(--radius-md);
  padding:10px 18px; border:1px solid transparent; cursor:pointer; }
.btn-primary { background:var(--primary); color:var(--primary-foreground); }
.btn-secondary { background:transparent; color:var(--foreground); border-color:var(--border); }
.badge { font-family:'Geist Mono'; font-size:.7rem; letter-spacing:.08em; text-transform:uppercase;
  border-radius:999px; padding:4px 12px; border:1px solid currentColor; }
input { font-family:Geist; font-size:.875rem; background:var(--card); color:var(--foreground);
  border:1px solid var(--input); border-radius:var(--radius-md); padding:10px 12px; width:100%%; }
:focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
table { width:100%%; border-collapse:collapse; font-family:'Geist Mono'; font-size:.8rem; margin-top:16px; }
th { text-align:left; color:var(--muted-foreground); font-weight:400; letter-spacing:.08em;
  text-transform:uppercase; font-size:.7rem; padding:8px 12px; border-bottom:1px solid var(--border); }
td { padding:8px 12px; border-bottom:1px solid var(--border); }
.charts { display:flex; gap:8px; align-items:flex-end; height:120px; margin-top:24px; }
.charts div { flex:1; border-radius:var(--radius-sm) var(--radius-sm) 0 0; }
.endorse { font-family:'Geist Mono'; font-size:.7rem; letter-spacing:.1em; text-transform:uppercase;
  color:var(--muted-foreground); padding:48px 0 96px; }
img.logo { height:56px; } img.mark { height:40px; } img.stacked { height:160px; }
code { font-family:'Geist Mono'; font-variant-ligatures:none; }
@media(prefers-reduced-motion:reduce){ *{ animation-duration:.01ms!important; transition-duration:.01ms!important; } }
</style></head><body class="dark"><div class="wrap">
<header>%(logoimg)s
<div class="eyebrow" style="margin-top:32px">Brand guidelines</div>
<h1>%(idea)s</h1>
<p class="lead">%(descriptor)s</p>
</header>

<section><div class="eyebrow">Colour</div><h2>Identity accent</h2>
<p class="lead">%(sepline)s</p>
<div class="grid">%(acc)s</div>
<h3>Product surface</h3><div class="grid">%(surf)s</div>
<div class="card" style="margin-top:24px"><div class="eyebrow">Light surfaces</div>
<p style="margin:8px 0 0">The bright accent <code>%(A)s</code> measures <b>%(on_light)s:1</b> on the light
reading surface and is never text there. The light block substitutes <code>%(AL)s</code> at
%(acc_light)s:1. The legal foreground on an accent fill is <code>%(fgc)s</code> at %(fgr)s:1.</p></div>
</section>

<section><div class="eyebrow">Colour</div><h2>Chart colors</h2>
<p class="lead">Chart colors serve data visualization. Brand applications use sulfur gold and neutral surfaces. Each chart color is derived from the accent, clears 4.5:1 on its surface, and remains separate from warning and failure states.</p>
<div class="charts">%(bars)s</div>
</section>

<section><div class="eyebrow">Type and components</div><h2>Space Grotesk, Geist, Geist Mono</h2>
<div class="two" style="margin-top:24px">
<div class="card">
<div style="font-family:'Space Grotesk';font-weight:700;font-size:3rem;letter-spacing:-.025em;line-height:1.1">Display</div>
<div style="font-family:'Space Grotesk';font-weight:500;font-size:1.6rem;margin-top:12px">Heading</div>
<p style="margin-top:12px">Body in Geist at 400. Geist ships 400 and 500 only; asking for 700 makes the
renderer synthesise a faux bold.</p>
<div class="mono" style="font-size:.8rem">0O 1lI 8B 5S 2Z</div></div>
<div class="card"><div class="eyebrow">Components</div>
<div class="row"><button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<span class="badge" style="color:var(--primary)">ok</span>
<span class="badge" style="color:var(--brand-emphasis)">warn</span>
<span class="badge" style="color:var(--destructive)">fail</span></div>
<div style="margin-top:16px"><input placeholder="input"></div>
<table><tr><th>token</th><th>value</th></tr>
<tr><td>radius</td><td>6 / 8 / 12 / 16</td></tr>
<tr><td>spacing</td><td>4 8 12 16 24 32 48 64</td></tr>
<tr><td>focus</td><td>2px ring, 2px offset</td></tr></table></div></div>
</section>

<section><div class="eyebrow">Logo</div><h2>Mark and lockup</h2>
<p class="lead">Canvas %(canvas_width)d × %(canvas_height)d units, clear space %(cs)d units (%(cspct).1f percent of artwork width).
Below %(red)d px the reduced master takes over.</p>
<div class="row">%(logoimg)s%(markimg)s%(stackedimg)s</div>
<h3>Fixed lockup proportions</h3>
<table><tr><th>lockup</th><th>mark height</th><th>gap</th><th>alignment</th></tr>
<tr><td>horizontal</td><td>%(hmark).0f units</td><td>%(hgap).0f units</td><td>optical center</td></tr>
<tr><td>stacked</td><td>%(smark).2fC</td><td>%(sgap).2fC</td><td>centered on wordmark ink width</td></tr></table>
<p class="lead">The horizontal row records its approved master composition. C is the outlined wordmark cap height used by the stacked lockup. X is the 70-unit G channel. Keep one X clear around every master. Never resize the mark and wordmark independently.</p>
</section>

<div class="endorse">A ShruggieTech project</div>
</div></body></html>""" % {
        "title": title, "faces": faces(kit), "lv": lv, "dv": dv,
        "logoimg": im(logo, "logo"), "markimg": im(mark, "mark"),
        "stackedimg": im(stacked, "stacked"),
        "idea": copy_for(B, "idea", B.get("brand_idea", title)),
        "descriptor": copy_for(B, "descriptor", B.get("descriptor", "")),
        "sepline": ("Hue %s in OKLCH." % M.get("identity_hue", "?")) + (
            "" if near is None else " %.1f degrees clear of the nearest sibling identity accent." % near),
        "acc": sw(D, ["primary", "brand-accent-deep", "brand-emphasis", "destructive"]),
        "surf": sw(D, ["background", "card", "secondary", "border", "muted-foreground"]),
        "A": A, "AL": AL, "on_light": on_light, "acc_light": acc_light,
        "fgc": fg.get("color", "?"), "fgr": fg.get("ratio", "?"),
        "bars": "".join('<div style="background:%s;height:%d%%"></div>'
                        % (D["chart-%d" % i], 40 + i * 12) for i in range(1, 6)),
        "canvas_width": (B.get("logo") or {}).get("canvas_width", (B.get("logo") or {}).get("grid", 512)),
        "canvas_height": (B.get("logo") or {}).get("canvas_height", (B.get("logo") or {}).get("grid", 512)),
        "hmark": float(horizontal_lockup.get("mark_height_units", 160.0)),
        "hgap": float(horizontal_lockup.get("gap_units", 34.0)),
        "smark": float(stacked_lockup.get("mark_height_c", 1.8)),
        "sgap": float(stacked_lockup.get("gap_c", 0.45)),
        "cs": (B.get("logo") or {}).get("clear_space_units", 60),
        "cspct": 100.0 * (B.get("logo") or {}).get("clear_space_units", 60)
                 / (B.get("logo") or {}).get("artwork_width", (B.get("logo") or {}).get("grid", 512)),
        "red": (B.get("logo") or {}).get("reduced_below_px", 32),
    }

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("brand"); ap.add_argument("kit")
    a = ap.parse_args()
    B = json.load(open(a.brand, encoding="utf-8"))
    d = os.path.join(a.kit, "guidelines"); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, "index.html")
    with open(p, "w", encoding="utf-8", newline="\n") as f: f.write(build(B, a.kit))
    print("wrote", p)
    print("Now run qc_images.py and OPEN the page sheet. It renders at 390px too.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
