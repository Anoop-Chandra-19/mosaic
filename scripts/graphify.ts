/**
 * Dev-only Graphify entry point: runs the pinned CLI in uv's isolated cache, with model
 * backends and query logging disabled. Builds and scoped queries share graphify-out/;
 * agents use the package scripts documented in docs/development.md, not an install hook.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const GRAPHIFY_PACKAGE = 'graphifyy[sql]==0.9.95';
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const result = spawnSync(
  'uv',
  ['tool', 'run', '--no-env-file', '--from', GRAPHIFY_PACKAGE, 'graphify', ...args],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      GRAPHIFY_BACKEND: 'none',
      GRAPHIFY_QUERY_LOG_DISABLE: '1',
      GRAPHIFY_OUT: resolve(root, 'graphify-out'),
    },
  }
);

if (result.error) {
  console.error(`Could not run Graphify: ${result.error.message}`);
  console.error('Install uv (https://docs.astral.sh/uv/getting-started/installation/) and retry.');
}
process.exitCode = result.status ?? 1;
