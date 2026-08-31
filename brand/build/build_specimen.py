from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "specimens"


def outlined_text(text, font_path, size, x, baseline, fill):
    font = TTFont(font_path)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    cursor = x
    paths = []
    for char in text:
        name = cmap.get(ord(char), ".notdef")
        pen = SVGPathPen(glyphs)
        transformed = TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline))
        glyphs[name].draw(transformed)
        commands = pen.getCommands()
        if commands:
            paths.append(commands)
        cursor += font["hmtx"].metrics[name][0] * scale
    font.close()
    return f'<path fill="{fill}" d="{" ".join(paths)}"/>'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    display = ROOT / "fonts" / "ttf" / "SpaceGrotesk-Bold.ttf"
    body = ROOT / "fonts" / "ttf" / "Geist-Regular.ttf"
    mono = ROOT / "fonts" / "ttf" / "GeistMono-Regular.ttf"
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">',
        '<rect width="1600" height="1000" fill="#0B0C0D"/>',
        '<path fill="#FFD900" d="M80 70H116L145 99V215C145 222.732 138.732 229 131 229H80C72.268 229 66 222.732 66 215V84C66 76.268 72.268 70 80 70ZM123 99V79L143 99ZM79 87V212H132V140H113V154H125V198H86V101H112V87Z"/>',
        outlined_text("GLITCHPAD TYPE SYSTEM", mono, 20, 185, 110, "#A8A39D"),
        outlined_text("Glitchpad", display, 154, 76, 365, "#FFFFFF"),
        outlined_text("Text, source code, images, PDFs, and office documents.", body, 42, 82, 475, "#A8A39D"),
        '<path fill="#262626" d="M80 540H1520V542H80Z"/>',
        outlined_text("DISPLAY / SPACE GROTESK BOLD", mono, 18, 82, 600, "#FFD900"),
        outlined_text("View your files.", display, 60, 82, 682, "#FFFFFF"),
        outlined_text("BODY / GEIST REGULAR", mono, 18, 82, 750, "#FFD900"),
        outlined_text("Open, read, inspect, and edit supported local file formats.", body, 30, 82, 810, "#FFFFFF"),
        outlined_text("MONO / GEIST MONO REGULAR", mono, 18, 82, 875, "#FFD900"),
        outlined_text("0O 1lI 8B 5S 2Z   00000010   FF D8 FF E0   archive-header.bin", mono, 28, 82, 930, "#A8A39D"),
        '</svg>',
    ]
    (OUT / "glitchpad-type-specimen.svg").write_text("\n".join(parts) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
