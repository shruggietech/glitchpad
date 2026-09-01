#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qc_paginate.py: exact page-break checking, measured in the DOM.

Raster heuristics cannot reliably see an element sliced by a page break: on a
full-bleed page the ground is ink, and on a margined page the slice sits well
inside the trim. This measures every atomic element's box against the real page
grid in the browser, which is exact.

    python3 build/qc_paginate.py <print.html> [--page-height-mm 297] [--selector ...]

Exit code is the number of split elements.
"""
import argparse, pathlib, sys

DEFAULT_SEL = (".card,.sw,table,tr,.charts,.callout,.spec,.kv,figure,"
               "h1,h2,h3,li,.block,.badge")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html"); ap.add_argument("--page-height-mm", type=float, default=297.0)
    ap.add_argument("--selector", default=DEFAULT_SEL)
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright
    u = "file://" + str(pathlib.Path(a.html).resolve())
    js = """(sel) => {
      const MM = 96/25.4, PH = %f * MM;
      const out = [];
      document.querySelectorAll(sel).forEach(el => {
        const r = el.getBoundingClientRect();
        const top = r.top + window.scrollY, bot = r.bottom + window.scrollY;
        if (bot - top < 2) return;
        const pt = Math.floor(top / PH), pb = Math.floor((bot - 0.5) / PH);
        if (pt !== pb) out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0,40),
          text: (el.textContent || '').trim().slice(0,50),
          top: Math.round(top), bottom: Math.round(bot),
          startsPage: pt+1, endsPage: pb+1
        });
      });
      return out;
    }""" % a.page_height_mm
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={"width": 794, "height": 1123})
        pg.goto(u); pg.wait_for_timeout(1400)
        pg.emulate_media(media="print")
        split = pg.evaluate(js, a.selector)
        b.close()
    if not split:
        print("pagination: 0 atomic elements split across a page break")
        return 0
    print("| Element | Class | Starts | Ends | Text |")
    print("| --- | --- | ---: | ---: | --- |")
    for s in split[:40]:
        print("| %s | %s | %d | %d | %s |" % (s["tag"], s["cls"], s["startsPage"],
                                              s["endsPage"], s["text"].replace("|", "/")))
    print("\nSPLIT ELEMENTS: %d" % len(split))
    print("Add break-inside:avoid to these, or restructure the block.")
    return min(len(split), 125)

if __name__ == "__main__":
    sys.exit(main())
