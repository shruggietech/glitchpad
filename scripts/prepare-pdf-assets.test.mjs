import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pdfPackageRoot, preparePdfAssets } from './prepare-pdf-assets.mjs';
import { transformPdfWorker } from './lib/pdf-worker-compatibility.mjs';

test('reviewed worker replaces only the dynamic decoder boundary', async () => {
  const code = await readFile(
    join(pdfPackageRoot(), 'legacy/build/pdf.worker.mjs'),
    'utf8',
  );
  const transformed = transformPdfWorker(code);
  assert.ok(
    transformed.includes(
      "import __glitchpadJbig2 from 'pdfjs-dist/wasm/jbig2_nowasm_fallback.js'",
    ),
  );
  assert.ok(
    transformed.includes(
      "import __glitchpadOpenJpeg from 'pdfjs-dist/wasm/openjpeg_nowasm_fallback.js'",
    ),
  );
  assert.ok(!/\bimport\s*\(/.test(transformed));
  assert.throws(() => transformPdfWorker(code + '\n'), /unreviewed input/);
});

test('offline resources include CMaps and BSD symbol fonts only', async () => {
  const result = await preparePdfAssets();
  assert.equal(result.version, '6.5.438');
  assert.ok(result.resources > 100);
  const data = await readFile(
    new URL(
      '../apps/glitchpad/src/pdf-generated/resources.ts',
      import.meta.url,
    ),
    'utf8',
  );
  assert.ok(data.includes('FoxitSymbol.pfb'));
  assert.ok(data.includes('FoxitDingbats.pfb'));
  assert.ok(!/Liberation|\.ttf|quickjs/i.test(data));
});
