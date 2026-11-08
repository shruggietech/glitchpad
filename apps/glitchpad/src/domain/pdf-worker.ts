// Compatibility APIs must initialize in this realm before the pinned engine.
import 'core-js/stable';
import { normalizePdfPostMessage } from './pdf-compatibility';
import { lockPdfWorkerDynamicCode, lockPdfWorkerExternalResources } from './pdf-worker-policy';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';

normalizePdfPostMessage(self);
// Verify the normal worker realm, outside any debugger evaluation override.
let platformCodeEvaluationAllowed = false;
try {
  platformCodeEvaluationAllowed = new Function('return true')() === true;
} catch {
  /* Observed platform CSP behavior. */
}
lockPdfWorkerDynamicCode(globalThis);
lockPdfWorkerExternalResources(globalThis);
let codeEvaluationAllowed = false;
try {
  codeEvaluationAllowed = new Function('return true')() === true;
} catch {
  /* The worker CSP must refuse dynamic code. */
}
self.postMessage({
  type: 'glitchpad-pdf-worker-ready',
  version: '6.5.438',
  code_evaluation_allowed: codeEvaluationAllowed,
  platform_code_evaluation_allowed: platformCodeEvaluationAllowed,
  native_bridge: '__TAURI_INTERNALS__' in self || '__TAURI__' in self,
});
