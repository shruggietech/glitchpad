import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/** Original document content; optional embedded Courier Prime retains its OFL-1.1 license. */
export function createPdfFixture({
  pages = 4,
  padding = 1024 * 1024,
  hostile = true,
  font = null,
  jpeg = null,
  unsupportedEncryption = false,
  securityCorpus = false,
} = {}) {
  const objects = [];
  const add = (value) => {
    objects.push(value);
    return objects.length;
  };
  const ref = (id) => String(id) + ' 0 R';
  const stream = (input, dictionary = '') => {
    const data = Buffer.isBuffer(input) ? input : Buffer.from(input, 'ascii');
    return Buffer.concat([
      Buffer.from(
        '<< /Length ' + data.length + ' ' + dictionary + ' >>\nstream\n',
        'ascii',
      ),
      data,
      Buffer.from('\nendstream', 'ascii'),
    ]);
  };
  const catalog = add('');
  const tree = add('');
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const bold = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  );
  const italic = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>',
  );
  const symbol = add('<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>');
  const info = add(
    '<< /Title (S049 local PDF) /Author (Glitchpad fixtures) /Subject (Worker compatibility) /Keywords (local search navigation) /Creator (Self-authored fixture generator) /Producer (Glitchpad S049) /CreationDate (D:20261108000000Z) /ModDate (D:20261108000000Z) >>',
  );
  const outline = add('');
  const entry = add('');
  const destinations = add('');
  const action = add(
    '<< /S /JavaScript /JS (globalThis.__s049PdfExecuted = true;) >>',
  );
  let embedded = null;
  if (font) {
    const file = add(stream(font));
    const descriptor = add(
      '<< /Type /FontDescriptor /FontName /CourierPrime-Regular /Flags 33 /FontBBox [-200 -300 1300 1000] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 ' +
        ref(file) +
        ' >>',
    );
    embedded = add(
      '<< /Type /Font /Subtype /TrueType /BaseFont /CourierPrime-Regular /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 126 /Widths [' +
        Array(95).fill(600).join(' ') +
        '] /FontDescriptor ' +
        ref(descriptor) +
        ' >>',
    );
  }
  const image = jpeg
    ? add(
        stream(
          jpeg,
          '/Type /XObject /Subtype /Image /Width 4 /Height 3 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',
        ),
      )
    : null;
  const securityAnnotations = [];
  let attachment = null;
  let widget = null;
  if (securityCorpus) {
    const attachmentBytes = add(
      stream(
        'Synthetic inert attachment. globalThis.__s049PdfExecuted=true;',
        '/Type /EmbeddedFile /Subtype /application#2Fjavascript',
      ),
    );
    attachment = add(
      '<< /Type /Filespec /F (s049-attachment.js) /EF << /F ' +
        ref(attachmentBytes) +
        ' >> >>',
    );
    const appearance = add(
      stream(
        'BT /F1 12 Tf 2 8 Td (Read-only synthetic form) Tj ET',
        '/Type /XObject /Subtype /Form /BBox [0 0 220 24] /Resources << /Font << /F1 ' +
          ref(regular) +
          ' >> >>',
      ),
    );
    widget = add(
      '<< /Type /Annot /Subtype /Widget /FT /Tx /T (s049-field) /V (Read-only synthetic form) /Ff 1 /Rect [48 360 268 384] /AP << /N ' +
        ref(appearance) +
        ' >> /AA << /K ' +
        ref(action) +
        ' >> >>',
    );
    securityAnnotations.push(widget);
    for (const expression of [
      '/A << /S /Launch /F (s049-attachment.js) >>',
      '/A << /S /SubmitForm /F (https://example.invalid/submit) /Flags 4 >>',
      '/A << /S /GoToR /F (https://example.invalid/remote.pdf) /D [0 /Fit] >>',
      '/A << /S /URI /URI (file:///synthetic-s049) >>',
      '/A << /S /URI /URI (data:text/html,synthetic-s049) >>',
      '/Dest [99 /Fit]',
    ])
      securityAnnotations.push(
        add(
          '<< /Type /Annot /Subtype /Link /Rect [48 300 268 324] /Contents (' +
            (expression.startsWith('/Dest')
              ? 'Invalid destination'
              : 'Security action') +
            ') ' +
            expression +
            ' >>',
        ),
      );
    securityAnnotations.push(
      add(
        '<< /Type /Annot /Subtype /FileAttachment /Rect [280 300 304 324] /FS ' +
          ref(attachment) +
          ' >>',
      ),
    );
  }
  const pagesIds = [];
  for (let index = 0; index < pages; index++) {
    const content = add(
      stream(
        'BT /F1 18 Tf 48 720 Td (Glitchpad PDF compatibility page ' +
          (index + 1) +
          ') Tj 0 -32 Td /F2 14 Tf ' +
          (securityCorpus ? '(Search cats and dogs. More cats and cats.)' : '(Search cats and dogs. Local document only.)') +
          ' Tj 0 -28 Td /F3 14 Tf (Readable italic text.) Tj 0 -28 Td /F4 14 Tf (abc) Tj' +
          (embedded
            ? ' 0 -28 Td /F5 14 Tf (Embedded Courier Prime text.) Tj'
            : '') +
          ' ET' +
          (image ? ' q 140 0 0 105 360 460 cm /Image1 Do Q' : ''),
      ),
    );
    const link = add(
      '<< /Type /Annot /Subtype /Link /Rect [48 540 280 570] /Border [0 0 0] /Dest (chapter-two) >>',
    );
    const external = add(
      '<< /Type /Annot /Subtype /Link /Rect [48 500 280 530] /Border [0 0 0] /A << /S /URI /URI (https://example.invalid/s049) >> >>',
    );
    const rejected = add(
      '<< /Type /Annot /Subtype /Link /Rect [48 460 280 490] /A << /S /URI /URI (javascript:globalThis.__s049PdfExecuted=true) >> >>',
    );
    pagesIds.push(
      add(
        '<< /Type /Page /Parent ' +
          ref(tree) +
          ' /MediaBox [0 0 612 792] /Resources << /Font << /F1 ' +
          ref(regular) +
          ' /F2 ' +
          ref(bold) +
          ' /F3 ' +
          ref(italic) +
          ' /F4 ' +
          ref(symbol) +
          (embedded ? ' /F5 ' + ref(embedded) : '') +
          ' >>' +
          (image ? ' /XObject << /Image1 ' + ref(image) + ' >>' : '') +
          ' >> /Contents ' +
          ref(content) +
          ' /Annots [' +
          ref(link) +
          ' ' +
          ref(external) +
          ' ' +
          ref(rejected) +
          (securityCorpus ? ' ' + securityAnnotations.map(ref).join(' ') : '') +
          (securityCorpus ? '] /AA << /O ' + ref(action) + ' >> >>' : '] >>'),
      ),
    );
  }
  objects[catalog - 1] =
    '<< /Type /Catalog /Pages ' +
    ref(tree) +
    ' /PageLabels << /Nums [0 << /S /r >> 1 << /S /D /St 1 >>] >> /Outlines ' +
    ref(outline) +
    ' /Names << /Dests ' +
    ref(destinations) +
    (attachment
      ? ' /EmbeddedFiles << /Names [(s049-attachment.js) ' +
        ref(attachment) +
        '] >>'
      : '') +
    ' >>' +
    (widget
      ? ' /AcroForm << /Fields [' + ref(widget) + '] /NeedAppearances false >>'
      : '') +
    (hostile ? ' /OpenAction ' + ref(action) : '') +
    ' >>';
  objects[tree - 1] =
    '<< /Type /Pages /Count ' +
    pages +
    ' /Kids [' +
    pagesIds.map(ref).join(' ') +
    '] >>';
  objects[outline - 1] =
    '<< /Type /Outlines /First ' +
    ref(entry) +
    ' /Last ' +
    ref(entry) +
    ' /Count 1 >>';
  objects[entry - 1] =
    '<< /Title (Second chapter) /Parent ' +
    ref(outline) +
    ' /Dest (chapter-two) >>';
  objects[destinations - 1] =
    '<< /Names [(chapter-two) [' +
    ref(pagesIds[Math.min(1, pagesIds.length - 1)]) +
    ' /XYZ null null null]] >>';
  const encryption = unsupportedEncryption
    ? add(
        '<< /Filter /UnsupportedS049SecurityHandler /V 9 /R 99 /Length 256 >>',
      )
    : null;
  if (padding) add(stream(' '.repeat(padding)));
  return serializePdfObjects(objects, catalog, info, encryption);
}

