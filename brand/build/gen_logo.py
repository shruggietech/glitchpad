#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate lockups, raster exports and favicons around hand-authored paths.

This runtime copy extends the stock builder with optional rectangular mark
canvases, filled compound paths and explicit per-colourway role mappings. The
fallback remains fully compatible with the stock scalar ``logo.grid`` schema.
"""
import json
import os
import shutil
import struct
import subprocess
import sys

from svgelements import Path

NODE = os.environ.get("GP_NODE") or shutil.which("node")
RESVG = os.environ.get("GP_RESVG_RENDERER") or os.path.join(os.path.dirname(__file__), "rsvg-convert.js")


def need(tool):
    return shutil.which(tool) is not None


def raster(args):
    native = shutil.which("rsvg-convert")
    if native:
        command = [native] + args
    elif NODE and os.path.exists(RESVG):
        command = [NODE, RESVG] + args
    else:
        raise RuntimeError("SVG rasterizer unavailable. Install rsvg-convert or set GP_NODE and GP_RESVG_RENDERER.")
    subprocess.run(command, check=True)


def path_bbox(d):
    box = Path(d).bbox()
    if box is None:
        raise ValueError("empty logo path")
    return tuple(float(v) for v in box)


def paths_bbox(paths):
    boxes = [path_bbox(path["d"]) for path in paths]
    return (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )


def svg(width, height, body):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g" '
        'width="%g" height="%g" fill="none">\n%s\n</svg>\n'
        % (width, height, width, height, body)
    )


def wordmark_outline(text, ttf, size=200):
    from fontTools.misc.transform import Transform
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont

    font = TTFont(ttf)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    units = font["head"].unitsPerEm
    scale = size / units
    metrics = font["hmtx"]
    commands = []
    advance = 0.0
    for character in text:
        name = cmap.get(ord(character))
        if name is None:
            continue
        pen = SVGPathPen(glyphs)
        transform = Transform(scale, 0, 0, -scale, advance * scale, 0)
        glyphs[name].draw(TransformPen(pen, transform))
        if pen.getCommands():
            commands.append(pen.getCommands())
        advance += metrics[name][0]
    return " ".join(commands), advance * scale


def main():
    spec_path, kit = sys.argv[1], sys.argv[2]
    brand = json.load(open(spec_path, encoding="utf-8"))
    logo = brand.get("logo") or {}
    paths = logo.get("paths") or {}
    if not paths.get("full"):
        sys.exit("brand.json logo.paths.full is empty; hand-author the mark first")

    grid = logo.get("grid", 512)
    canvas_width = logo.get("canvas_width", grid)
    canvas_height = logo.get("canvas_height", grid)
    clear_space = logo.get("clear_space_units", int(min(canvas_width, canvas_height) * 0.11))
    artwork_width = logo.get("artwork_width", canvas_width)
    reduced_below = logo.get("reduced_below_px", 32)
    slug = brand["slug"]
    accent = brand["accent"]["bright"]
    accent_light = brand["accent"]["accessible"]
    dim = brand["accent"].get("dim") or brand["accent"]["deep"]
    base = brand.get("surfaces", {}).get("base", "#000000")

    role_maps = {
        "color": {"accent": accent, "dim": dim, "neutral": dim, "emphasis": "#FF5300"},
        "light": {"accent": accent_light, "dim": "#0A0A0A", "neutral": "#0A0A0A", "emphasis": "#C24000"},
        "white": {"accent": "#FFFFFF", "dim": "#FFFFFF", "neutral": "#FFFFFF", "emphasis": "#FFFFFF"},
        "black": {"accent": "#000000", "dim": "#000000", "neutral": "#000000", "emphasis": "#000000"},
    }
    for colourway, mapping in (logo.get("role_colors") or {}).items():
        role_maps.setdefault(colourway, {}).update(mapping)

    svg_dir = os.path.join(kit, "logos", "svg")
    png_dir = os.path.join(kit, "logos", "png")
    favicon_dir = os.path.join(kit, "favicons")
    for directory in (svg_dir, png_dir, favicon_dir):
        os.makedirs(directory, exist_ok=True)

    def write(path, value):
        with open(path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(value)

    def render_paths(path_list, roles, indent="  "):
        output = []
        for item in path_list:
            fill = roles.get(item.get("role", "accent"), accent)
            rule = item.get("fill_rule")
            extra = '' if not rule else ' fill-rule="%s" clip-rule="%s"' % (rule, rule)
            output.append('%s<path d="%s" fill="%s"%s/>' % (indent, item["d"], fill, extra))
        return "\n".join(output)

    written = []
    variants = (("mark", paths["full"]), ("mark-reduced", paths.get("reduced") or paths["full"]))
    for variant, path_list in variants:
        box = paths_bbox(path_list)
        assert box[0] >= -0.5 and box[1] >= -0.5
        assert box[2] <= canvas_width + 0.5 and box[3] <= canvas_height + 0.5
        for colourway, roles in role_maps.items():
            filename = "%s-%s-%s.svg" % (slug, variant, colourway)
            write(os.path.join(svg_dir, filename), svg(canvas_width, canvas_height, render_paths(path_list, roles)))
            written.append(filename)

    mark_box = paths_bbox(paths["full"])
    mark_width = mark_box[2] - mark_box[0]
    mark_height = mark_box[3] - mark_box[1]

    ttf = None
    for candidate in ("SpaceGrotesk-Bold.ttf", "SpaceGrotesk-Medium.ttf"):
        path = os.path.join(kit, "fonts", "ttf", candidate)
        if os.path.exists(path):
            ttf = path
            break

    wordmark_d = ""
    wordmark_advance = 0
    if ttf:
        wordmark_d, wordmark_advance = wordmark_outline(brand.get("wordmark_text", slug), ttf, 200)
        wordmark_box = tuple(float(v) for v in Path(wordmark_d).bbox())
        wordmark_cap_raw = max(1.0, -wordmark_box[1])
        wordmark_ink_width_raw = wordmark_box[2] - wordmark_box[0]
        wordmark_ink_height_raw = wordmark_box[3] - wordmark_box[1]
        lockup_specs = logo.get("lockups") or {}

        def word_ink(colourway, roles):
            if colourway in ("white", "black"):
                return roles["accent"]
            return "#F2F5FA" if colourway == "color" else "#0A0A0A"

        pad = 12
        wordmark_width, wordmark_height = wordmark_advance + pad * 2, 260
        for colourway, roles in role_maps.items():
            body = '  <g transform="translate(%g,%g)"><path d="%s" fill="%s"/></g>' % (
                pad, 200, wordmark_d, word_ink(colourway, roles)
            )
            filename = "%s-wordmark-%s.svg" % (slug, colourway)
            write(os.path.join(svg_dir, filename), svg(wordmark_width, wordmark_height, body))
            written.append(filename)

        for colourway, roles in role_maps.items():
            horizontal_spec = lockup_specs.get("horizontal") or {}
            word_scale = float(horizontal_spec.get("wordmark_scale", 0.62))
            mark_render_height = float(horizontal_spec.get("mark_height_units", 160.0))
            mark_scale = mark_render_height / mark_height
            mark_render_width = mark_width * mark_scale
            gap = float(horizontal_spec.get("gap_units", 34.0))
            horizontal_height = float(horizontal_spec.get("canvas_height_units", 200.0))
            lockup_pad = 24.0
            mark_y = (horizontal_height - mark_render_height) / 2.0
            word_baseline = float(horizontal_spec.get(
                "wordmark_baseline_units",
                horizontal_height / 2.0 + 200.0 * word_scale * 0.36,
            ))
            word_x = lockup_pad + mark_render_width + gap
            lockup_width = mark_render_width + gap + wordmark_advance * word_scale + lockup_pad * 2.0
            mark_group = render_paths(paths["full"], roles, "    ")
            body = (
                '  <g transform="translate(%g,%g) scale(%g) translate(%g,%g)">\n%s\n  </g>\n'
                '  <g transform="translate(%g,%g) scale(%g)"><path d="%s" fill="%s"/></g>'
                % (
                    lockup_pad,
                    mark_y,
                    mark_scale,
                    -mark_box[0],
                    -mark_box[1],
                    mark_group,
                    word_x,
                    word_baseline,
                    word_scale,
                    wordmark_d,
                    word_ink(colourway, roles),
                )
            )
            filename = "%s-horizontal-%s.svg" % (slug, colourway)
            write(os.path.join(svg_dir, filename), svg(lockup_width, horizontal_height, body))
            written.append(filename)

            stacked_spec = lockup_specs.get("stacked") or {}
            stacked_word_scale = float(stacked_spec.get("wordmark_scale", 0.62))
            stacked_cap_height = wordmark_cap_raw * stacked_word_scale
            stacked_mark_height = stacked_cap_height * float(stacked_spec.get("mark_height_c", 1.8))
            stacked_mark_scale = stacked_mark_height / mark_height
            stacked_mark_width = mark_width * stacked_mark_scale
            stacked_word_width = wordmark_ink_width_raw * stacked_word_scale
            stacked_word_height = wordmark_ink_height_raw * stacked_word_scale
            stacked_gap = stacked_cap_height * float(stacked_spec.get("gap_c", 0.45))
            stacked_pad = max(20.0, stacked_cap_height * 0.35)
            stacked_width = max(stacked_mark_width, stacked_word_width) + stacked_pad * 2
            stacked_word_top = stacked_pad + stacked_mark_height + stacked_gap
            stacked_word_baseline = stacked_word_top - wordmark_box[1] * stacked_word_scale
            stacked_height = stacked_word_top + stacked_word_height + stacked_pad
            mark_x = (stacked_width - stacked_mark_width) / 2
            word_x = (stacked_width - stacked_word_width) / 2
            stacked = (
                '  <g transform="translate(%g,%g) scale(%g) translate(%g,%g)">\n%s\n  </g>\n'
                '  <g transform="translate(%g,%g) scale(%g)"><path d="%s" fill="%s"/></g>'
                % (
                    mark_x,
                    stacked_pad,
                    stacked_mark_scale,
                    -mark_box[0],
                    -mark_box[1],
                    mark_group,
                    word_x - wordmark_box[0] * stacked_word_scale,
                    stacked_word_baseline,
                    stacked_word_scale,
                    wordmark_d,
                    word_ink(colourway, roles),
                )
            )
            filename = "%s-stacked-%s.svg" % (slug, colourway)
            write(os.path.join(svg_dir, filename), svg(stacked_width, stacked_height, stacked))
            written.append(filename)

    if wordmark_d:
        roles = role_maps["color"]
        preview_width, preview_height = 1280, 640
        preview_lockup_center_y = 245.0
        preview_word_scale = 1.0
        horizontal_spec = lockup_specs.get("horizontal") or {}
        horizontal_word_scale = float(horizontal_spec.get("wordmark_scale", 0.62))
        preview_mark_height = float(horizontal_spec.get("mark_height_units", 160.0)) / horizontal_word_scale
        mark_scale = preview_mark_height / mark_height
        preview_mark_width = mark_width * mark_scale
        preview_gap = float(horizontal_spec.get("gap_units", 34.0)) / horizontal_word_scale
        preview_word_width = wordmark_ink_width_raw * preview_word_scale
        preview_word_height = wordmark_ink_height_raw * preview_word_scale
        preview_lockup_width = preview_mark_width + preview_gap + preview_word_width
        preview_x = (preview_width - preview_lockup_width) / 2
        preview_mark_top = preview_lockup_center_y - preview_mark_height / 2.0
        horizontal_height = float(horizontal_spec.get("canvas_height_units", 200.0))
        horizontal_baseline = float(horizontal_spec.get(
            "wordmark_baseline_units",
            horizontal_height / 2.0 + 200.0 * horizontal_word_scale * 0.36,
        ))
        normalized_baseline_offset = (
            horizontal_baseline - horizontal_height / 2.0
        ) / horizontal_word_scale
        preview_baseline = preview_lockup_center_y + normalized_baseline_offset * preview_word_scale
        tagline_ttf = os.path.join(kit, "fonts", "ttf", "SpaceGrotesk-Medium.ttf")
        if not os.path.exists(tagline_ttf):
            tagline_ttf = ttf
        tagline_d, _ = wordmark_outline(brand.get("brand_idea", "View your files."), tagline_ttf, 56)
        tagline_box = tuple(float(v) for v in Path(tagline_d).bbox())
        tagline_top = preview_lockup_center_y + preview_mark_height / 2.0 + 38.0
        tagline_baseline = tagline_top - tagline_box[1]
        tagline_x = preview_x + preview_mark_width + preview_gap - tagline_box[0]
        mark_group = render_paths(paths["full"], roles, "      ")
        preview = (
            '  <rect width="1280" height="640" fill="%s"/>\n'
            '  <g transform="translate(%g,%g) scale(%g) translate(%g,%g)">\n%s\n  </g>\n'
            '  <g transform="translate(%g,%g) scale(%g)"><path d="%s" fill="#F2F5FA"/></g>\n'
            '  <g transform="translate(%g,%g)"><path d="%s" fill="%s"/></g>'
            % (base, preview_x, preview_mark_top, mark_scale, -mark_box[0], -mark_box[1], mark_group,
               preview_x + preview_mark_width + preview_gap - wordmark_box[0] * preview_word_scale,
               preview_baseline, preview_word_scale, wordmark_d,
               tagline_x, tagline_baseline, tagline_d, roles["neutral"])
        )
        filename = "%s-social-preview.svg" % slug
        write(os.path.join(svg_dir, filename), svg(preview_width, preview_height, preview))
        written.append(filename)

    for filename in written:
        width = 1280 if "social-preview" in filename else 1024
        source = os.path.join(svg_dir, filename)
        output = os.path.join(png_dir, filename[:-4] + "-%d.png" % width)
        standalone_mark = filename.startswith(slug + "-mark-")
        if standalone_mark:
            from PIL import Image
            raster(["-h", str(width), source, "-o", output])
            with Image.open(output) as rendered:
                mark_image = rendered.convert("RGBA")
                square_image = Image.new("RGBA", (width, width), (0, 0, 0, 0))
                square_image.alpha_composite(
                    mark_image,
                    ((width - mark_image.width) // 2, (width - mark_image.height) // 2),
                )
                square_image.save(output)
            with Image.open(output) as squared:
                assert squared.size == (width, width), "%s is not square" % output
        else:
            raster(["-w", str(width), source, "-o", output])

    square = max(canvas_width, canvas_height)
    x_offset = (square - canvas_width) / 2
    for name, path_list in (("favicon", paths["full"]), ("favicon-reduced", paths.get("reduced") or paths["full"])):
        body = (
            '  <rect width="%g" height="%g" fill="%s"/>\n'
            '  <g transform="translate(%g,0)">\n%s\n  </g>'
            % (square, square, base, x_offset, render_paths(path_list, role_maps["color"], "    "))
        )
        write(os.path.join(favicon_dir, name + ".svg"), svg(square, square, body))

    ico_sources = []
    for size in (16, 24, 32, 48, 64, 128, 180, 192, 256, 512):
        source_name = "favicon-reduced.svg" if size <= reduced_below else "favicon.svg"
        output = os.path.join(favicon_dir, "favicon-%dx%d.png" % (size, size))
        raster(["-w", str(size), "-h", str(size), os.path.join(favicon_dir, source_name), "-o", output])
        if size in (16, 24, 32, 48, 64, 128, 256):
            ico_sources.append(output)

    os.replace(os.path.join(favicon_dir, "favicon-180x180.png"), os.path.join(favicon_dir, "apple-touch-icon.png"))
    for size in (192, 512):
        shutil.copy(
            os.path.join(favicon_dir, "favicon-%dx%d.png" % (size, size)),
            os.path.join(favicon_dir, "android-chrome-%dx%d.png" % (size, size)),
        )

    converter = "magick" if need("magick") else None
    if converter:
        ico = os.path.join(favicon_dir, "favicon.ico")
        subprocess.run([converter] + ico_sources + [ico], check=True)
        count = struct.unpack("<H", open(ico, "rb").read()[4:6])[0]
        assert count == len(ico_sources), "ICO carries %d entries, expected %d" % (count, len(ico_sources))
        print("ICO: %d entries" % count)
    else:
        print("WARNING no ImageMagick: favicon.ico not built")

    write(
        os.path.join(favicon_dir, "site.webmanifest"),
        json.dumps(
            {
                "name": brand["title"],
                "short_name": brand["title"],
                "icons": [
                    {"src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
                    {"src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"},
                ],
                "theme_color": base,
                "background_color": base,
                "display": "standalone",
            },
            indent=2,
        )
        + "\n",
    )

    print("canvas %g x %g; artwork width %g" % (canvas_width, canvas_height, artwork_width))
    print("clear space %d units = %.1f%% of artwork width" % (clear_space, 100.0 * clear_space / artwork_width))
    print("mark bbox %s inside canvas" % (tuple(round(v, 1) for v in mark_box),))
    print("wrote %d SVGs, rasters, favicons and manifest" % len(written))
    return 0


if __name__ == "__main__":
    sys.exit(main())
