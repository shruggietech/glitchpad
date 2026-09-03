import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  worker: {
    plugins: () => [{
      name: 'worker-safe-character-reference-decoder',
      enforce: 'pre',
      resolveId(source) {
        // The browser export creates a DOM element at module load, which is not
        // available inside the Markdown worker. The default export is table-based.
        return source === 'decode-named-character-reference'
          ? fileURLToPath(import.meta.resolve('decode-named-character-reference'))
          : null;
      },
    }],
  },
  clearScreen: false,
  server: {
    strictPort: true,
    host: '127.0.0.1',
    port: 1420,
  },
});
