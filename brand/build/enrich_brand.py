#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
enrich_brand.py: write the measured numbers into brand.json.

A kit that states no contrast claims cannot have its contrast claims checked:
`verify.py` reports contrast-rederived as SKIP, which looks like a pass and is
not one. This computes every derived value from the declared hexes and writes
them back, so verify has something real to re-derive on the next build.

Everything written here is measured. Nothing is transcribed.

    python3 build/enrich_brand.py <brand.json> [--canon PATH]
"""
import argparse, json, os, sys
from coloraide import Color

def OK(h):
    c = Color(h).convert("oklch")
    l, ch, hu = c["lightness"], c["chroma"], c["hue"]
    return "oklch(%.4f 0 0)" % l if ch < 0.0005 else "oklch(%.4f %.4f %.2f)" % (l, ch, hu)
def HUE(h):
    c = Color(h).convert("oklch")
    return None if c["chroma"] < 0.02 else round(c["hue"], 1)
def R(a, b): return round(Color(a).contrast(b, method="wcag21"), 2)

def tok(hexv, role, dark_base, light_base, note=None):
    b, wv = R("#000000", hexv), R("#FFFFFF", hexv)
    fg = "#000000" if b >= wv else "#FFFFFF"
    d = {"hex": hexv, "oklch": OK(hexv), "hue": HUE(hexv), "role": role,
         "contrast": {"on_dark_base": R(hexv, dark_base), "on_light_base": R(hexv, light_base)},
         "legal_foreground_when_used_as_fill": {"color": fg, "ratio": max(b, wv)}}
    if note: d["note"] = note
    return d

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("brand"); ap.add_argument("--canon", default=None)
    a = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    canon = json.load(open(a.canon or os.path.join(here, "..", "references", "01-canon.json"),
                           encoding="utf-8"))
    B = json.load(open(a.brand, encoding="utf-8"))
    dark = B.get("surfaces", {}).get("base", "#000000")
    light = "#F8F8F6"
    acc = B["accent"]

    color = {}
    color["accent-bright"] = tok(acc["bright"], "identity accent, links, focus", dark, light)
    color["accent-deep"] = tok(acc["deep"], "hover and active", dark, light)
    color["accent-accessible"] = tok(acc["accessible"], "the accent on light surfaces", dark, light,
        "The bright accent measures %s:1 on the light base and is never text there."
        % R(acc["bright"], light))
    for k, t in canon["color"]["immutable"].items():
        color[k] = tok(t["hex"], t["role"], dark, light,
                       "inherited verbatim from canon %s" % canon["version"])
    for k, hx in (B.get("surfaces") or {}).items():
        color["surface-" + k] = tok(hx, "dark surface: %s" % k, dark, light)

    # sibling separation, measured now rather than asserted later
    sibs = canon["color"]["constrained_rules"]["identity_accent"]["checks"][0]["current_siblings"]
    sep = {}
    for name, s in sibs.items():
        if name == B.get("slug"): continue
        x, y = HUE(acc["bright"]), HUE(s["hex"])
        if x is not None and y is not None:
            dd = abs(x - y); sep[name] = round(min(dd, 360 - dd), 1)
    x, y = HUE(acc["bright"]), HUE(canon["color"]["immutable"]["orange"]["hex"])
    sep["inherited-orange"] = round(min(abs(x - y), 360 - abs(x - y)), 1)

    B["canon"] = canon["version"]
    B["measured"] = {
        "generated_by": "shruggie-brandbuilder/enrich_brand.py",
        "rule": "Every number here is measured from the hex at generation time. "
                "Regenerate rather than edit; verify.py re-derives all of it.",
        "dark_base": dark, "light_base": light,
        "identity_hue": HUE(acc["bright"]),
        "hue_separation_deg": sep,
    }
    B["color"] = color
    with open(a.brand, "w", encoding="utf-8", newline="\n") as f:
        json.dump(B, f, indent=2, ensure_ascii=False); f.write("\n")
    print("enriched %s: %d colour tokens with measured contrast, %d separations"
          % (a.brand, len(color), len(sep)))
    return 0

if __name__ == "__main__":
    sys.exit(main())
