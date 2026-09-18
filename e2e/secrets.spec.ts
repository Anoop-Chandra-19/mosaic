import fs from 'node:fs';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp } from './launch';

// Every launch runs without a session bus (see launch.ts), so there is no Secret Service:
// these tests walk the no-keychain fallback. The keychain itself is covered by unit tests
// over a fake keyring, and by hand on a desktop.

const KEY = 'sk-ant-e2e-made-up-key';

/** Every request main makes to a provider answers with `status` — nothing leaves the machine. */
async function providerAnswers(app: ElectronApplication, status: number) {
  await app.evaluate(({ net }, answer) => {
    net.fetch = async () => new Response(null, { status: answer });
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

test('with no keychain, a key is tested, kept for the session, and forgotten', async () => {
  const first = await launchApp();
  const { app, page, userDataDir, errors } = first;
  try {
    await page.getByRole('button', { name: /Blank resume/ }).click();
    const settings = await goToAiSettings(page);
    await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
    await settings.getByRole('combobox', { name: 'Provider' }).click();
    await page.getByRole('option', { name: 'Anthropic' }).click();

    // Nothing has asked the keychain yet, so the keychain is still on offer.
    await expect(settings.getByRole('radio', { name: 'OS keychain' })).toBeChecked();

    const field = settings.getByRole('textbox', { name: 'Anthropic API key' });
    await field.fill(KEY);
    await providerAnswers(app, 401);
    await settings.getByRole('button', { name: 'Test' }).click();
    await expect(settings.getByText('Anthropic turned this key down.')).toBeVisible();

    await providerAnswers(app, 200);
    await settings.getByRole('button', { name: 'Test' }).click();
    await expect(settings.getByRole('button', { name: 'Reachable' })).toBeVisible();

    // Saving finds no keychain: the key stays in memory, and the row says so.
    await settings.getByRole('button', { name: 'Save' }).click();
    await expect(settings.getByText('Saved for this session')).toBeVisible();
    await expect(settings.getByText('No keychain was found on this computer')).toBeVisible();
    await expect(settings.getByRole('radio', { name: 'OS keychain' })).toBeDisabled();
    await expect(settings.getByRole('radio', { name: 'This session' })).toBeChecked();
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
    await expect(reloaded.getByText('Saved for this session')).toBeVisible();
    await providerAnswers(app, 200);
    await reloaded.getByRole('button', { name: 'Test' }).click();
    await expect(reloaded.getByRole('button', { name: 'Reachable' })).toBeVisible();

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
    await expect(reloaded.getByText('Saved for this session')).toBeVisible();
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

test('a pasted key with spaces is caught before anything is sent', async () => {
  const { app, page, userDataDir } = await launchApp();
  try {
    await page.getByRole('button', { name: /Blank resume/ }).click();
    const settings = await goToAiSettings(page);
    await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
    await settings.getByRole('combobox', { name: 'Provider' }).click();
    await page.getByRole('option', { name: 'OpenAI' }).click();

    await settings.getByRole('textbox', { name: 'OpenAI API key' }).fill('sk-part one');
    await expect(settings.getByText('Keys have no spaces.')).toBeVisible();
    await expect(settings.getByRole('button', { name: 'Test' })).toBeDisabled();
    await expect(settings.getByRole('button', { name: 'Save' })).toBeDisabled();
  } finally {
    await app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
