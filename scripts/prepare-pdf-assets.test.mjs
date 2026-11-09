import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pdfPackageRoot, preparePdfAssets } from './prepare-pdf-assets.mjs';
import { transformPdfWorker } from './lib/pdf-worker-compatibility.mjs';

test('reviewed worker pins static decoder and bounded inspection boundaries', async () => {
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
  for (const name of [
    'outline',
    'labels',
    'destination',
    'metadata',
    'annotations',
  ])
    assert.ok(transformed.includes('__glitchpadBoundPdfReply("' + name + '"'));
  assert.ok(transformed.includes('sink: __glitchpadBoundPdfTextSink(sink)'));
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

// Execute the transformed upstream method so async module semantics are covered.
test('static decoder rewrite awaits the factory before instantiating both codecs', async () => {
  const code = await readFile(
    join(pdfPackageRoot(), 'legacy/build/pdf.worker.mjs'),
    'utf8',
  );
  const transformed = transformPdfWorker(code);
  const method = transformed.match(
    /async #getJsInstance\(imports\) \{([\s\S]*?)\n  \}/,
  );
  assert.ok(method, 'reviewed upstream decoder method must be present');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const name of [
    'jbig2_nowasm_fallback.js',
    'openjpeg_nowasm_fallback.js',
  ]) {
    const imports = { codec: name };
    const exports = { decoded: name };
    let called = 0;
    const invoke = new AsyncFunction(
      '__glitchpadPdfDecoder',
      'imports',
      method[1],
    );
    const result = await invoke.call(
      { _noWasmFilename: name },
      (observed) => {
        assert.equal(observed, name);
        return (actualImports) => {
          called++;
          assert.equal(actualImports, imports);
          return exports;
        };
      },
      imports,
    );
    assert.equal(called, 1);
    assert.equal(result.exports, exports);
  }
});

test('failed image data emits an explicit bounded failure while valid pixels retain their transport', async () => {
  const code = await readFile(
    join(pdfPackageRoot(), 'legacy/build/pdf.worker.mjs'),
    'utf8',
  );
  const transformed = transformPdfWorker(code);
  const method = transformed.match(
    /_sendImgData\(objId, imgData, cacheGlobally = false\) \{([\s\S]*?)\n  \}/,
  );
  assert.ok(method);
  let failures = 0;
  const sent = [];
  const invoke = new Function(
    '__glitchpadPdfImageFailure',
    'objId',
    'imgData',
    'cacheGlobally',
    method[1],
  );
  const receiver = {
    parsingType3Font: false,
    pageProxyId: 7,
    handler: {
      send: (...args) => {
        sent.push(args);
        return 'sent';
      },
    },
  };
  const pixels = { data: new Uint8Array(4) };
  assert.equal(
    invoke.call(receiver, () => failures++, 'valid', pixels, false),
    'sent',
  );
  assert.equal(failures, 0);
  assert.equal(sent[0][1][3], pixels);
  assert.equal(
    invoke.call(receiver, () => failures++, 'failed', null, false),
    'sent',
  );
  assert.equal(failures, 1);
  assert.equal(sent[1][1][3], null);
  invoke.call(receiver, () => failures++, 'cached-failed', null, true);
  assert.equal(failures, 2);
});
