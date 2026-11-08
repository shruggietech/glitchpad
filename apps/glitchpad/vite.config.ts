import react from '@vitejs/plugin-react';
import { pdfWorkerCompatibility } from '../../scripts/lib/pdf-worker-compatibility.mjs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [pdfWorkerCompatibility(), react()],
  build: {
    // The API 24 validation image ships Chromium 69. Keep application and
    // dependency syntax executable on the oldest supported Android WebView.
    target: 'chrome69',
  },
  resolve: {
    // The browser export creates a DOM element at module load. Use the
    // table-based decoder in both development and bundled worker realms.
    alias: [
      {
        find: /^decode-named-character-reference$/,
        replacement: fileURLToPath(
          import.meta.resolve('decode-named-character-reference'),
        ),
      },
    ],
  },
  worker: {
    // Vite supplies module workers in dev and classic bundled workers in production.
    format: 'iife',
    plugins: () => [pdfWorkerCompatibility()],
  },
  clearScreen: false,
  server: {
    strictPort: true,
    host: '127.0.0.1',
    port: 1420,
  },
});
