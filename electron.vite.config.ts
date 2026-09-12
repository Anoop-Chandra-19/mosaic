import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const root = import.meta.dirname;
const alias = { '@': resolve(root, 'src') };

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: { input: resolve(root, 'electron/main/index.ts') },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(root, 'electron/preload/index.ts'),
        // A sandboxed preload cannot load ES modules, and the package is "type": "module",
        // so the output must be CommonJS with an explicit .cjs extension.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    // The renderer keeps living at the repo root (index.html + src/), not src/renderer.
    root,
    resolve: { alias },
    plugins: [tailwindcss(), react()],
    build: {
      rollupOptions: { input: resolve(root, 'index.html') },
    },
  },
});
