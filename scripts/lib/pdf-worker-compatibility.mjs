import { createHash } from 'node:crypto';

export const reviewedWorkerSha256 = '8336aabf764cb08c818555a2fd2545e4fed10837146de927564875c93b3c4f83';
const upstreamImport = "`${WasmImage.#wasmUrl}${this._noWasmFilename}`";
const importBlock = 'await import(\n    /*webpackIgnore: true*/\n    /*@vite-ignore*/\n    ' + upstreamImport + ')';

export function transformPdfWorker(code) {
  if (createHash('sha256').update(code).digest('hex') !== reviewedWorkerSha256) throw new Error('PDF worker transform refused unreviewed input');
  const offset = code.indexOf(importBlock);
  if (offset < 0 || code.indexOf(importBlock, offset + 1) >= 0) throw new Error('PDF static decoder transform occurrence mismatch');
  const replacement = 'Promise.resolve({ default: __glitchpadPdfDecoder(this._noWasmFilename) })';
  return [
    "import __glitchpadJbig2 from 'pdfjs-dist/wasm/jbig2_nowasm_fallback.js';",
    "import __glitchpadOpenJpeg from 'pdfjs-dist/wasm/openjpeg_nowasm_fallback.js';",
    "function __glitchpadPdfDecoder(name) { if (name === 'jbig2_nowasm_fallback.js') return __glitchpadJbig2; if (name === 'openjpeg_nowasm_fallback.js') return __glitchpadOpenJpeg; throw new Error('Unknown PDF decoder'); }",
    code.slice(0, offset) + replacement + code.slice(offset + importBlock.length),
  ].join('\n');
}

export function pdfWorkerCompatibility() {
  return {
    name: 'glitchpad-reviewed-pdf-worker',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/pdfjs-dist/legacy/build/pdf.worker.mjs')) return null;
      return { code: transformPdfWorker(code), map: null };
    },
  };
}
