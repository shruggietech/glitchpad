#!/usr/bin/env python3
"""Deterministic, original S050 PDF codec and subset-font assets (test data only)."""
import hashlib
import io
import json
from pathlib import Path
import struct
import PIL
from PIL import Image, features
import fontTools
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'fixtures/pdf/assets'
OUT.mkdir(parents=True, exist_ok=True)
assert PIL.__version__ == '12.3.0', PIL.__version__
assert fontTools.__version__ == '4.65.0', fontTools.__version__
assert features.check_codec('jpg_2000'), 'Pinned qualification image needs JPEG2000'
source = ROOT / 'fixtures/pdf/source/NotoSansHebrew-variable.ttf'
assert hashlib.sha256(source.read_bytes()).hexdigest() == '7ef36a2c3593758cdb622e1bdef4f84523e92fbc3ccc667438dd80ff54c2de88'
font = TTFont(source, recalcTimestamp=False)
font = instantiateVariableFont(font, {'wght': 400, 'wdth': 100}, inplace=True)
options = subset.Options()
options.recalc_timestamp = False
options.canonical_order = True
subsetter = subset.Subsetter(options=options)
subsetter.populate(text='שלום')
subsetter.subset(font)
# This derivative is exclusively a PDF test fixture, never a product UI font.
for record in font['name'].names:
    if record.nameID in (1, 2, 3, 4, 6):
        value = 'Regular' if record.nameID == 2 else 'GlitchpadPdfHebrewFixture'
        record.string = value.encode(record.getEncoding())
font.recalcTimestamp = False
font.save(OUT / 'GlitchpadPdfHebrewFixture.ttf', reorderTables=True)
units = font['head'].unitsPerEm
cmap = font.getBestCmap()
characters = {str(cp): {'gid': font.getGlyphID(cmap[cp]), 'width': round(font['hmtx'][cmap[cp]][0] * 1000 / units)} for cp in sorted(set(map(ord, 'שלום')))}
(OUT / 'hebrew-metrics.json').write_text(json.dumps({'characters': characters, 'units_per_em': units}, indent=2) + '\n', encoding='utf-8')

rgb = Image.new('RGB', (16, 16))
for y in range(16):
    for x in range(16):
        rgb.putpixel((x, y), ((230, 20, 40) if x < 8 and y < 8 else (20, 210, 40) if y < 8 else (20, 40, 230) if x < 8 else (230, 210, 20)))
rgb.save(OUT / 'original-jpx.j2k', format='JPEG2000', no_jp2=True, irreversible=False, num_resolutions=1)
mono = Image.new('1', (16, 16), 1)
for y in range(16):
    for x in range(16):
        if (x < 6 and y < 10) or (x >= 10 and y >= 8):
            mono.putpixel((x, y), 0)
tiff = io.BytesIO()
mono.save(tiff, format='TIFF', compression='group4', rows_per_strip=16)
raw = tiff.getvalue()
with Image.open(io.BytesIO(raw)) as encoded:
    tags = encoded.tag_v2
    assert tags[259] == 4 and tags.get(266, 1) == 1
    offsets, lengths = tags[273], tags[279]
    assert len(offsets) == len(lengths) == 1 and tags[278] >= 16
    mmr = raw[offsets[0]:offsets[0]+lengths[0]]
def segment(number, kind, body):
    return struct.pack('>IBBBI', number, kind, 0, 1, len(body)) + body
page_info = struct.pack('>IIIIBH', 16, 16, 0, 0, 0, 0)
generic_region = struct.pack('>IIIIBB', 16, 16, 0, 0, 0, 1) + mmr
(OUT / 'original-jbig2.jb2').write_bytes(segment(1, 48, page_info) + segment(2, 38, generic_region) + segment(3, 49, b''))
manifest = {'generator': 'scripts/generate-pdf-conformance-assets.py', 'pillow': PIL.__version__, 'fonttools': fontTools.__version__, 'openjpeg': features.version_codec('jpg_2000'), 'font_source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'patterns': {'jpx': '16x16 original RGB quadrants: red green / blue yellow', 'jbig2': '16x16 original black top-left 6x10 and bottom-right 6x8 on white'}, 'assets': []}
for path in sorted(OUT.iterdir()):
    if path.name == 'asset-manifest.json':
        continue
    data = path.read_bytes()
    manifest['assets'].append({'name': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(OUT / 'asset-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest))
