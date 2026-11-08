import { createHash } from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const reviewedWorkerSha256 =
  '8336aabf764cb08c818555a2fd2545e4fed10837146de927564875c93b3c4f83';
const upstreamImport = '`${WasmImage.#wasmUrl}${this._noWasmFilename}`';
const importBlock =
  'await import(\n    /*webpackIgnore: true*/\n    /*@vite-ignore*/\n    ' +
  upstreamImport +
  ')';

export function transformPdfWorker(code) {
  if (createHash('sha256').update(code).digest('hex') !== reviewedWorkerSha256)
    throw new Error('PDF worker transform refused unreviewed input');
  const edit=(before,after)=>{const at=code.indexOf(before);if(at<0||code.indexOf(before,at+1)>=0)throw new Error('PDF worker boundary anchor mismatch');code=code.slice(0,at)+after+code.slice(at+before.length);};
  edit('return pdfManager.ensureCatalog("documentOutline");','return pdfManager.ensureCatalog("documentOutline").then(value => __glitchpadBoundPdfReply("outline", value));');
  edit('return pdfManager.ensureCatalog("pageLabels");','return pdfManager.ensureCatalog("pageLabels").then(value => __glitchpadBoundPdfReply("labels", value));');
  edit('return pdfManager.ensureCatalog("getDestination", [id]);','return pdfManager.ensureCatalog("getDestination", [id]).then(value => __glitchpadBoundPdfReply("destination", value));');
  edit('return Promise.all([pdfManager.ensureDoc("documentInfo"), pdfManager.ensureCatalog("metadata"), pdfManager.ensureCatalog("hasStructTree")]);','return Promise.all([pdfManager.ensureDoc("documentInfo"), pdfManager.ensureCatalog("metadata"), pdfManager.ensureCatalog("hasStructTree")]).then(value => __glitchpadBoundPdfReply("metadata", value));');
  edit('return await page.getAnnotationsData(handler, task, intent);','return __glitchpadBoundPdfReply("annotations", await page.getAnnotationsData(handler, task, intent));');
  edit('        page.extractTextContent({\n          handler,\n          task,\n          sink,','        page.extractTextContent({\n          handler,\n          task,\n          sink: __glitchpadBoundPdfTextSink(sink),');
  const offset = code.indexOf(importBlock);
  if (offset < 0 || code.indexOf(importBlock, offset + 1) >= 0)
    throw new Error('PDF static decoder transform occurrence mismatch');
  const replacement =
    'Promise.resolve({ default: __glitchpadPdfDecoder(this._noWasmFilename) })';
  const bounds=fileURLToPath(new URL('../../apps/glitchpad/src/domain/pdf-worker-bounds.ts',import.meta.url)).replaceAll('\\','/');
  return [
    'import {boundPdfReply as __glitchpadBoundPdfReply,boundPdfTextSink as __glitchpadBoundPdfTextSink} from '+JSON.stringify(bounds)+';',
    "import __glitchpadJbig2 from 'pdfjs-dist/wasm/jbig2_nowasm_fallback.js';",
    "import __glitchpadOpenJpeg from 'pdfjs-dist/wasm/openjpeg_nowasm_fallback.js';",
    "function __glitchpadPdfDecoder(name) { if (name === 'jbig2_nowasm_fallback.js') return __glitchpadJbig2; if (name === 'openjpeg_nowasm_fallback.js') return __glitchpadOpenJpeg; throw new Error('Unknown PDF decoder'); }",
    code.slice(0, offset) +
      replacement +
      code.slice(offset + importBlock.length),
  ].join('\n');
}

export function pdfWorkerCompatibility() {
  return {
    name: 'glitchpad-reviewed-pdf-worker',
    enforce: 'pre',
    transform(code, id) {
      if (
        !id
          .replaceAll('\\', '/')
          .endsWith('/pdfjs-dist/legacy/build/pdf.worker.mjs')
      )
        return null;
      return { code: transformPdfWorker(code), map: null };
    },
  };
}
