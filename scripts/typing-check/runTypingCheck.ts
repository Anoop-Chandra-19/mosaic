/**
 * Runs the typing check, as is or on a loaded CPU: `--load N` pins the app to one core and
 * runs N busy loops beside it, so every app process gets about 1/(N+1) of that core.
 * Linux only, through `taskset`. Chromium's own CPU throttling slows only the page's
 * main thread, leaving the GPU and compositor at full speed, so it isn't used.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { load: { type: 'string', default: '0' } } });
const load = Number(values.load);
if (!Number.isInteger(load) || load < 0) throw new Error('--load takes a whole number.');
if (load > 0 && process.platform !== 'linux') throw new Error('--load needs Linux (taskset).');

const root = path.resolve(import.meta.dirname, '../..');
const playwright = [
  path.join(root, 'node_modules/.bin/playwright'),
  'test',
  '-c',
  path.join(import.meta.dirname, 'playwright.config.ts'),
];
const pinned = (command: string[]) => (load > 0 ? ['taskset', '-c', '0', ...command] : command);

// Each loop also stops once this script is gone, however it ended.
const BUSY_LOOP =
  'const parent = process.ppid; for (let i = 0; ; i++) if (i % 1e8 === 0 && process.ppid !== parent) process.exit();';

const loops: ChildProcess[] = [];
const stopLoops = () => loops.forEach((loop) => loop.kill());

for (let i = 0; i < load; i++) {
  loops.push(spawn('taskset', ['-c', '0', process.execPath, '-e', BUSY_LOOP]));
}
console.log(
  load > 0 ? `One core shared with ${load} busy loop${load === 1 ? '' : 's'}.` : 'No added load.'
);
const [command, ...args] = pinned(playwright);
const check = spawn(command, args, { cwd: root, stdio: 'inherit' });
check.on('exit', (code) => {
  stopLoops();
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    check.kill(signal);
    stopLoops();
  });
}
