import fs from 'node:fs';
import { expect, type ElectronApplication, type Page } from '@playwright/test';
import { test } from '../harness/launch';

// Every launch runs without a session bus (see launch.ts), so there is no Secret Service:
// these tests walk the no-keychain fallback. The keychain itself is covered by unit tests
// over a fake keyring, and by hand on a desktop.

const KEY = 'sk-ant-e2e-made-up-key';

/**
 * Every request main makes to a provider answers with `status`, and an empty model list when
 * it works — nothing leaves the computer.
 */
async function providerAnswers(app: ElectronApplication, status: number) {
  await app.evaluate(({ net }, answer) => {
    net.fetch = async () =>
      answer === 200 ? Response.json({ data: [] }) : new Response(null, { status: answer });
  }, status);
}

async function goToAiSettings(page: Page) {
  await page.getByRole('button', { name: 'Open settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings
    .getByRole('navigation')
    .getByRole('button', { name: /AI assistant/ })
    .click();
  return settings;
}

/** Live kernel-keyring entries of the dev build: the store @napi-rs/keyring falls back to. */
function kernelKeyringEntries(): string[] {
  if (process.platform !== 'linux') return [];
  return fs
    .readFileSync('/proc/keys', 'utf8')
    .split('\n')
    .filter(
      (line) => line.includes('@Mosaic (dev):') && !line.trim().split(/\s+/)[1]?.includes('i')
    );
}

test('with no keychain, a key is checked, kept for the session, and forgotten', async ({
  launchApp,
}) => {
  const first = await launchApp();
  const { app, page, userDataDir, errors } = first;
  try {
    await page.getByRole('button', { name: /Blank resume/ }).click();
    const settings = await goToAiSettings(page);
    await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
    await settings.getByRole('button', { name: 'Provider' }).click();
    await page.getByRole('menuitemradio', { name: /^Anthropic/ }).click();

    // Save checks first: a refused key is not kept.
    const field = settings.getByRole('textbox', { name: 'Anthropic API key' });
    await field.fill(KEY);
    await providerAnswers(app, 401);
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByText('Anthropic turned this key down.')).toBeVisible();
    await expect(field).toHaveValue(KEY);

    // Another provider's key is caught before anything is sent.
    await field.fill('sk-proj-e2e-made-up-key');
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByText('This looks like an OpenAI key')).toBeVisible();

    // It passes, and saving finds no keychain: the key stays in memory, and the row says so.
    await field.fill(KEY);
    await providerAnswers(app, 200);
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByText(/^Saved just now until Mosaic closes/)).toBeVisible();
    await expect(settings.getByText('This computer has no keychain')).toBeVisible();
    await expect(settings.getByText('Forget this key when Mosaic closes')).toHaveCount(0);
    // Nothing was left behind in the kernel keyring either.
    expect(kernelKeyringEntries()).toEqual([]);

    // The key never comes back to the page, and never reaches the database.
    const seen = await page.evaluate(async () =>
      JSON.stringify([await window.mosaic.secrets.status(), await window.mosaic.db.boot()])
    );
    expect(seen).not.toContain(KEY);

    // A reload keeps the session's key: it lives in main, not in the page.
    await page.reload();
    const reloaded = await goToAiSettings(page);
    await expect(reloaded.getByText(/^Saved just now until Mosaic closes/)).toBeVisible();

    await reloaded.getByRole('navigation').getByRole('button', { name: 'Privacy' }).click();
    const forget = reloaded.getByRole('button', { name: 'Forget keys' });
    await forget.click();
    await expect(page.getByText('API keys forgotten')).toBeVisible();
    await expect(forget).toBeDisabled();

    // Saved again, then quit: a session key does not outlive the app.
    await reloaded
      .getByRole('navigation')
      .getByRole('button', { name: /AI assistant/ })
      .click();
    await reloaded.getByRole('textbox', { name: 'Anthropic API key' }).fill(KEY);
    await reloaded.getByRole('button', { name: 'Save' }).click();
    await expect(reloaded.getByText(/^Saved just now until Mosaic closes/)).toBeVisible();
    expect(errors).toEqual([]);
    await app.close();

    const second = await launchApp(userDataDir);
    try {
      const again = await goToAiSettings(second.page);
      await expect(again.getByRole('textbox', { name: 'Anthropic API key' })).toBeVisible();
      expect(await second.page.evaluate(() => window.mosaic.secrets.status())).toMatchObject({
        saved: {},
      });
      expect(second.errors).toEqual([]);
    } finally {
      await second.app.close();
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('a pasted key with spaces is caught before anything is sent', async ({ launchApp }) => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await page.getByRole('button', { name: /Blank resume/ }).click();
    const settings = await goToAiSettings(page);
    await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
    await settings.getByRole('button', { name: 'Provider' }).click();
    await page.getByRole('menuitemradio', { name: /^OpenAI(?!-)/ }).click();

    await settings.getByRole('textbox', { name: 'OpenAI API key' }).fill('sk-part one');
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByText('Keys have no spaces.')).toBeVisible();
    await expect(settings.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(await page.evaluate(() => window.mosaic.secrets.status())).toMatchObject({ saved: {} });
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
