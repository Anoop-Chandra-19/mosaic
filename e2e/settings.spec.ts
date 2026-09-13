import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { launchApp } from './launch';

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
