// Compatibility APIs must initialize in this realm before the pinned engine.
import 'core-js/stable';
import { normalizePdfPostMessage } from './pdf-compatibility';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';

normalizePdfPostMessage(self);
self.postMessage({ type: 'glitchpad-pdf-worker-ready', version: '6.5.438', native_bridge: '__TAURI_INTERNALS__' in self || '__TAURI__' in self });
