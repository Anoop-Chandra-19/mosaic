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

test('Import & export opens the import dialog', async () => {
  const { page } = mosaic();
  await page.getByRole('button', { name: /Blank resume/ }).click();

  const settings = await openSettings(page, 'Import & export');
  await settings.getByRole('button', { name: 'Import…' }).click();

  await expect(page.getByRole('dialog', { name: 'Import resume' })).toBeVisible();
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
