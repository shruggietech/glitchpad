import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // The repository is commonly tested from a bind-mounted Windows workspace.
    // Keep fork startup below the I/O saturation point so files cannot time out
    // before their tests begin.
    maxWorkers: 2,
  },
});
