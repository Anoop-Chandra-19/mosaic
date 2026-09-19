import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { launchApp, withApp } from './launch';

async function openSettings(page: Page, section: string) {
  await page.getByRole('button', { name: 'Open settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('navigation').getByRole('button', { name: section }).click();
  await expect(dialog.getByRole('heading', { name: section })).toBeVisible();
  return dialog;
}

const mosaic = withApp();

test('settings are grouped as the design has them, and take effect', async () => {
  const { page, errors } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  const settings = await openSettings(page, 'Document');
  await settings.getByRole('radio', { name: 'US Letter' }).click();
  await settings.getByRole('navigation').getByRole('button', { name: 'Appearance' }).click();
  await settings.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  // AI is off by default: its controls are shown but out of reach until it is turned on.
  await settings
    .getByRole('navigation')
    .getByRole('button', { name: /AI assistant/ })
    .click();
  await expect(settings.locator('[inert]')).toHaveCount(1);
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await expect(settings.locator('[inert]')).toHaveCount(0);
  await settings.getByRole('combobox', { name: 'Provider' }).click();
  await page.getByRole('option', { name: 'Ollama (local)' }).click();
  // A local model needs no key.
  await expect(settings.getByText('API key', { exact: true })).toHaveCount(0);

  const stored = await page.evaluate(async () => {
    const boot = await window.mosaic.db.boot();
    if (!boot.ok) throw new Error(boot.message);
    return { ui: JSON.parse(boot.value.settings.ui), ai: JSON.parse(boot.value.settings.ai) };
  });
  expect(stored.ui.state).toMatchObject({ paperSize: 'letter', darkMode: false });
  expect(stored.ai.state).toMatchObject({ enabled: true, provider: 'ollama' });
  expect(errors).toEqual([]);
});

test('Ollama’s model is picked from the chat models pulled on this machine', async () => {
  const { app, page, errors } = mosaic();
  // Main asks Ollama through net.fetch: stand in for an Ollama with two chat models and an
  // embedding model, so the test never depends on what this machine has pulled.
  await app.evaluate(({ net }) => {
    net.fetch = async (input, init) => {
      if (String(input).endsWith('/api/tags')) {
        return Response.json({
          models: [
            { name: 'qwen3.5:9b', size: 6_600_000_000 },
            { name: 'nomic-embed-text:latest', size: 274_302_450 },
            { name: 'gemma4:12b', size: 7_600_000_000 },
          ],
        });
      }
      const { model } = JSON.parse(String(init?.body)) as { model: string };
      return Response.json({
        capabilities: model.startsWith('nomic') ? ['embedding'] : ['completion'],
      });
    };
  });
  await page.getByRole('button', { name: /Blank resume/ }).click();

  const settings = await openSettings(page, 'AI assistant');
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('combobox', { name: 'Provider' }).click();
  await page.getByRole('option', { name: 'Ollama (local)' }).click();

  await settings.getByRole('combobox', { name: 'Ollama model' }).click();
  await expect(page.getByRole('option')).toHaveText(['gemma4:12b7.6 GB', 'qwen3.5:9b6.6 GB']);
  await page.getByRole('option', { name: /gemma4:12b/ }).click();
  const stored = await page.evaluate(async () => {
    const boot = await window.mosaic.db.boot();
    if (!boot.ok) throw new Error(boot.message);
    return JSON.parse(boot.value.settings.ai);
  });
  expect(stored.state.modelsByProvider.ollama).toBe('gemma4:12b');

  // Ollama stops: Refresh says so, and the chosen model stays.
  await app.evaluate(({ net }) => {
    net.fetch = () => Promise.reject(new TypeError('connect ECONNREFUSED'));
  });
  await settings.getByRole('button', { name: 'Refresh Ollama models' }).click();
  await expect(settings.getByText('Nothing answered at 127.0.0.1:11434.')).toBeVisible();
  await expect(settings.getByRole('combobox', { name: 'Ollama model' })).toHaveText(/gemma4:12b/);
  expect(errors).toEqual([]);
});

test('Ollama can live elsewhere on the network, and Settings says where text goes', async () => {
  const { app, page } = mosaic();
  // Remember every address main asks, and answer as an Ollama with nothing pulled.
  await app.evaluate(({ net }) => {
    const asked: string[] = [];
    (globalThis as { ollamaAsked?: string[] }).ollamaAsked = asked;
    net.fetch = async (input) => {
      asked.push(String(input));
      return Response.json({ models: [] });
    };
  });
  const asked = () =>
    app.evaluate(() => (globalThis as { ollamaAsked?: string[] }).ollamaAsked ?? []);
  await page.getByRole('button', { name: /Blank resume/ }).click();

  const settings = await openSettings(page, 'AI assistant');
  await settings.getByRole('switch', { name: 'Enable AI assistant' }).click();
  await settings.getByRole('combobox', { name: 'Provider' }).click();
  await page.getByRole('option', { name: 'Ollama (local)' }).click();
  await expect(settings.getByText('your resume text never leaves it')).toBeVisible();
  await expect.poll(asked).toContain('http://127.0.0.1:11434/api/tags');

  // A box on the network, typed the short way: the scheme is filled in, the port kept.
  const field = settings.getByRole('textbox', { name: 'Ollama address' });
  await field.fill('gpu-box:8080');
  await field.press('Enter');
  await expect(field).toHaveValue('http://gpu-box:8080');
  await expect.poll(asked).toContain('http://gpu-box:8080/api/tags');
  await expect(
    settings.getByText(/Ollama at gpu-box:8080 — your resume text goes there/)
  ).toBeVisible();
  await expect(
    settings.getByText(/Ollama runs on your own hardware — here, on your network/)
  ).toBeVisible();

  // Not an address: said so, and nothing is sent there.
  const before = (await asked()).length;
  await field.fill('ftp://gpu-box');
  await field.press('Enter');
  await expect(settings.getByText('That isn’t an address.')).toBeVisible();
  expect(await asked()).toHaveLength(before);

  await settings.getByRole('button', { name: 'Use this machine' }).click();
  await expect(field).toHaveValue('http://127.0.0.1:11434');
  const stored = await page.evaluate(async () => {
    const boot = await window.mosaic.db.boot();
    if (!boot.ok) throw new Error(boot.message);
    return JSON.parse(boot.value.settings.ai);
  });
  expect(stored.state.ollamaAddress).toBe('http://127.0.0.1:11434');
});

test('Ctrl+, opens Settings', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  await page.keyboard.press('Control+,');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.getByRole('heading', { name: 'General' })).toBeVisible();
});

