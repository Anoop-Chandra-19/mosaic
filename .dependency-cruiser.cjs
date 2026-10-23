// Dev-only: run `depcruise --config .dependency-cruiser.cjs src` from the repo root.
const { resolve } = require('node:path');

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: { path: '^src/' },
      to: { circular: true },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: { path: '^src/' },
      to: { couldNotResolve: true },
    },
    {
      name: 'no-cross-process-imports',
      severity: 'error',
      // Each process uses shared contracts, not another process's implementation.
      from: { path: '^src/(main|renderer|preload)/', pathNot: '(^|/)__tests__/' },
      to: { path: '^src/(main|renderer|preload)/', pathNot: '^src/$1/' },
    },
    {
      name: 'shared-not-to-app-layers',
      severity: 'error',
      from: { path: '^src/shared/', pathNot: '(^|/)__tests__/' },
      to: { path: '^src/(main|renderer|preload)/' },
    },
    // Test harnesses may import higher layers; tests still participate in cycles.
    {
      name: 'components-not-to-features',
      severity: 'error',
      from: { path: '^src/renderer/src/components/', pathNot: '(^|/)__tests__/' },
      to: { path: '^src/renderer/src/features/' },
    },
    {
      name: 'stores-not-to-ui',
      severity: 'error',
      from: { path: '^src/renderer/src/stores/', pathNot: '(^|/)__tests__/' },
      to: { path: '^src/renderer/src/(features|components)/' },
    },
    {
      name: 'lib-types-not-to-upper-layers',
      severity: 'error',
      from: { path: '^src/renderer/src/(lib|types)/', pathNot: '(^|/)__tests__/' },
      to: { path: '^src/renderer/src/(features|components|stores)/' },
    },
  ],
  options: {
    // Do not filter to src: unresolved package imports must remain visible too.
    doNotFollow: { path: '(^|/)node_modules/' },
    tsConfig: { fileName: 'tsconfig.json' },
    webpackConfig: { fileName: __filename },
    tsPreCompilationDeps: true,
    builtInModules: { add: ['electron'] },
    // The resolver handles existing assets and strips Vite queries (e.g. ?worker).
    // No asset exclusion: missing assets must still fail no-unresolved.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};

// The webpack adapter reads this; keep it non-enumerable so it is not a cruise option.
// Match Vite's /^cn$/ alias without redirecting cn/lite or cn/config back to utils.ts.
Object.defineProperty(module.exports, 'resolve', {
  value: { alias: { cn$: resolve(__dirname, 'src/renderer/src/lib/utils.ts') } },
});
