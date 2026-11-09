import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createPdfFixture,
  createPageCountFixture,
  serializePdfObjects,
} from './generate-pdf-fixtures.mjs';

const directory = new URL('../fixtures/pdf/', import.meta.url);
const asset = async (name) => readFile(new URL('assets/' + name, directory));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const old = JSON.parse(
  await readFile(new URL('pdf-fixtures.json', directory), 'utf8'),
);
for (const row of old.fixtures) {
  const bytes = await readFile(new URL(row.name, directory));
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256)
    throw Error('Existing S049 fixture changed: ' + row.name);
}
function writer() {
  const objects = [];
  return {
    objects,
    add(value) {
      objects.push(value);
      return objects.length;
    },
    stream(data, dictionary = '') {
      const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data, 'ascii');
      return Buffer.concat([
        Buffer.from(
          '<< /Length ' + bytes.length + ' ' + dictionary + ' >>\nstream\n',
        ),
        bytes,
        Buffer.from('\nendstream'),
      ]);
    },
  };
}
const ref = (id) => id + ' 0 R';
function imagePdf(jpx, jbig2) {
  const w = writer();
  const catalog = w.add(''),
    tree = w.add('');
  const info = w.add(
    '<< /Title (Original JPX and JBIG2 asymmetric patterns) >>',
  );
  const pages = [];
  for (const [bytes, filter, space, bits] of [
    [jpx, 'JPXDecode', 'DeviceRGB', 8],
    [jbig2, 'JBIG2Decode', 'DeviceGray', 1],
  ]) {
    const image = w.add(
      w.stream(
        bytes,
        '/Type /XObject /Subtype /Image /Width 16 /Height 16 /ColorSpace /' +
          space +
          ' /BitsPerComponent ' +
          bits +
          ' /Filter /' +
          filter,
      ),
    );
    const content = w.add(w.stream('q 160 0 0 160 20 20 cm /Pattern Do Q'));
    pages.push(
      w.add(
        '<< /Type /Page /Parent ' +
          ref(tree) +
          ' /MediaBox [0 0 200 200] /Resources << /XObject << /Pattern ' +
          ref(image) +
          ' >> >> /Contents ' +
          ref(content) +
          ' >>',
      ),
    );
  }
  w.objects[catalog - 1] = '<< /Type /Catalog /Pages ' + ref(tree) + ' >>';
  w.objects[tree - 1] =
    '<< /Type /Pages /Count 2 /Kids [' + pages.map(ref).join(' ') + '] >>';
  return serializePdfObjects(w.objects, catalog, info);
}
async function hebrewPdf() {
  const w = writer();
  const catalog = w.add(''),
    tree = w.add('');
  const info = w.add('<< /Title (Original Hebrew Unicode CID fixture) >>');
  const file = w.add(w.stream(await asset('GlitchpadPdfHebrewFixture.ttf')));
  const descriptor = w.add(
    '<< /Type /FontDescriptor /FontName /GlitchpadPdfHebrewFixture /Flags 4 /FontBBox [-1000 -500 2000 1500] /ItalicAngle 0 /Ascent 1000 /Descent -300 /CapHeight 700 /StemV 80 /FontFile2 ' +
      ref(file) +
      ' >>',
  );
  const metrics = JSON.parse(
    (await asset('hebrew-metrics.json')).toString('utf8'),
  ).characters;
  const mapping = Buffer.alloc(
    (Math.max(...Object.keys(metrics).map(Number)) + 1) * 2,
  );
  for (const [cid, m] of Object.entries(metrics))
    mapping.writeUInt16BE(m.gid, Number(cid) * 2);
  const map = w.add(w.stream(mapping));
  const widths = Object.entries(metrics)
    .map(([cid, m]) => cid + ' [' + m.width + ']')
    .join(' ');
  const descendant = w.add(
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /GlitchpadPdfHebrewFixture /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ' +
      ref(descriptor) +
      ' /CIDToGIDMap ' +
      ref(map) +
      ' /DW 1000 /W [' +
      widths +
      '] >>',
  );
  const cmap = w.add(
    w.stream(
      '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /GlitchpadHebrew def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange 4 beginbfchar ' +
        Object.keys(metrics)
          .map((cid) => {
            const h = Number(cid).toString(16).padStart(4, '0');
            return '<' + h + '> <' + h + '>';
          })
          .join(' ') +
        ' endbfchar endcmap CMapName currentdict /CMap defineresource pop end end',
    ),
  );
  const font = w.add(
    '<< /Type /Font /Subtype /Type0 /BaseFont /GlitchpadPdfHebrewFixture /Encoding /Identity-H /DescendantFonts [' +
      ref(descendant) +
      '] /ToUnicode ' +
      ref(cmap) +
      ' >>',
  );
  // PDF glyph order is visual; Unicode extraction must reconstruct logical שלום with dir=rtl.
  const content = w.add(
    w.stream('BT /F1 36 Tf 40 100 Td <05DD05D505DC05E9> Tj ET'),
  );
  const page = w.add(
    '<< /Type /Page /Parent ' +
      ref(tree) +
      ' /MediaBox [0 0 300 200] /Resources << /Font << /F1 ' +
      ref(font) +
      ' >> >> /Contents ' +
      ref(content) +
      ' >>',
  );
  w.objects[catalog - 1] = '<< /Type /Catalog /Pages ' + ref(tree) + ' >>';
  w.objects[tree - 1] = '<< /Type /Pages /Count 1 /Kids [' + ref(page) + '] >>';
  return serializePdfObjects(w.objects, catalog, info);
}
function geometryPdf(huge = false) {
  const w = writer();
  const catalog = w.add(''),
    tree = w.add('');
  const info = w.add('<< /Title (Original page box and rotation fixture) >>');
  const font = w.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const content = w.add(
    w.stream('BT /F1 18 Tf 30 60 Td (Mixed geometry source preserved) Tj ET'),
  );
  const pages = [];
  for (const [box, crop, rotation] of huge
    ? [['[0 0 10000000 10000000]', '[0 0 10000000 10000000]', 0]]
    : [
        ['[0 0 400 300]', '[20 30 380 280]', 0],
        ['[-20 -10 300 500]', '[0 0 280 480]', 90],
        ['[0 0 600 200]', '[0 0 600 200]', 270],
      ])
    pages.push(
      w.add(
        '<< /Type /Page /Parent ' +
          ref(tree) +
          ' /MediaBox ' +
          box +
          ' /CropBox ' +
          crop +
          ' /Rotate ' +
          rotation +
          ' /Resources << /Font << /F1 ' +
          ref(font) +
          ' >> >> /Contents ' +
          ref(content) +
          ' >>',
      ),
    );
  w.objects[catalog - 1] = '<< /Type /Catalog /Pages ' + ref(tree) + ' >>';
  w.objects[tree - 1] =
    '<< /Type /Pages /Count ' +
    pages.length +
    ' /Kids [' +
    pages.map(ref).join(' ') +
    '] >>';
  return serializePdfObjects(w.objects, catalog, info, null, '1.4');
}
const jpx = await asset('original-jpx.j2k'),
  jbig2 = await asset('original-jbig2.jb2');