test('Import & export opens the import dialog', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  const settings = await openSettings(page, 'Import & export');
  await settings.getByRole('button', { name: 'Import…' }).click();

  await expect(page.getByRole('dialog', { name: 'Import' })).toBeVisible();
});

test('erasing local data starts Mosaic over, settings included', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  const settings = await openSettings(page, 'Privacy');
  await settings.getByRole('button', { name: 'Erase local data' }).click();
  await page
    .getByRole('dialog', { name: 'Erase local data' })
    .getByRole('button', { name: 'Erase everything' })
    .click();

  // The app reloads over a fresh database: the Start panel, and the default theme.
  await expect(page.getByRole('button', { name: /Blank resume/ })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const boot = await page.evaluate(async () => {
    const result = await window.mosaic.db.boot();
    if (!result.ok) throw new Error(result.message);
    return result.value;
  });
  expect(boot.templates).toEqual([]);
  expect(boot.settings.ui).toBeUndefined();
});

test('settings survive quitting and relaunching', async () => {
  const first = await launchApp();
  const { userDataDir } = first;
  try {
    const html = first.page.locator('html');
    await expect(html).toHaveClass(/dark/);
    await first.page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(html).not.toHaveClass(/dark/);

    // Calls reach main in order, so once this answers the theme write has landed.
    const { settings } = await first.page.evaluate(async () => {
      const boot = await window.mosaic.db.boot();
      if (!boot.ok) throw new Error(boot.message);
      return boot.value;
    });
    expect(JSON.parse(settings.ui)).toMatchObject({ state: { darkMode: false } });
    await first.app.close();

    const second = await launchApp(userDataDir);
    try {
      await expect(second.page.locator('html')).not.toHaveClass(/dark/);
      expect(second.errors).toEqual([]);
    } finally {
      await second.app.close();
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
