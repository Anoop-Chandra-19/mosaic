import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src/renderer/src'),
      '@shared': resolve(import.meta.dirname, 'src/shared'),
    },
  },
  test: {
    // Playwright specs that drive the built Electron app: `bun run test:e2e`, and the
    // page-break sweep and typing check, run by hand.
    exclude: [
      ...configDefaults.exclude,
      'e2e/**',
      'scripts/page-break-sweep/**',
      'scripts/typing-check/**',
    ],
  },
});