function serializePdfObjects(objects, catalog, info, encryption = null) {
  const ref = (id) => String(id) + ' 0 R';
  const parts = [
    Buffer.from('%PDF-1.7\n% Original Glitchpad fixture\n', 'ascii'),
  ];
  const offsets = [0];
  let length = parts[0].length;
  for (let index = 0; index < objects.length; index++) {
    offsets.push(length);
    const bytes = Buffer.concat([
      Buffer.from(String(index + 1) + ' 0 obj\n', 'ascii'),
      Buffer.isBuffer(objects[index])
        ? objects[index]
        : Buffer.from(objects[index], 'ascii'),
      Buffer.from('\nendobj\n', 'ascii'),
    ]);
    parts.push(bytes);
    length += bytes.length;
  }
  const xref = length;
  parts.push(
    Buffer.from(
      'xref\n0 ' +
        (objects.length + 1) +
        '\n0000000000 65535 f \n' +
        offsets
          .slice(1)
          .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
          .join('') +
        'trailer\n<< /Size ' +
        (objects.length + 1) +
        ' /Root ' +
        ref(catalog) +
        ' /Info ' +
        ref(info) +
        (encryption
          ? ' /Encrypt ' +
            ref(encryption) +
            ' /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>]'
          : '') +
        ' >>\nstartxref\n' +
        xref +
        '\n%%EOF\n',
      'ascii',
    ),
  );
  return Buffer.concat(parts);
}
/** Valid large page tree with shared resources/content rather than duplicated document payload. */
export function createPageCountFixture(count) {
  const kids = Array.from(
    { length: count },
    (_, index) => String(index + 6) + ' 0 R',
  ).join(' ');
  const content = 'BT /F1 18 Tf 48 720 Td (Page-count contract fixture) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count ' +
      count +
      ' /Kids [' +
      kids +
      '] /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Title (Page-count contract fixture) >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
    ...Array(count).fill('<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>'),
  ];
  return serializePdfObjects(objects, 1, 4);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const directory = new URL('../fixtures/pdf/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const font = await readFile(
    new URL('../brand/fonts/ttf/CourierPrime-Regular.ttf', import.meta.url),
  );
  const jpeg = await readFile(
    new URL('../fixtures/images/original.jpg', import.meta.url),
  );
  await copyFile(
    new URL('../brand/fonts/licenses/OFL-Courier-Prime.txt', import.meta.url),
    new URL('OFL-Courier-Prime.txt', directory),
  );
  const files = {
    's049-compatibility.pdf': createPdfFixture({ font, jpeg }),
    's049-small.pdf': createPdfFixture({ padding: 0, font, jpeg }),
    's049-large.pdf': createPdfFixture({
      pages: 1000,
      padding: 0,
      hostile: false,
    }),
    's049-page-limit.pdf': createPageCountFixture(10001),
    's049-unsupported-encryption.pdf': createPdfFixture({
      pages: 1,
      padding: 0,
      unsupportedEncryption: true,
    }),
    's049-malformed.pdf': Buffer.from('%PDF-1.7\ninvalid\n', 'ascii'),
    's049-security.pdf': createPdfFixture({
      pages: 1,
      padding: 0,
      securityCorpus: true,
    }),
  };
  await copyFile(
    new URL('pdf-reading-journey.js', import.meta.url),
    new URL('pdf-reading-journey.js', directory),
  );
  const manifest = [];
  for (const [name, bytes] of Object.entries(files)) {
    await writeFile(new URL(name, directory), bytes);
    manifest.push({
      name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      author: 'Glitchpad contributors',
      license:
        name === 's049-compatibility.pdf' || name === 's049-small.pdf'
          ? 'Apache-2.0 AND OFL-1.1'
          : 'Apache-2.0',
    });
  }
  if (process.argv.includes('--extended')) {
    const encrypted = new URL('s049-encrypted.pdf', directory);
    await promisify(execFile)(
      'qpdf',
      [
        '--static-id',
        '--static-aes-iv',
        '--encrypt',
        'fixture-open',
        'fixture-owner',
        '128',
        '--use-aes=y',
        '--',
        fileURLToPath(new URL('s049-small.pdf', directory)),
        fileURLToPath(encrypted),
      ],
      { windowsHide: true, timeout: 30000 },
    );
    const bytes = await readFile(encrypted);
    manifest.push({
      name: 's049-encrypted.pdf',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      author: 'Glitchpad contributors',
      license: 'Apache-2.0 AND OFL-1.1',
      password: 'fixture-open',
      generator: 'qpdf static test encryption of original s049-small.pdf',
    });
  }
  await writeFile(
    new URL('pdf-fixtures.json', directory),
    JSON.stringify(
      { generator: 'scripts/generate-pdf-fixtures.mjs', fixtures: manifest },
      null,
      2,
    ) + '\n',
    'utf8',
  );
}
