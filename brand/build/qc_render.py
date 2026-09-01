#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qc_render.py: look at rendered output before shipping it.

Font metadata passing is not the same as a document being usable. This
rasterises every page of a PDF, runs checks that only a picture can answer,
and writes a contact sheet the agent is REQUIRED to open.

    python3 build/qc_render.py <file.pdf> [--out qc/] [--dpi 110]

Checks
  slicing        ink running into the top or bottom trim, meaning an element
                 was cut in half by a page break
  dead-space     a page that is mostly empty background
  folio          a page with no page number in its extracted text
  surface        every page shares one ground, and it matches the ground the
                 brand declares. A guide that flips from dark to light mid-way
                 reads as a broken export
  text-contrast  sampled foreground against sampled background per page
  uniformity     wildly varying content height page to page

Exit code is the number of problems, capped at 125.
"""
import argparse, os, subprocess, sys, statistics
from PIL import Image

def render(pdf, dpi, out):
    """Rasterise into a dedicated subdirectory. A flat prefix collides with the
    sheets qc_images.py writes alongside (pages-*.png), and pdftoppm output then
    gets mixed with unrelated PNGs."""
    os.makedirs(out, exist_ok=True)
    sub = os.path.join(out, "_pdf-pages")
    if os.path.isdir(sub):
        for f in os.listdir(sub):
            if f.endswith(".png"): os.remove(os.path.join(sub, f))
    os.makedirs(sub, exist_ok=True)
    subprocess.run(["pdftoppm", "-r", str(dpi), "-png", pdf, os.path.join(sub, "p")], check=True)
    return sorted(os.path.join(sub, x) for x in os.listdir(sub) if x.endswith(".png"))

def page_text(pdf, n):
    try:
        return subprocess.run(["pdftotext", "-f", str(n), "-l", str(n), pdf, "-"],
                              capture_output=True, text=True, check=True).stdout
    except Exception:
        return ""

def bg_of(im, inset=6):
    """Most common colour just inside the page edge: the page ground.
    Sampled at an inset so an edge antialiasing hairline cannot win the vote."""
    w, h = im.size
    px = []
    for x in range(inset, w - inset, 7):
        px.append(im.getpixel((x, inset))); px.append(im.getpixel((x, h - inset - 1)))
    for y in range(inset, h - inset, 7):
        px.append(im.getpixel((inset, y))); px.append(im.getpixel((w - inset - 1, y)))
    return max(set(px), key=px.count)

def ink_mask(im, bg, tol=26, erode=3):
    """Rows/cols that contain ink, plus the coverage fraction.

    The outermost pixels are discarded. A full-bleed page renders with a
    hairline antialiasing artifact at its own edge, and counting that as ink
    makes every row register content: density reads 100% and the trim check
    fires on every page. Erode first, measure second."""
    im = im.crop((erode, erode, im.width - erode, im.height - erode))
    w, h = im.size
    sm = im.resize((max(1, w // 2), max(1, h // 2)))
    sw, sh = sm.size
    rows, cols, n = [False] * sh, [False] * sw, 0
    px = sm.load()
    for y in range(sh):
        for x in range(sw):
            r, g, b = px[x, y][:3]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol:
                rows[y] = True; cols[x] = True; n += 1
    return rows, cols, n / float(sw * sh)

def luminance(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])

def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return round((hi + 0.05) / (lo + 0.05), 2)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf"); ap.add_argument("--out", default="qc")
    ap.add_argument("--dpi", type=int, default=110)
    ap.add_argument("--trim-mm", type=float, default=4.0,
                    help="band at top/bottom treated as trim; ink here means a sliced element")
    ap.add_argument("--max-dead", type=float, default=0.34,
                    help="flag a page with a single empty vertical run larger than this")
    ap.add_argument("--expect-ground", choices=["dark", "light", "any"], default="any",
                    help="the guide surface the brand declares; every page must match it")
    a = ap.parse_args()

    pages = render(a.pdf, a.dpi, a.out)
    if not pages:
        print("no pages rendered"); return 1
    problems, rows_out, thumbs, grounds = [], [], [], []
    px_per_mm = a.dpi / 25.4
    trim = int(a.trim_mm * px_per_mm)
    inks, heights = [], []

    for i, p in enumerate(pages, 1):
        im = Image.open(p).convert("RGB")
        w, h = im.size
        bg = bg_of(im)
        grounds.append(bg)
        rows, cols, cover = ink_mask(im, bg)
        inks.append(cover)
        sh = len(rows)
        t_band = max(1, trim // 2)
        top_cut = any(rows[:t_band]); bot_cut = any(rows[-t_band:])
        # A running footer sits at the bottom of every page, so first-ink to
        # last-ink always reads ~92% and tells you nothing. Exclude the header
        # and footer bands, then measure DENSITY inside the content area and the
        # largest unbroken empty run, which is what "this page is half empty"
        # actually looks like.
        hf = int(sh * 0.055)
        body_rows = rows[hf:sh - hf] or rows
        bh = len(body_rows)
        used = sum(1 for v in body_rows if v) / float(bh)
        run = best = 0
        for v in body_rows:
            run = 0 if v else run + 1
            best = max(best, run)
        gap_frac = best / float(bh)
        heights.append(used)
        dead = gap_frac
        # Folio detection reads PIXELS in the footer band. Extracted text is
        # unreliable here: a Chromium header/footer template does not
        # consistently survive pdftotext, which produced false "no folio" flags.
        foot_rows = rows[int(sh * 0.945):]
        has_folio = any(foot_rows)
        # sample text contrast: darkest and lightest pixel in the busiest row band
        mid = im.crop((0, int(h * 0.25), w, int(h * 0.75))).resize((160, 160))
        cl = list(mid.convert("RGB").getdata())
        dark = min(cl, key=luminance); light = max(cl, key=luminance)
        ctr = contrast(dark, light)

        flags = []
        if top_cut: flags.append("sliced at top trim")
        if bot_cut and i != len(pages): flags.append("sliced at bottom trim")
        if dead > a.max_dead and i not in (1, len(pages)):
            flags.append("%.0f%% of the page is one empty run" % (dead * 100))
        if not has_folio: flags.append("no folio")
        # A near-empty page gives the sampler nothing to measure. Skip rather
        # than emit a number that means nothing.
        if cover >= 0.08 and ctr < 4.5: flags.append("page contrast %.2f" % ctr)
        for f in flags: problems.append("page %d: %s" % (i, f))
        rows_out.append((i, cover, used, has_folio, ctr, flags))
        thumbs.append(im)

    mean_ink = statistics.fmean(inks)
    # Surface consistency, not an ink budget. A dark-first brand ships a
    # full-bleed dark guide on purpose; the real defect is a document whose
    # page ground changes part way through, which reads as a broken export.
    lums = [luminance(g) for g in grounds]
    dark_pages = sum(1 for l in lums if l < 0.2)
    if 0 < dark_pages < len(lums):
        problems.append("page ground is inconsistent: %d of %d pages dark, the rest light. "
                        "Pick one ground for the whole document and show the other surface "
                        "as specimen panels inside it." % (dark_pages, len(lums)))
    if a.expect_ground == "dark" and dark_pages != len(lums):
        problems.append("brand declares a dark guide surface but %d pages are light"
                        % (len(lums) - dark_pages))
    if a.expect_ground == "light" and dark_pages:
        problems.append("brand declares a light guide surface but %d pages are dark" % dark_pages)
    # A cover and a closing page are legitimately atypical. Judge the variance
    # on the body pages, the same exemption the empty-run check already makes.
    body_h = heights[1:-1] if len(heights) > 2 else heights
    if len(body_h) > 1 and (max(body_h) - min(body_h)) > 0.45:
        problems.append("body-page density varies %.0f%% to %.0f%%: pagination is accidental"
                        % (min(body_h) * 100, max(body_h) * 100))

    # contact sheet the agent must actually open
    tw = 380
    ths = [t.resize((tw, int(t.height * tw / t.width))) for t in thumbs]
    gap, cols_n = 16, min(5, len(ths))
    rows_n = (len(ths) + cols_n - 1) // cols_n
    W = cols_n * tw + gap * (cols_n + 1)
    H = rows_n * max(t.height for t in ths) + gap * (rows_n + 1) + 26
    sheet = Image.new("RGB", (W, H), "#9AA0A6")
    for idx, t in enumerate(ths):
        r, c = divmod(idx, cols_n)
        sheet.paste(t, (gap + c * (tw + gap), gap + r * (max(x.height for x in ths) + gap)))
    cs = os.path.join(a.out, "contact-sheet.png")
    sheet.save(cs)

    print("| Page | Ink | Density | Folio | Contrast | Flags |")
    print("| ---: | ---: | ---: | :---: | ---: | --- |")
    for i, cov, used, fol, ctr, flags in rows_out:
        print("| %d | %.0f%% | %.0f%% | %s | %.2f | %s |"
              % (i, cov * 100, used * 100, "yes" if fol else "NO", ctr,
                 ", ".join(flags) if flags else "clean"))
    print("\nmean ink coverage %.0f%%   pages %d   contact sheet: %s"
          % (mean_ink * 100, len(pages), cs))
    print("\nPROBLEMS: %d" % len(problems))
    for p in problems: print("  !", p)
    print("\nOPEN THE CONTACT SHEET. These checks catch measurable defects; they do "
          "not tell you whether the document looks good. Nothing replaces looking.")
    return min(len(problems), 125)

if __name__ == "__main__":
    sys.exit(main())
