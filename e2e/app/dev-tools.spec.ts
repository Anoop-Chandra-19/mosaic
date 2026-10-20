import { expect } from '@playwright/test';
import { runDevTool } from '../harness/devTools';
import { test, withApp } from '../harness/launch';

const mosaic = withApp();

test('the developer tools open over the full history, run from the keyboard, and repeat from Recent', async () => {
  const { app, page, errors } = mosaic();
  await expect(page).toHaveTitle('Mosaic DEV');
  await runDevTool(page, 'exampleResume');
  await page.getByRole('main').click({ position: { x: 20, y: 200 } });
  await page.keyboard.press('Control+Shift+H');
  const history = page.getByRole('region', { name: /^History of/ });
  await expect(history).toBeVisible();

  // Over the full history, which covers the top bar and its wrench.
  await page.keyboard.press('Control+Shift+D');
  const tools = page.getByRole('dialog', { name: 'Developer tools' });
  await expect(tools).toBeVisible();
  await page.keyboard.type('stage');
  await expect(tools.getByRole('option', { selected: true })).toContainText(
    'Stage one of each suggestion'
  );
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Staged 12 example suggestions/)).toBeVisible();
  await expect(tools).toBeHidden();
  await expect(history).toBeVisible();

  // Develop › Developer tools… opens on Recent, the last tool first.
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById('developer-tools');
    item?.click(undefined, BrowserWindow.getAllWindows()[0]);
  });
  await expect(tools).toBeVisible();
  await expect(tools.getByRole('group', { name: 'Recent' })).toContainText(
    'Stage one of each suggestion'
  );
  await expect(tools.getByRole('option', { selected: true })).toContainText(
    'Runs again with the same choices.'
  );
  await page.keyboard.press('Escape');
  await expect(tools).toBeHidden();
  await expect(history).toBeVisible();
  expect(errors).toEqual([]);
});