const files = {
  's050-version-1.4.pdf': createPdfFixture({
    pages: 1,
    padding: 0,
    hostile: false,
  }),
  's050-codecs.pdf': imagePdf(jpx, jbig2),
  's050-hebrew.pdf': await hebrewPdf(),
  's050-geometry.pdf': geometryPdf(),
  's050-huge-page.pdf': geometryPdf(true),
  's050-valid-10000.pdf': createPageCountFixture(10000),
  's050-truncated-codecs.pdf': imagePdf(
    jpx.subarray(0, 12),
    jbig2.subarray(0, 12),
  ),
  's050-cyclic-pages.pdf': serializePdfObjects(
    [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Count 1 /Kids [2 0 R] >>',
      '<< /Title (Original cyclic page-tree negative) >>',
    ],
    1,
    3,
  ),
};
files['s050-version-1.4.pdf'].write('%PDF-1.4', 0, 'ascii'); // Same header length preserves every xref offset.
const rows = [];
for (const [name, bytes] of Object.entries(files)) {
  await writeFile(new URL(name, directory), bytes);
  rows.push({
    name,
    bytes: bytes.length,
    sha256: sha(bytes),
    author: 'Glitchpad contributors',
    license: name.includes('hebrew') ? 'Apache-2.0 AND OFL-1.1' : 'Apache-2.0',
  });
}
await writeFile(
  new URL('s050-fixtures.json', directory),
  JSON.stringify(
    {
      schema_version: 1,
      generator: 'scripts/generate-pdf-conformance.mjs',
      preserved_s049: old.fixtures.map(({ name, sha256 }) => ({
        name,
        sha256,
      })),
      fixtures: rows,
    },
    null,
    2,
  ) + '\n',
  'utf8',
);
console.log(JSON.stringify(rows));
