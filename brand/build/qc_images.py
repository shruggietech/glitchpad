#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qc_images.py: contact sheets for everything that is not a PDF.

The PDF gate exists because a document can pass every metadata check and still
be unusable. The same is true of a logo that reduces to an unreadable smudge and
a guidelines page that breaks at 390 px. This renders both and writes sheets the
agent opens.

  qc/logo-sheet.png        every lockup and the mark at 128 / 64 / 32 / 16,
                           on the product surface and on the light surface
  qc/pages-<name>.png      each HTML page in the kit at desktop and mobile

    python3 build/qc_images.py <kit-dir> [--dpi-scale 1]
"""
import argparse, glob, os, shutil, subprocess, sys, tempfile
from PIL import Image, ImageDraw

NODE = os.environ.get("GP_NODE") or shutil.which("node")
RESVG = os.environ.get("GP_RESVG_RENDERER") or os.path.join(os.path.dirname(__file__), "rsvg-convert.js")

def rsvg(src, w):
    out = os.path.join(tempfile.gettempdir(), "_qc_%d.png" % abs(hash(src + str(w))))
    native = shutil.which("rsvg-convert")
    if native:
        command = [native, "-w", str(w), src, "-o", out]
    elif NODE and os.path.exists(RESVG):
        command = [NODE, RESVG, "-w", str(w), src, "-o", out]
    else:
        raise RuntimeError("SVG rasterizer unavailable. Install rsvg-convert or set GP_NODE and GP_RESVG_RENDERER.")
    subprocess.run(command, check=True)
    return Image.open(out).convert("RGBA")

def logo_sheet(kit, out, dark, light):
    svgs = sorted(glob.glob(os.path.join(kit, "logos", "svg", "*.svg")))
    if not svgs: return None
    horiz = [s for s in svgs if "horizontal" in s and s.endswith(("color.svg", "light.svg"))]
    mark = [s for s in svgs if "mark-color" in s and "reduced" not in s]
    red = [s for s in svgs if "mark-reduced-color" in s]
    word = [s for s in svgs if "wordmark-color" in s]
    W, H = 1500, 720
    sh = Image.new("RGB", (W, H), dark); d = ImageDraw.Draw(sh)
    d.rectangle([0, H // 2, W, H], fill=light)
    def P(im, x, y): sh.paste(im, (int(x), int(y)), im)
    if horiz: P(rsvg(horiz[0], 540), 50, 60)
    if word:  P(rsvg(word[0], 440), 50, 215)
    for i, s in enumerate([128, 64, 32, 16]):
        if mark: P(rsvg(mark[0], s), 720 + i * 130, 50)
    d.text((720, 215), "full mark  128 / 64 / 32 / 16, actual size", fill="#7A8494")
    # The reduced master exists only below the threshold. Showing it at 128
    # misrepresents what it is for.
    d.text((720, 245), "reduced master, at the sizes it is actually used", fill="#7A8494")
    for i, s in enumerate([32, 16]):
        if red: P(rsvg(red[0], s), 720 + i * 130, 270)
    lt = [s for s in svgs if "horizontal-light" in s] or horiz
    if lt: P(rsvg(lt[0], 540), 50, H // 2 + 60)
    wb = [s for s in svgs if "wordmark-black" in s] or word
    if wb: P(rsvg(wb[0], 440), 50, H // 2 + 215)
    lm = [x for x in svgs if "mark-light" in x] or mark
    lr = [x for x in svgs if "mark-reduced-light" in x] or red
    for i, s in enumerate([128, 64, 32, 16]):
        if lm: P(rsvg(lm[0], s), 720 + i * 130, H // 2 + 50)
    d.text((720, H // 2 + 215), "full mark", fill="#6B6B6B")
    d.text((720, H // 2 + 245), "reduced master", fill="#6B6B6B")
    for i, s in enumerate([32, 16]):
        if lr: P(rsvg(lr[0], s), 720 + i * 130, H // 2 + 270)
    d.text((50, 20), "PRODUCT SURFACE", fill="#7A8494")
    d.text((50, H // 2 + 20), "LIGHT READING SURFACE", fill="#6B6B6B")
    sh.save(out); return out

def page_shots(kit, outdir):
    from playwright.sync_api import sync_playwright
    import pathlib
    pages = [p for p in glob.glob(os.path.join(kit, "**", "*.html"), recursive=True)
             if "node_modules" not in p and "/build/" not in p.replace(os.sep, "/")]
    made = []
    if not pages: return made
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for p in pages:
            name = os.path.splitext(os.path.basename(p))[0]
            parent = os.path.basename(os.path.dirname(p))
            u = "file://" + str(pathlib.Path(p).resolve())
            dk = b.new_page(viewport={"width": 1280, "height": 900}); dk.goto(u); dk.wait_for_timeout(900)
            desktop_path = os.path.join(tempfile.gettempdir(), "_glitchpad_qc_desktop.png")
            mobile_path = os.path.join(tempfile.gettempdir(), "_glitchpad_qc_mobile.png")
            dk.screenshot(path=desktop_path, full_page=True)
            mb = b.new_page(viewport={"width": 390, "height": 844}); mb.goto(u); mb.wait_for_timeout(700)
            mb.screenshot(path=mobile_path, full_page=False)
            D = Image.open(desktop_path).convert("RGB"); M = Image.open(mobile_path).convert("RGB")
            D = D.crop((0, 0, D.width, min(D.height, 2400)))
            sc = 700.0 / D.width; D = D.resize((700, int(D.height * sc)))
            h = max(D.height, M.height) + 40
            sheet = Image.new("RGB", (700 + M.width + 60, h), "#9AA0A6")
            sheet.paste(D, (20, 30)); sheet.paste(M, (700 + 40, 30))
            dr = ImageDraw.Draw(sheet)
            dr.text((20, 8), "%s/%s  -  desktop 1280 (top 2400px)   |   mobile 390" % (parent, name), fill="#111")
            o = os.path.join(outdir, "pages-%s-%s.png" % (parent, name))
            sheet.save(o); made.append(o)
            dk.close(); mb.close()
        b.close()
    return made

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kit"); ap.add_argument("--dark", default=None); ap.add_argument("--light", default="#F8F8F6")
    a = ap.parse_args()
    import json
    bj = os.path.join(a.kit, "brand.json")
    dark = a.dark or (json.load(open(bj, encoding="utf-8")).get("surfaces", {}).get("base", "#000000")
                      if os.path.exists(bj) else "#000000")
    out = os.path.join(a.kit, "qc"); os.makedirs(out, exist_ok=True)
    made = []
    try:
        ls = logo_sheet(a.kit, os.path.join(out, "logo-sheet.png"), dark, a.light)
        if ls: made.append(ls)
    except Exception as e:
        print("logo sheet skipped: %s" % e)
    try:
        made += page_shots(a.kit, out)
    except Exception as e:
        print("page shots skipped: %s" % e)
    for m in made: print("wrote", m)
    print("\nOPEN THESE. A logo that reduces to a smudge and a page that breaks at "
          "390px both pass every automated check in this kit.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
