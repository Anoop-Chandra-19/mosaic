import { resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  test: {
    // e2e/ holds Playwright specs that drive the built Electron app (`bun run test:e2e`).
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
