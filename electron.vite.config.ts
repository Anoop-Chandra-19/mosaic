import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

const root = import.meta.dirname;
const alias = { '@': resolve(root, 'src') };
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version: string;
};

/**
 * The renderer never needs the network: fonts are local, PDF export runs on-device, and
 * AI calls happen in the main process. So the policy only admits the app's own files —
 * even injected script could not load code or send the resume anywhere.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // react-pdf lays out pages with yoga-layout, which is WebAssembly. This allows compiling
  // Wasm only; JavaScript eval and new Function stay blocked.
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Production builds only: Vite's dev server injects an inline HMR script. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'mosaic:content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

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
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [tailwindcss(), react(), contentSecurityPolicy()],
    build: {
      rollupOptions: { input: resolve(root, 'index.html') },
    },
  },
});
