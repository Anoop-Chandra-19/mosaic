import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';

const START_TIMEOUT_MS = 10_000;
const STOP_TIMEOUT_MS = 2_000;

/** A worker's own X server: no shared window focus, pointer, or clipboard. */
export async function startXvfb(): Promise<{ display: string; stop: () => Promise<void> }> {
  // Xvfb atomically chooses a free display and writes its number to fd 3 once ready.
  const server = spawn(
    'Xvfb',
    ['-displayfd', '3', '-screen', '0', '1920x1080x24', '-nolisten', 'tcp', '-noreset'],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe'] }
  );
  const displayPipe = server.stdio[3] as Readable;
  let stderr = '';
  server.stderr!.setEncoding('utf8').on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-8_192);
  });

  const exited = new Promise<void>((resolve) => {
    server.once('exit', () => resolve());
    server.once('error', () => resolve());
  });
  const killOnExit = () => server.kill('SIGTERM');
  process.once('exit', killOnExit);

  async function stop(): Promise<void> {
    try {
      server.kill('SIGTERM');
      const timeout = setTimeout(() => server.kill('SIGKILL'), STOP_TIMEOUT_MS);
      try {
        await exited;
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      process.removeListener('exit', killOnExit);
    }
  }

  try {
    const display = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => fail('Timed out waiting for Xvfb'), START_TIMEOUT_MS);
      const cleanUp = () => {
        clearTimeout(timeout);
        displayPipe.removeListener('data', onDisplay);
        server.removeListener('error', onError);
        server.removeListener('exit', onExit);
      };
      const fail = (message: string) => {
        cleanUp();
        reject(new Error(`${message}. Linux E2E tests require Xvfb.\n${stderr}`.trim()));
      };
      const onDisplay = (chunk: Buffer) => {
        output += chunk.toString();
        if (!output.includes('\n')) return;
        const number = output.trim();
        if (!/^\d+$/.test(number)) {
          fail(`Xvfb returned an invalid display number: ${number}`);
          return;
        }
        cleanUp();
        resolve(`:${number}`);
      };
      const onError = (error: Error) => fail(`Could not start Xvfb: ${error.message}`);
      const onExit = (code: number | null, signal: string | null) =>
        fail(`Xvfb exited before becoming ready (${signal ?? code})`);
      displayPipe.on('data', onDisplay);
      server.once('error', onError);
      server.once('exit', onExit);
    });
    return { display, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
