# -*- coding: utf-8 -*-
"""Shared helpers for the two document generators. Both read the SAME tokens the
product ships, so a kit's documents and its interface cannot drift apart."""
import base64, json, os, re

def tokens(kit):
    css = open(os.path.join(kit, "nextjs", "globals.css"), encoding="utf-8").read()
    def blk(n):
        m = re.search(r"^%s \{(.*?)^\}" % n, css, re.S | re.M)
        if not m: return {}
        return dict((k, h) for k, _, h in re.findall(
            r"--([a-z0-9-]+):\s*(oklch\([^)]*\));\s*/\* (#[0-9A-Fa-f]{6}) \*/", m.group(1)))
    return blk(r"\.dark"), blk(":root")

def b64(p):
    return base64.b64encode(open(p, "rb").read()).decode()

def faces(kit):
    out, d = "", os.path.join(kit, "fonts", "woff2")
    for fam, fn, w in [("Space Grotesk", "SpaceGrotesk-Medium.woff2", 500),
                       ("Space Grotesk", "SpaceGrotesk-Bold.woff2", 700),
                       ("Geist", "Geist-Regular.woff2", 400),
                       ("Geist", "Geist-Medium.woff2", 500),
                       ("Geist Mono", "GeistMono-Regular.woff2", 400)]:
        p = os.path.join(d, fn)
        if os.path.exists(p):
            out += ("@font-face{font-family:'%s';font-weight:%d;font-display:block;"
                    "src:url(data:font/woff2;base64,%s) format('woff2')}\n" % (fam, w, b64(p)))
    return out

def asset(kit, *cands):
    for c in cands:
        p = os.path.join(kit, "logos", "png", c)
        if os.path.exists(p): return b64(p)
    return None

def copy_for(B, key, default):
    """Prose comes from brand.json `guide` when the operator wrote it, and from a
    generated default otherwise. A kit is complete from two inputs; overriding
    any single section stays a one-line edit."""
    return ((B.get("guide") or {}).get(key)) or default
