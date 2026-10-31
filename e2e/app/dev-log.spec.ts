import fs from 'node:fs';
import { expect } from '@playwright/test';
import { test } from '../harness/launch';

const KEY = 'sk-fictional-key-for-the-log-test';

type Launched = Awaited<ReturnType<Parameters<Parameters<typeof test>[2]>[0]['launchApp']>>;

/** What the app prints from now on. */
function collectOutput({ app }: Launched): () => string {
  let output = '';
  app.process().stdout?.on('data', (chunk) => (output += String(chunk)));
  return () => output;
}

async function saveKeyAndFail({ page }: Launched): Promise<void> {
  await page.evaluate(async (key) => {
    await window.mosaic.secrets.save('openai', key, { check: false, forgetOnClose: true });
    console.error('A page error for the log');
  }, KEY);
}

async function closeLaunch({ app, userDataDir }: Launched): Promise<void> {
  await app.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

test('--dev-log prints each bridge call and the page’s errors, never what a call carried', async ({
  launchApp,
}) => {
  const launched = await launchApp(undefined, { extraArgs: ['--dev-log'] });
  try {
    const readOutput = collectOutput(launched);
    await saveKeyAndFail(launched);
    await expect.poll(readOutput).toContain('A page error for the log');

    const entries = readOutput()
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries).toContainEqual(
      expect.objectContaining({ context: 'bridge', channel: 'secrets:save', outcome: 'ok' })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        context: 'page',
        level: 'error',
        message: 'A page error for the log',
      })
    );
    expect(readOutput()).not.toContain(KEY);
  } finally {
    await closeLaunch(launched);
  }
});

test('a launch that names its own profile logs nothing unless it asks', async ({ launchApp }) => {
  const launched = await launchApp();
  try {
    const readOutput = collectOutput(launched);
    await saveKeyAndFail(launched);
    // The page's error is what would be logged last, so once main has had time for it, it's quiet.
    await launched.page.evaluate(() => window.mosaic.secrets.status());
    expect(readOutput()).not.toContain('"context"');
    expect(readOutput()).not.toContain(KEY);
  } finally {
    await closeLaunch(launched);
  }
});
