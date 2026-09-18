import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

const root = import.meta.dirname;
const rendererRoot = resolve(root, 'src/renderer');
const sharedAlias = { '@shared': resolve(root, 'src/shared') };
const rendererAlias = { ...sharedAlias, '@': resolve(rendererRoot, 'src') };
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
    resolve: { alias: sharedAlias },
    build: {
      outDir: resolve(root, 'out/main'),
      rollupOptions: { input: resolve(root, 'src/main/index.ts') },
    },
  },
  preload: {
    resolve: { alias: sharedAlias },
    build: {
      outDir: resolve(root, 'out/preload'),
      rollupOptions: {
        input: resolve(root, 'src/preload/index.ts'),
        // A sandboxed preload cannot load ES modules, and the package is "type": "module",
        // so the output must be CommonJS with an explicit .cjs extension.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: rendererRoot,
    envDir: root,
    resolve: { alias: rendererAlias },
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [
      tailwindcss(),
      react({
        babel: {
          // Keep the compiler first: it must analyze components before other Babel transforms.
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      contentSecurityPolicy(),
    ],
    build: {
      outDir: resolve(root, 'out/renderer'),
      rollupOptions: { input: resolve(rendererRoot, 'index.html') },
    },
  },
});
